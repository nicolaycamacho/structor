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
const evidenceTableHeader = "| Dimension | State | Scope | Source evidence | Observed on | Method | Result | Limitations |";
const dimensions = ["Structural validity", "Verified knowledge", "Installation/adoption", "Observed effectiveness"];

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
  // Bounded observation results may contain measurements; they are not an
  // aggregate readiness score.
  const summary = content.split(/\r?\n/)
    .filter((line) => !dimensions.some((dimension) => line.startsWith(`| ${dimension} |`)))
    .join("\n");
  for (const pattern of scorePatterns) {
    if (pattern.test(summary)) {
      errors.push(`${relativePath} must not use a numeric readiness score.`);
      break;
    }
  }
}

const evidenceRows = tableRows(readiness, evidenceTableHeader).map(cells);
for (const dimension of dimensions) {
  const matching = evidenceRows.filter((row) => row[0] === dimension);
  if (matching.length !== 1) errors.push(`ai/READINESS.md must include exactly one evidence row for ${dimension}.`);
}
for (const row of evidenceRows) {
  const [dimension, state, ...fields] = row;
  const label = `ai/READINESS.md evidence for ${dimension}`;
  if (row.length !== 8 || !row.every(Boolean)) {
    errors.push(`${label} must contain all eight cells.`);
    continue;
  }
  if (!dimensions.includes(dimension)) errors.push(`${label} has an unsupported dimension.`);
  if (state === "unassessed") {
    if (fields.some((field) => field !== "Not observed")) errors.push(`${label}: unassessed fields must be Not observed.`);
  } else if (state === "recorded") {
    const names = ["Scope", "Source evidence", "Observed on", "Method", "Result", "Limitations"];
    fields.forEach((field, index) => {
      if (/\b(todo|tbd)\b|<[^>]+>|\{\{/.test(field.toLowerCase()) || /^(none|n\/a|unknown|not observed|-)$/i.test(field)) {
        errors.push(`${label}: ${names[index]} must contain observation evidence, not a placeholder.`);
      }
    });
    const date = fields[2];
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      errors.push(`${label}: Observed on must be a real YYYY-MM-DD date.`);
    }
  } else {
    errors.push(`${label}: State must be unassessed or recorded.`);
  }
}
for (const [relativePath, content] of readinessDocuments) {
  if (/\|\s*(Domain|Overall)\s*\|\s*Grade\s*\|/i.test(content) || /\boverall (?:quality )?grade\s*[:=]\s*[ABCDF]\b/i.test(content)) {
    errors.push(`${relativePath} must use independent evidence dimensions, not letter grades.`);
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

console.log("Readiness check passed (record contract only; not truth, adoption or effectiveness).");
