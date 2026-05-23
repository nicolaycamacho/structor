#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const models = {
  openai: {{MODEL_OPENAI_ENABLED}},
  anthropic: {{MODEL_ANTHROPIC_ENABLED}},
};
const clientSupport = {
  codexHooks: {{CLIENT_CODEX_HOOKS_ENABLED}},
};

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
const quality = await read("ai/QUALITY.md");
const errors = [];

for (const verdict of ["PASS", "FAIL", "MANUAL REVIEW REQUIRED"]) {
  if (!readiness.includes(verdict)) {
    errors.push(`ai/READINESS.md must define the ${verdict} verdict.`);
  }
}

const requiredCommands = [
  "node scripts/validate-governance.mjs",
  "node scripts/bootstrap-workspace.mjs --dry-run",
  "node scripts/bootstrap-workspace.mjs",
  "node scripts/check-workspace.mjs",
];
if (models.openai || models.anthropic) requiredCommands.push("node scripts/check-overlay-drift.mjs");
if (clientSupport.codexHooks) requiredCommands.push("node scripts/check-codex-hooks.mjs");
if (models.anthropic) requiredCommands.push("node scripts/check-claude-compatibility.mjs");

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
for (const [relativePath, content] of [
  ["ai/READINESS.md", readiness],
  ["ai/QUALITY.md", quality],
]) {
  for (const pattern of scorePatterns) {
    if (pattern.test(content)) {
      errors.push(`${relativePath} must not use a numeric readiness score.`);
      break;
    }
  }
}

const qualityRows = tableRows(quality, "| Domain | Grade | Evidence | Enforced by | Blocking gaps |");
if (qualityRows.length === 0) {
  errors.push("ai/QUALITY.md must include the readiness scorecard table.");
}

for (const row of qualityRows) {
  const [domain, grade, evidence, enforcedBy, blockingGaps] = cells(row);
  if (![domain, grade, evidence, enforcedBy, blockingGaps].every(Boolean)) {
    errors.push(`ai/QUALITY.md has an incomplete scorecard row: ${row}`);
    continue;
  }
  if (!/^(A|B|C|D|F|Manual|N\/A)$/.test(grade)) {
    errors.push(`ai/QUALITY.md has unsupported grade "${grade}" for ${domain}.`);
  }
  for (const [label, value] of [
    ["Evidence", evidence],
    ["Enforced by", enforcedBy],
    ["Blocking gaps", blockingGaps],
  ]) {
    if (/^(todo|tbd|none)$/i.test(value)) {
      errors.push(`ai/QUALITY.md ${label} for ${domain} must be evidence-based, not "${value}".`);
    }
  }
}

if (!quality.includes("ai/READINESS.md") || !quality.includes("scripts/check-readiness.mjs")) {
  errors.push("ai/QUALITY.md must link readiness evidence to ai/READINESS.md and scripts/check-readiness.mjs.");
}

if (errors.length > 0) {
  console.error("Readiness check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Readiness check passed.");
