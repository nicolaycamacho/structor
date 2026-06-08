#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafeWriteTarget } from "./lib/path-safety.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const outputArgIndex = args.indexOf("--output");
const outputRoot = outputArgIndex === -1 ? repoRoot : path.resolve(args[outputArgIndex + 1]);
const viewsDir = path.join(outputRoot, "ai/views");
const projectName = {{PROJECT_NAME_JSON}};
const harnessRepoName = "{{HARNESS_REPO_NAME}}";
const consumers = {{CONSUMER_CONFIG_JSON}};
const modelSupport = {
  openai: {{MODEL_OPENAI_ENABLED}},
  anthropic: {{MODEL_ANTHROPIC_ENABLED}},
};
const clientSupport = {
  codexHooks: {{CLIENT_CODEX_HOOKS_ENABLED}},
  claudeRules: {{CLIENT_CLAUDE_RULES_ENABLED}},
  claudeHooks: {{CLIENT_CLAUDE_HOOKS_ENABLED}},
  claudeSkills: {{CLIENT_CLAUDE_SKILLS_ENABLED}},
};

async function read(relativePath) {
  try {
    return await readFile(path.join(repoRoot, relativePath), "utf8");
  } catch {
    return "";
  }
}

async function files(relativeDir, suffix) {
  try {
    const entries = await readdir(path.join(repoRoot, relativeDir), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
      .map((entry) => `${relativeDir}/${entry.name}`)
      .sort();
  } catch {
    return [];
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function titleFromMarkdown(content, fallback) {
  return content.match(/^#\s+(.+)$/m)?.[1] ?? fallback;
}

function frontMatterValue(content, key) {
  return content.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? "";
}

function code(value) {
  return `<code>${escapeHtml(value)}</code>`;
}

function list(items) {
  if (items.length === 0) return `<span class="muted">n/a</span>`;
  return `<ul class="compact-list">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function pill(label, tone = "neutral") {
  return `<span class="pill ${tone}">${escapeHtml(label)}</span>`;
}

function parseJson(content) {
  if (!content.trim()) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function markdownTableRows(content, headerText, expectedCellCount) {
  const rows = [];
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(headerText));
  if (start === -1) return rows;
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith("|")) break;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length >= expectedCellCount) rows.push(cells.slice(0, expectedCellCount));
  }
  return rows;
}

function firstScriptFromCommand(command) {
  return command.match(/\bnode\s+(scripts\/[^\s`|&;]+)/)?.[1] ?? "";
}

async function scriptExistsForCommand(command) {
  const script = firstScriptFromCommand(command);
  if (!script) return false;
  return Boolean(await read(script));
}

async function contractRecords() {
  const contractFiles = await files("ai/contracts", ".md");
  const rows = [];
  for (const file of contractFiles.filter((item) => item !== "ai/contracts/README.md")) {
    const content = await read(file);
    const manifestPath = file.replace(/\.md$/, ".contract.json");
    const manifest = parseJson(await read(manifestPath));
    const title = titleFromMarkdown(content, path.basename(file));
    rows.push({
      source: file,
      title,
      manifestPath,
      manifest,
      manifestPresent: Boolean(manifest),
      manifestName: manifest?.name ?? manifest?.title ?? "",
      manifestId: manifest?.id ?? "",
      requiredFiles: Array.isArray(manifest?.requiredFiles) ? manifest.requiredFiles : [],
      validation: Array.isArray(manifest?.validation) ? manifest.validation : [],
    });
  }
  return rows;
}

async function readinessRecords() {
  const readiness = await read("ai/READINESS.md");
  const rows = markdownTableRows(readiness, "| Gate | Command | Required evidence |", 3);
  return await Promise.all(
    rows.map(async ([gate, command, evidence]) => {
      const normalizedCommand = command.replaceAll("`", "");
      const script = firstScriptFromCommand(normalizedCommand);
      return {
        gate,
        command: normalizedCommand,
        evidence,
        source: "ai/READINESS.md",
        script,
        scriptExists: script ? await scriptExistsForCommand(normalizedCommand) : false,
        expectation: /when|optional|deferred/i.test(evidence) ? "conditional" : "expected",
      };
    }),
  );
}

function consumerRecords() {
  return consumers.map((consumer) => {
    const validation = Object.entries(consumer.validation ?? {});
    return {
      name: consumer.name,
      path: consumer.workspacePath ?? consumer.path,
      purpose: consumer.purpose ?? "n/a",
      validation,
      codexEntrypoint: modelSupport.openai ? "AGENTS.md" : "disabled",
      claudeEntrypoints: modelSupport.anthropic ? ["CLAUDE.md"] : [],
      codexEnabled: modelSupport.openai,
      claudeEnabled: modelSupport.anthropic,
    };
  });
}

function summarizeContractCategories(contracts) {
  const categories = new Set();
  for (const contract of contracts) {
    const id = contract.manifestId || path.basename(contract.source, ".md");
    categories.add(id.split("-")[0]);
  }
  return [...categories].slice(0, 5);
}

function topologyDiagram({ contracts, readiness }) {
  const consumerCount = consumers.length;
  const contractCount = contracts.length;
  const gateCount = readiness.length;
  return `
    <svg class="topology" viewBox="0 0 980 390" role="img" aria-labelledby="topology-title topology-desc">
      <title id="topology-title">Harness Cockpit topology diagram</title>
      <desc id="topology-desc">Static generated diagram showing the generated harness, consumer repositories, client surfaces, contracts, and validation expectations.</desc>
      <defs>
        <linearGradient id="panel-gradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f2533"/>
          <stop offset="100%" stop-color="#132f24"/>
        </linearGradient>
        <filter id="soft-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#08131a" flood-opacity="0.18"/>
        </filter>
      </defs>
      <rect width="980" height="390" rx="8" fill="#eef3f0"/>
      <rect x="30" y="34" width="300" height="322" rx="8" fill="url(#panel-gradient)" filter="url(#soft-shadow)"/>
      <text x="58" y="78" class="svg-kicker">GENERATED HARNESS</text>
      <text x="58" y="112" class="svg-title">${escapeHtml(harnessRepoName)}</text>
      <text x="58" y="146" class="svg-copy">${escapeHtml(projectName)}</text>
      <text x="58" y="198" class="svg-label">Canonical policy</text>
      <text x="58" y="226" class="svg-label">Contracts and task shape</text>
      <text x="58" y="254" class="svg-label">Readiness expectations</text>
      <rect x="390" y="48" width="238" height="92" rx="8" fill="#ffffff" stroke="#b7c6c0"/>
      <text x="414" y="82" class="svg-node-title">Consumer repositories</text>
      <text x="414" y="112" class="svg-node-copy">${consumerCount} configured</text>
      <rect x="390" y="164" width="238" height="92" rx="8" fill="#ffffff" stroke="#b7c6c0"/>
      <text x="414" y="198" class="svg-node-title">Client surfaces</text>
      <text x="414" y="228" class="svg-node-copy">Codex ${modelSupport.openai ? "enabled" : "disabled"} / Claude ${modelSupport.anthropic ? "enabled" : "disabled"}</text>
      <rect x="390" y="280" width="238" height="60" rx="8" fill="#ffffff" stroke="#b7c6c0"/>
      <text x="414" y="316" class="svg-node-title">Consumer entrypoints</text>
      <rect x="704" y="80" width="216" height="84" rx="8" fill="#ffffff" stroke="#b7c6c0"/>
      <text x="728" y="114" class="svg-node-title">Contract groups</text>
      <text x="728" y="144" class="svg-node-copy">${contractCount} markdown sources</text>
      <rect x="704" y="220" width="216" height="84" rx="8" fill="#ffffff" stroke="#b7c6c0"/>
      <text x="728" y="254" class="svg-node-title">Validation readiness</text>
      <text x="728" y="284" class="svg-node-copy">${gateCount} expected gates</text>
      <path d="M330 106 C360 106 360 94 390 94" stroke="#2f6f5e" stroke-width="3" fill="none"/>
      <path d="M330 214 C360 214 360 210 390 210" stroke="#2f6f5e" stroke-width="3" fill="none"/>
      <path d="M330 296 C360 296 360 310 390 310" stroke="#2f6f5e" stroke-width="3" fill="none"/>
      <path d="M628 94 C664 94 668 122 704 122" stroke="#2f6f5e" stroke-width="3" fill="none"/>
      <path d="M628 210 C668 210 666 122 704 122" stroke="#2f6f5e" stroke-width="3" fill="none"/>
      <path d="M628 310 C666 310 668 262 704 262" stroke="#2f6f5e" stroke-width="3" fill="none"/>
    </svg>
`;
}

function layout(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - ${escapeHtml(projectName)} Harness Cockpit</title>
  <style>
    :root { color-scheme: light; --ink: #172026; --muted: #5b6670; --line: #d9e0de; --panel: #ffffff; --field: #f4f7f6; --accent: #2f6f5e; --accent-2: #b14d2c; --navy: #0f2533; --gold: #9a6a16; }
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: var(--ink); background: #eef3f0; }
    header { background: var(--navy); color: #f5fbf8; border-bottom: 4px solid var(--accent); }
    header, main { margin: 0 auto; padding: 24px; }
    main { max-width: 1180px; }
    .header-inner { max-width: 1180px; margin: 0 auto; display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr) auto; align-items: end; }
    .eyebrow { margin: 0 0 8px; color: #9fd6c6; font-size: 12px; font-weight: 800; letter-spacing: 0; text-transform: uppercase; }
    h1 { margin: 0; font-size: 34px; line-height: 1.08; letter-spacing: 0; }
    h2 { margin: 34px 0 14px; font-size: 20px; line-height: 1.2; }
    h3 { margin: 0 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0; color: var(--muted); }
    p { line-height: 1.5; }
    a { color: #1260a3; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); }
    th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { background: #e6eeeb; color: #24343c; font-size: 12px; text-transform: uppercase; letter-spacing: 0; }
    code { background: #e7eeec; padding: 2px 5px; border-radius: 4px; }
    .note, .muted { color: var(--muted); }
    header .note { color: #c9d8d3; margin: 8px 0 0; }
    nav { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    nav a { color: #f5fbf8; text-decoration: none; border: 1px solid rgba(255,255,255,.24); border-radius: 6px; padding: 8px 10px; font-size: 13px; }
    .cockpit-band { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(300px, .75fr); gap: 16px; align-items: stretch; margin-top: 18px; }
    .identity-panel, .attention-panel, .section-panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 18px; }
    .identity-panel { background: #102b38; color: #f8fbfa; border-color: #274553; }
    .identity-panel code { background: rgba(255,255,255,.12); color: #ffffff; }
    .attention-panel { border-top: 4px solid var(--gold); }
    .tile-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
    .tile { background: var(--field); border: 1px solid var(--line); border-radius: 8px; padding: 12px; min-height: 86px; }
    .tile strong { display: block; font-size: 26px; line-height: 1; margin-bottom: 8px; }
    .tile span { color: var(--muted); font-size: 13px; }
    .identity-panel .tile { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.16); }
    .identity-panel .tile span { color: #c9d8d3; }
    .matrix { overflow-x: auto; }
    .compact-list { margin: 0; padding-left: 18px; }
    .compact-list li + li { margin-top: 4px; }
    .pill { display: inline-flex; align-items: center; min-height: 22px; border-radius: 999px; padding: 3px 8px; font-size: 12px; font-weight: 700; background: #e7eeec; color: #263238; }
    .pill.ok { background: #dff1e8; color: #15513f; }
    .pill.warn { background: #fff0d3; color: #68430c; }
    .pill.off { background: #eceff1; color: #5b6670; }
    .pill.missing { background: #ffe5dc; color: #7d2f17; }
    .topology { width: 100%; height: auto; display: block; border: 1px solid var(--line); border-radius: 8px; background: #eef3f0; }
    .svg-kicker { fill: #9fd6c6; font-size: 12px; font-weight: 800; letter-spacing: 0; }
    .svg-title { fill: #ffffff; font-size: 26px; font-weight: 800; }
    .svg-copy { fill: #c9d8d3; font-size: 14px; }
    .svg-label { fill: #f5fbf8; font-size: 15px; }
    .svg-node-title { fill: #172026; font-size: 16px; font-weight: 800; }
    .svg-node-copy { fill: #5b6670; font-size: 13px; }
    @media (max-width: 820px) {
      .header-inner, .cockpit-band { grid-template-columns: 1fr; }
      nav { justify-content: flex-start; }
      .tile-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <div>
        <p class="eyebrow">Harness Cockpit</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="note">Generated read-only review artifact. Markdown, JSON, and YAML files remain canonical.</p>
      </div>
      <nav aria-label="Generated view navigation">
        <a href="index.html">Overview</a>
        <a href="plans.html">Plans</a>
        <a href="contracts.html">Contracts</a>
        <a href="readiness.html">Readiness</a>
        <a href="quality.html">Quality</a>
        <a href="workspace.html">Workspace</a>
      </nav>
    </div>
  </header>
  <main>
${body}
  </main>
</body>
</html>
`;
}

function table(headers, rows) {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("\n");
  const tableBody = body || `<tr><td colspan="${headers.length}"><span class="muted">No records found.</span></td></tr>`;
  return `<div class="matrix"><table><thead><tr>${head}</tr></thead><tbody>${tableBody}</tbody></table></div>`;
}

async function indexView() {
  const contracts = await contractRecords();
  const readiness = await readinessRecords();
  const consumerSummary = consumerRecords();
  const missingManifests = contracts.filter((contract) => !contract.manifestPresent);
  const missingScripts = readiness.filter((gate) => gate.script && !gate.scriptExists);
  const categories = summarizeContractCategories(contracts);
  const attention = [
    ...missingManifests.map((contract) => `${code(contract.manifestPath)} missing for ${escapeHtml(contract.title)}`),
    ...missingScripts.map((gate) => `${code(gate.script)} missing for ${escapeHtml(gate.gate)}`),
    `${code("node scripts/check-html-views.mjs")} verifies deterministic generated view freshness.`,
    `${code("node scripts/check-workspace.mjs")} verifies consumer pointer routing when pointer status needs proof.`,
  ];
  return layout("Harness Cockpit", `
    <section class="cockpit-band" aria-label="Harness cockpit overview">
      <div class="identity-panel">
        <h2>Overview</h2>
        <p>${escapeHtml(projectName)} is wired through generated harness repo ${code(harnessRepoName)}. This cockpit visualizes local Structor facts; it does not run validation or control workflows.</p>
        <div class="tile-grid">
          <div class="tile"><strong>${escapeHtml(String(consumerSummary.length))}</strong><span>consumer repos</span></div>
          <div class="tile"><strong>${escapeHtml(String(contracts.length))}</strong><span>contract docs</span></div>
          <div class="tile"><strong>${escapeHtml(String(readiness.length))}</strong><span>readiness gates</span></div>
          <div class="tile"><strong>${modelSupport.openai || modelSupport.anthropic ? "On" : "Off"}</strong><span>client surfaces</span></div>
        </div>
      </div>
      <div class="attention-panel">
        <h2>Needs Attention</h2>
        ${list(attention)}
      </div>
    </section>
    <section>
      <h2>What Is Wired</h2>
      <div class="tile-grid">
        <div class="tile"><strong>${modelSupport.openai ? "Codex" : "Off"}</strong><span>${modelSupport.openai ? "AGENTS.md and OpenAI overlay expected" : "OpenAI support disabled"}</span></div>
        <div class="tile"><strong>${modelSupport.anthropic ? "Claude" : "Off"}</strong><span>${modelSupport.anthropic ? "CLAUDE.md surfaces expected" : "Anthropic support disabled"}</span></div>
        <div class="tile"><strong>${clientSupport.codexHooks ? "Hooks" : "No hooks"}</strong><span>Codex hook guardrails</span></div>
        <div class="tile"><strong>${clientSupport.claudeRules ? "Rules" : "Rules deferred"}</strong><span>Claude project rules</span></div>
      </div>
    </section>
    <section>
      <h2>What Is Governed</h2>
      <p>Contract categories: ${categories.length ? categories.map((category) => pill(category, "ok")).join(" ") : '<span class="muted">none found</span>'}</p>
      <p class="note">Canonical sources start at ${code("ai/HUB.md")}, ${code("ai/context.md")}, ${code("ai/contracts/*")}, and ${code("ai/READINESS.md")}.</p>
    </section>
    <section>
      <h2>Topology Diagram</h2>
      ${topologyDiagram({ contracts, readiness })}
    </section>
    <section>
      <h2>Drill-Down Views</h2>
      <div class="tile-grid">
        <div class="tile"><strong><a href="contracts.html">Contracts</a></strong><span>Matrix of docs and manifests</span></div>
        <div class="tile"><strong><a href="readiness.html">Readiness</a></strong><span>Expected validation gates</span></div>
        <div class="tile"><strong><a href="workspace.html">Workspace</a></strong><span>Repos and local docs</span></div>
        <div class="tile"><strong><a href="quality.html">Quality</a></strong><span>Canonical quality notes</span></div>
      </div>
    </section>
`);
}

async function plansView() {
  const planFiles = await files("ai/plans/active", ".md");
  const rows = [];
  for (const file of planFiles) {
    const content = await read(file);
    rows.push([
      `<code>${escapeHtml(file)}</code>`,
      escapeHtml(titleFromMarkdown(content, path.basename(file))),
      escapeHtml(frontMatterValue(content, "status") || "n/a"),
      escapeHtml(frontMatterValue(content, "risk") || "n/a"),
      escapeHtml(frontMatterValue(content, "autonomy") || "n/a"),
    ]);
  }
  return layout("Plans", table(["Source", "Title", "Status", "Risk", "Autonomy"], rows));
}

async function contractsView() {
  const contracts = await contractRecords();
  const rows = contracts.map((contract) => [
    escapeHtml(contract.title),
    code(contract.source),
    `${code(contract.manifestPath)} ${contract.manifestPresent ? pill("present", "ok") : pill("missing", "missing")}`,
    contract.manifestId ? code(contract.manifestId) : '<span class="muted">n/a</span>',
    contract.manifestName ? escapeHtml(contract.manifestName) : '<span class="muted">n/a</span>',
    list(contract.requiredFiles.map((item) => code(item))),
    list(contract.validation.map((item) => code(item))),
  ]);
  return layout("Contract Matrix", `
    <p>Contract rows are derived from ${code("ai/contracts/*.md")} and matching ${code("ai/contracts/*.contract.json")} manifests. No review status is invented here.</p>
    ${table(["Title", "Markdown Source", "Manifest", "Manifest ID", "Manifest Name", "Canonical Source Docs", "Validation Command"], rows)}
`);
}

async function qualityView() {
  const quality = await read("ai/QUALITY.md");
  const lines = quality.split(/\r?\n/).filter((line) => /^[-*]\s+/.test(line)).slice(0, 20);
  return layout("Quality", `
    <p>Source: <code>ai/QUALITY.md</code></p>
    <ul>${lines.map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>
`);
}

async function readinessView() {
  const readiness = await readinessRecords();
  const rows = readiness.map((gate) => [
    escapeHtml(gate.gate),
    code(gate.command),
    escapeHtml(gate.evidence),
    code(gate.source),
    gate.script ? `${code(gate.script)} ${gate.scriptExists ? pill("exists", "ok") : pill("missing", "missing")}` : '<span class="muted">manual or composite</span>',
    pill(gate.expectation, gate.expectation === "expected" ? "ok" : "warn"),
  ]);
  return layout("Readiness", `
    <p>Source: ${code("ai/READINESS.md")}. The cockpit shows expectations only; it does not run validation or record pass/fail results.</p>
    <p>Run ${code("node scripts/validate-governance.mjs")} and ${code("node scripts/check-workspace.mjs")} for authoritative local validation.</p>
    ${table(["Gate", "Command", "Required Evidence", "Source Doc", "Script", "Expectation"], rows)}
`);
}

async function workspaceView() {
  const workspaceFiles = await files("ai/workspace", ".md");
  const docRows = [];
  for (const file of workspaceFiles) {
    const content = await read(file);
    docRows.push([code(file), escapeHtml(titleFromMarkdown(content, path.basename(file)))]);
  }
  const consumerRows = consumerRecords().map((consumer) => [
    escapeHtml(consumer.name),
    code(consumer.path),
    escapeHtml(consumer.purpose),
    consumer.codexEnabled ? code(consumer.codexEntrypoint) : pill("disabled", "off"),
    consumer.claudeEnabled ? list(consumer.claudeEntrypoints.map((item) => code(item))) : pill("disabled", "off"),
    consumer.validation.length ? list(consumer.validation.map(([name, command]) => `${escapeHtml(name)}: ${code(command)}`)) : '<span class="muted">No configured commands</span>',
    `${consumer.codexEnabled ? pill("Codex expected", "ok") : pill("Codex disabled", "off")} ${consumer.claudeEnabled ? pill("Claude expected", "ok") : pill("Claude disabled", "off")}`,
    `Expected; verify with ${code("node scripts/check-workspace.mjs")}`,
  ]);
  return layout("Workspace", `
    <h2>Consumer Repo Matrix</h2>
    <p>These are Structor wiring facts from generated configuration, not live repo operations.</p>
    ${table(["Consumer", "Path", "Purpose", "Codex Entrypoint", "Claude Entrypoints", "Configured Validation", "Client Surfaces", "Pointer Status"], consumerRows)}
    <h2>Workspace Source Docs</h2>
    ${table(["Source", "Title"], docRows)}
`);
}

const outputs = {
  "index.html": await indexView(),
  "plans.html": await plansView(),
  "contracts.html": await contractsView(),
  "readiness.html": await readinessView(),
  "quality.html": await qualityView(),
  "workspace.html": await workspaceView(),
};

for (const [name] of Object.entries(outputs)) {
  await assertSafeWriteTarget({
    targetPath: path.join(viewsDir, name),
    rootPath: outputRoot,
    label: `HTML view ${path.join("ai/views", name)}`,
  });
}

await mkdir(viewsDir, { recursive: true });
for (const [name, content] of Object.entries(outputs)) {
  await writeFile(path.join(viewsDir, name), content);
}

console.log(`Generated ${Object.keys(outputs).length} HTML view(s).`);
