#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const models = {
  openai: {{MODEL_OPENAI_ENABLED}},
  anthropic: {{MODEL_ANTHROPIC_ENABLED}},
};
const requiredFiles = [
  "README.md",
  "ai/AGENTS.md",
  "ai/HUB.md",
  "ai/context.md",
  "ai/HARNESS.md",
  "ai/HARNESS-ENGINEERING.md",
  "ai/QUALITY.md",
  "ai/DECISIONS.md",
  "ai/PRODUCT-SUMMARY.md",
  "ai/PRODUCT.md",
  "ai/ARCHITECTURE.md",
  "ai/DESIGN.md",
  "ai/WORKFLOW.md",
  "ai/RUNNER-SAFETY.md",
  "ai/RUNNER-READINESS.md",
  "ai/AGENT-GARBAGE-COLLECTION.md",
  "ai/contracts/README.md",
  "ai/contracts/repo-boundaries.md",
  "ai/contracts/app-legibility.md",
  "ai/contracts/api-boundary.md",
  "ai/contracts/security-boundary.md",
  "ai/templates/README.md",
  "ai/templates/task-brief-template.md",
  "ai/skills/README.md",
  "ai/skills/review-architecture.md",
  "ai/skills/review-security.md",
  "ai/skills/review-contract-drift.md",
  "ai/skills/review-governance-drift.md",
  "ai/plans/README.md",
  "ai/plans/tech-debt.md",
  "ai/specs/README.md",
  "scripts/bootstrap-workspace.mjs",
  "scripts/check-workspace.mjs",
  "scripts/validate-governance.mjs",
  "scripts/check-template-governance.mjs",
];

if (models.openai) {
  requiredFiles.push("AGENTS.md", "ai/model-overlays/openai/AGENTS.md", "workspace/AGENTS.md");
}

if (models.anthropic) {
  requiredFiles.push(
    "CLAUDE.md",
    ".claude/CLAUDE.md",
    ".claude/settings.json",
    "ai/model-overlays/anthropic/CLAUDE.md",
    "workspace/CLAUDE.md",
    "workspace/.claude/CLAUDE.md",
    "workspace/.claude/settings.json",
  );
}

async function exists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const errors = [];
for (const relativePath of requiredFiles) {
  if (!(await exists(relativePath))) errors.push(`missing ${relativePath}`);
}

for (const relativePath of requiredFiles.filter((item) => item.endsWith(".md"))) {
  const content = await readFile(path.join(repoRoot, relativePath), "utf8");
  if (/\{\{[A-Z0-9_]+\}\}/.test(content)) {
    errors.push(`${relativePath} contains an unresolved template placeholder.`);
  }
}

if (errors.length > 0) {
  console.error("Generated harness governance check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Generated harness governance check passed.");
