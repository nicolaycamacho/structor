#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profile = {{HARNESS_PROFILE_JSON}};
const models = {
  openai: {{MODEL_OPENAI_ENABLED}},
  anthropic: {{MODEL_ANTHROPIC_ENABLED}},
};
const clientSupport = {
  codexHooks: {{CLIENT_CODEX_HOOKS_ENABLED}},
};
const requiredVerdicts = ["PASS", "FAIL", "MANUAL REVIEW REQUIRED"];
const readinessCommands = {
  validateGovernance: "node scripts/validate-governance.mjs",
  bootstrapWorkspaceDryRun: "node scripts/bootstrap-workspace.mjs --dry-run",
  bootstrapWorkspace: "node scripts/bootstrap-workspace.mjs",
  checkWorkspace: "node scripts/check-workspace.mjs",
  checkOverlayDrift: "node scripts/check-overlay-drift.mjs",
  checkCodexHooks: "node scripts/check-codex-hooks.mjs",
  checkClaudeCompatibility: "node scripts/check-claude-compatibility.mjs",
};
const qualityTableHeader = "| Domain | Grade | Evidence | Enforced by | Blocking gaps |";
const gradePattern = /^(A|B|C|D|F|Manual|N\/A)$/;
const placeholderPattern = /^(todo|tbd|none)$/i;

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function tableRows(markdown, headerPrefix) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(headerPrefix));
  if (start === -1) return [];
  const rows = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith("|")) break;
    rows.push(line);
  }
  return rows;
}

function cells(row) {
  return row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

const readiness = await read("ai/READINESS.md");
const quality = profile === "expanded" ? await read("ai/QUALITY.md") : null;
const errors = [];

for (const verdict of requiredVerdicts) {
  if (!readiness.includes(verdict)) {
    errors.push(`ai/READINESS.md must define the ${verdict} verdict.`);
  }
}

const requiredCommands = [
  readinessCommands.validateGovernance,
  readinessCommands.bootstrapWorkspaceDryRun,
  readinessCommands.bootstrapWorkspace,
  readinessCommands.checkWorkspace,
];
if (profile === "expanded" && (models.openai || models.anthropic)) requiredCommands.push(readinessCommands.checkOverlayDrift);
if (clientSupport.codexHooks) requiredCommands.push(readinessCommands.checkCodexHooks);
if (profile === "expanded" && models.anthropic) requiredCommands.push(readinessCommands.checkClaudeCompatibility);

for (const command of requiredCommands) {
  if (!readiness.includes(command)) {
    errors.push(`ai/READINESS.md must list required command: ${command}`);
  }
}

const scorePatterns = [
  /\b\d{1,3}\s*%/,
  /\b\d+\s*\/\s*100\b/,
  /\breadiness score\s*[:=]\s*\d+/i,
];
const readinessDocuments = [["ai/READINESS.md", readiness]];
if (quality !== null) readinessDocuments.push(["ai/QUALITY.md", quality]);
for (const [relativePath, content] of readinessDocuments) {
  for (const pattern of scorePatterns) {
    if (pattern.test(content)) {
      errors.push(`${relativePath} must not use a numeric readiness score.`);
      break;
    }
  }
}

const qualityRows = quality === null ? [] : tableRows(quality, qualityTableHeader);
if (profile === "expanded" && qualityRows.length === 0) {
  errors.push("ai/QUALITY.md must include the readiness scorecard table.");
}

for (const row of qualityRows) {
  const [domain, grade, evidence, enforcedBy, blockingGaps] = cells(row);
  if (![domain, grade, evidence, enforcedBy, blockingGaps].every(Boolean)) {
    errors.push(`ai/QUALITY.md has an incomplete scorecard row: ${row}`);
    continue;
  }
  if (!gradePattern.test(grade)) {
    errors.push(`ai/QUALITY.md has unsupported grade "${grade}" for ${domain}.`);
  }
  for (const [label, value] of [
    ["Evidence", evidence],
    ["Enforced by", enforcedBy],
    ["Blocking gaps", blockingGaps],
  ]) {
    if (placeholderPattern.test(value)) {
      errors.push(`ai/QUALITY.md ${label} for ${domain} must be evidence-based, not "${value}".`);
    }
  }
}

if (quality !== null && (!quality.includes("ai/READINESS.md") || !quality.includes("scripts/check-readiness.mjs"))) {
  errors.push("ai/QUALITY.md must link readiness evidence to ai/READINESS.md and scripts/check-readiness.mjs.");
}

if (errors.length > 0) {
  console.error("Readiness check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Readiness check passed.");
