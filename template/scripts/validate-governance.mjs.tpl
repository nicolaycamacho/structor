#!/usr/bin/env node

import { access, constants as fsConstants } from "node:fs/promises";
import { execFileSync } from "node:child_process";
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
const mandatoryChecks = [
  "scripts/check-readiness.mjs",
  "scripts/check-issue-template.mjs",
  "scripts/check-knowledge-manifest.mjs",
  "scripts/check-plans.mjs",
  "scripts/check-review-skills.mjs",
  "scripts/check-garbage-collection.mjs",
  "scripts/check-contract-manifests.mjs",
  "scripts/check-html-views.mjs",
  "scripts/check-worktree-bootstrap-fixtures.mjs",
];
const optionalChecks = [
  "scripts/check-repo-name-consistency.mjs",
  "scripts/check-linear-contract.mjs",
  "scripts/check-contract-conformance.mjs",
  "scripts/check-domain-contract-matrix.mjs",
];
const checkCodexHooksScript = "scripts/check-codex-hooks.mjs";
const checkClaudeCompatibilityScript = "scripts/check-claude-compatibility.mjs";
const checkOverlayDriftScript = "scripts/check-overlay-drift.mjs";

async function exists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function runCheck(relativePath) {
  execFileSync(process.execPath, [path.join(repoRoot, relativePath)], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

await runCheck("scripts/check-template-governance.mjs");
await runCheck("scripts/check-task-template.mjs");

for (const check of mandatoryChecks) {
  await runCheck(check);
}

for (const optionalCheck of optionalChecks) {
  if (await exists(optionalCheck)) {
    await runCheck(optionalCheck);
  }
}

if (clientSupport.codexHooks) {
  await runCheck(checkCodexHooksScript);
}

if (models.anthropic) {
  await runCheck(checkClaudeCompatibilityScript);
}

if (models.openai || models.anthropic) {
  await runCheck(checkOverlayDriftScript);
}

console.log("Governance validation passed.");
