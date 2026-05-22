#!/usr/bin/env node

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

execFileSync(process.execPath, [path.join(repoRoot, "scripts/check-template-governance.mjs")], {
  cwd: repoRoot,
  stdio: "inherit",
});

execFileSync(process.execPath, [path.join(repoRoot, "scripts/check-task-template.mjs")], {
  cwd: repoRoot,
  stdio: "inherit",
});

for (const check of [
  "scripts/check-issue-template.mjs",
  "scripts/check-knowledge-manifest.mjs",
  "scripts/check-plans.mjs",
  "scripts/check-review-skills.mjs",
  "scripts/check-garbage-collection.mjs",
  "scripts/check-contract-manifests.mjs",
  "scripts/check-html-views.mjs",
  "scripts/check-worktree-bootstrap-fixtures.mjs",
]) {
  execFileSync(process.execPath, [path.join(repoRoot, check)], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

if (clientSupport.codexHooks) {
  execFileSync(process.execPath, [path.join(repoRoot, "scripts/check-codex-hooks.mjs")], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

if (models.anthropic) {
  execFileSync(process.execPath, [path.join(repoRoot, "scripts/check-claude-compatibility.mjs")], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

if (models.openai || models.anthropic) {
  execFileSync(process.execPath, [path.join(repoRoot, "scripts/check-overlay-drift.mjs")], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

console.log("Governance validation passed.");
