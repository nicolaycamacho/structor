#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const outputArgIndex = args.indexOf("--output");
const outputRoot = outputArgIndex === -1 ? repoRoot : path.resolve(args[outputArgIndex + 1]);
const viewsDir = path.join(outputRoot, "ai/views");

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

function layout(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - {{PROJECT_NAME}} Harness Views</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #172026; background: #f7f8fa; }
    header, main { max-width: 1080px; margin: 0 auto; padding: 24px; }
    header { border-bottom: 1px solid #d8dee4; background: #fff; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin-top: 28px; font-size: 18px; }
    p { line-height: 1.5; }
    a { color: #0969da; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d8dee4; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #d8dee4; text-align: left; vertical-align: top; }
    th { background: #eef2f6; font-size: 13px; }
    code { background: #eef2f6; padding: 2px 4px; border-radius: 4px; }
    .note { color: #57606a; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <p class="note">Generated review artifact. Markdown, JSON, and YAML files remain canonical.</p>
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
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

async function indexView() {
  return layout("Harness Review Views", `
    <h2>Views</h2>
    <ul>
      <li><a href="plans.html">Plans</a></li>
      <li><a href="contracts.html">Contracts</a></li>
      <li><a href="readiness.html">Readiness</a></li>
      <li><a href="quality.html">Quality</a></li>
      <li><a href="workspace.html">Workspace</a></li>
    </ul>
    <h2>Canonical Sources</h2>
    <p>Start from <code>ai/HUB.md</code>, <code>ai/context.md</code>, and <code>ai/knowledge-manifest.json</code>.</p>
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
  const contractFiles = await files("ai/contracts", ".md");
  const rows = [];
  for (const file of contractFiles.filter((item) => item !== "ai/contracts/README.md")) {
    const content = await read(file);
    rows.push([
      `<code>${escapeHtml(file)}</code>`,
      escapeHtml(titleFromMarkdown(content, path.basename(file))),
      `<code>${escapeHtml(file.replace(/\\.md$/, ".contract.json"))}</code>`,
    ]);
  }
  return layout("Contracts", table(["Source", "Title", "Manifest"], rows));
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
  const readiness = await read("ai/READINESS.md");
  const rows = [];
  const lines = readiness.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith("| Gate | Command | Required evidence |"));
  if (start !== -1) {
    for (const line of lines.slice(start + 2)) {
      if (!line.startsWith("|")) break;
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => escapeHtml(cell.trim().replaceAll("`", "")));
      if (cells.length === 3) rows.push(cells);
    }
  }
  return layout("Readiness", `
    <p>Source: <code>ai/READINESS.md</code></p>
    ${table(["Gate", "Command", "Required evidence"], rows)}
`);
}

async function workspaceView() {
  const workspaceFiles = await files("ai/workspace", ".md");
  const rows = [];
  for (const file of workspaceFiles) {
    const content = await read(file);
    rows.push([`<code>${escapeHtml(file)}</code>`, escapeHtml(titleFromMarkdown(content, path.basename(file)))]);
  }
  return layout("Workspace", table(["Source", "Title"], rows));
}

const outputs = {
  "index.html": await indexView(),
  "plans.html": await plansView(),
  "contracts.html": await contractsView(),
  "readiness.html": await readinessView(),
  "quality.html": await qualityView(),
  "workspace.html": await workspaceView(),
};

await mkdir(viewsDir, { recursive: true });
for (const [name, content] of Object.entries(outputs)) {
  await writeFile(path.join(viewsDir, name), content);
}

console.log(`Generated ${Object.keys(outputs).length} HTML view(s).`);
