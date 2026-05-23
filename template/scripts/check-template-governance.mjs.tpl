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
const clientSupport = {
  codexHooks: {{CLIENT_CODEX_HOOKS_ENABLED}},
  claudeRules: {{CLIENT_CLAUDE_RULES_ENABLED}},
  claudeHooks: {{CLIENT_CLAUDE_HOOKS_ENABLED}},
  claudeSkills: {{CLIENT_CLAUDE_SKILLS_ENABLED}},
};
const requiredFiles = [
  "README.md",
  "ai/AGENTS.md",
  "ai/HUB.md",
  "ai/context.md",
  "ai/HARNESS.md",
  "ai/HARNESS-ENGINEERING.md",
  "ai/READINESS.md",
  "ai/QUALITY.md",
  "ai/DECISIONS.md",
  "ai/PRODUCT-SUMMARY.md",
  "ai/PRODUCT.md",
  "ai/ARCHITECTURE.md",
  "ai/DESIGN.md",
  "ai/WORKFLOW.md",
  "ai/VERSIONING.md",
  "ai/CODEX-HOOKS.md",
  "ai/RUNNER-SAFETY.md",
  "ai/RUNNER-READINESS.md",
  "ai/AGENT-GARBAGE-COLLECTION.md",
  "ai/knowledge-manifest.json",
  "ai/workspace/REPOS.md",
  "ai/workspace/SYSTEM-MAP.md",
  "ai/workspace/SESSION-BOOTSTRAP.md",
  "ai/workspace/LOCAL-STACK.md",
  "ai/workspace/TEST-STRATEGY.md",
  "ai/contracts/README.md",
  "ai/contracts/repo-boundaries.md",
  "ai/contracts/repo-boundaries.contract.json",
  "ai/contracts/app-legibility.md",
  "ai/contracts/app-legibility.contract.json",
  "ai/contracts/api-boundary.md",
  "ai/contracts/api-boundary.contract.json",
  "ai/contracts/security-boundary.md",
  "ai/contracts/security-boundary.contract.json",
  "ai/contracts/codex-hooks.md",
  "ai/contracts/release-flow.md",
  "ai/contracts/release-flow.contract.json",
  "ai/contracts/github-safety.md",
  "ai/contracts/github-safety.contract.json",
  "ai/templates/README.md",
  "ai/templates/task-brief-template.md",
  "ai/templates/issue-template.md",
  "ai/templates/fixtures/issues/valid-ready.md",
  "ai/templates/fixtures/issues/invalid-placeholder.md",
  "ai/templates/fixtures/issues/invalid-protected-surface.md",
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
  "scripts/check-readiness.mjs",
  "scripts/check-task-template.mjs",
  "scripts/check-issue-template.mjs",
  "scripts/check-knowledge-manifest.mjs",
  "scripts/check-plans.mjs",
  "scripts/check-review-skills.mjs",
  "scripts/check-garbage-collection.mjs",
  "scripts/check-contract-manifests.mjs",
  "scripts/generate-html-views.mjs",
  "scripts/check-html-views.mjs",
  "scripts/bootstrap-codex-worktree.mjs",
  "scripts/check-worktrees.mjs",
  "scripts/check-worktree-bootstrap-fixtures.mjs",
  "scripts/lib/worktree-bootstrap.mjs",
  "scripts/fixtures/worktrees/README.md",
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
    "scripts/check-claude-compatibility.mjs",
  );
}

if (clientSupport.codexHooks) {
  requiredFiles.push(
    ".codex/hooks.json",
    "ai/contracts/codex-hooks.contract.json",
    "scripts/check-codex-hooks.mjs",
    "scripts/hooks/codex-hook.mjs",
    "scripts/hooks/lib/codex-hooks-core.mjs",
  );
}

if (clientSupport.claudeRules) {
  requiredFiles.push(".claude/rules/harness-client-surfaces.md", "workspace/.claude/rules/harness-client-surfaces.md");
}

if (models.openai || models.anthropic) {
  requiredFiles.push("scripts/check-overlay-drift.mjs");
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
