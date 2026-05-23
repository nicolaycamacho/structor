#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(repoRoot, "..");
const harnessRepoName = "{{HARNESS_REPO_NAME}}";
const consumers = {{CONSUMER_CONFIG_JSON}};
const models = {
  openai: {{MODEL_OPENAI_ENABLED}},
  anthropic: {{MODEL_ANTHROPIC_ENABLED}},
};
const clientSupport = {
  codexHooks: {{CLIENT_CODEX_HOOKS_ENABLED}},
  claudeRules: {{CLIENT_CLAUDE_RULES_ENABLED}},
};

const repoRequiredFiles = [
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
  "ai/templates/README.md",
  "ai/skills/README.md",
  "ai/specs/README.md",
  "scripts/bootstrap-workspace.mjs",
  "scripts/check-workspace.mjs",
  "scripts/validate-governance.mjs",
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
];

if (models.openai) {
  repoRequiredFiles.push("AGENTS.md", "ai/model-overlays/openai/AGENTS.md", "scripts/check-overlay-drift.mjs");
}

if (models.anthropic) {
  repoRequiredFiles.push(
    "CLAUDE.md",
    ".claude/CLAUDE.md",
    ".claude/settings.json",
    "ai/model-overlays/anthropic/CLAUDE.md",
    "scripts/check-claude-compatibility.mjs",
    "scripts/check-overlay-drift.mjs",
  );
}

if (clientSupport.codexHooks) {
  repoRequiredFiles.push(".codex/hooks.json", "scripts/check-codex-hooks.mjs", "scripts/hooks/codex-hook.mjs");
}

if (clientSupport.claudeRules) {
  repoRequiredFiles.push(".claude/rules/harness-client-surfaces.md");
}

const workspaceRequiredFiles = [];
if (models.openai) workspaceRequiredFiles.push("AGENTS.md");
if (models.anthropic) workspaceRequiredFiles.push("CLAUDE.md", ".claude/CLAUDE.md", ".claude/settings.json");
if (clientSupport.claudeRules) workspaceRequiredFiles.push(".claude/rules/harness-client-surfaces.md");

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function collectMissing(basePath, relativePaths, prefix) {
  const missing = [];
  for (const relativePath of relativePaths) {
    if (!(await exists(path.join(basePath, relativePath)))) {
      missing.push(`${prefix}:${relativePath}`);
    }
  }
  return missing;
}

async function fileIncludes(filePath, needle) {
  if (!(await exists(filePath))) return false;
  return (await readFile(filePath, "utf8")).includes(needle);
}

async function main() {
  const missing = [];
  if (path.basename(repoRoot) !== harnessRepoName) {
    missing.push(`repo folder name: expected ${harnessRepoName}, found ${path.basename(repoRoot)}`);
  }

  missing.push(...(await collectMissing(repoRoot, repoRequiredFiles, "repo")));
  missing.push(...(await collectMissing(workspaceRoot, workspaceRequiredFiles, "workspace")));

  for (const consumer of consumers) {
    const consumerRoot = path.resolve(workspaceRoot, consumer.workspacePath);
    if (!(await exists(consumerRoot))) {
      missing.push(`consumer:${consumer.name}:missing repo at ${consumerRoot}`);
      continue;
    }
    if (models.openai && !(await fileIncludes(path.join(consumerRoot, "AGENTS.md"), harnessRepoName))) {
      missing.push(`consumer:${consumer.name}:AGENTS.md missing or not routed to ${harnessRepoName}`);
    }
    if (models.anthropic && !(await fileIncludes(path.join(consumerRoot, "CLAUDE.md"), harnessRepoName))) {
      missing.push(`consumer:${consumer.name}:CLAUDE.md missing or not routed to ${harnessRepoName}`);
    }
    if (models.anthropic && !(await fileIncludes(path.join(consumerRoot, ".claude", "CLAUDE.md"), "CLAUDE.md"))) {
      missing.push(`consumer:${consumer.name}:.claude/CLAUDE.md missing or not routed to root CLAUDE.md`);
    }
  }

  if (missing.length > 0) {
    console.error("Workspace bootstrap check failed.");
    for (const item of missing) console.error(`- ${item}`);
    process.exit(1);
  }

  console.log("Workspace layout check passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
