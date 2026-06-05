#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertReferencesHarnessRoot } from "./lib/worktree-bootstrap.mjs";
import {
  consumerEntrypointsForSettings,
  requiredHarnessRepoFilesForWorkspaceCheck,
  requiredWorkspaceFilesForWorkspaceCheck,
  workspaceEntrypointsForSettings,
} from "./generated-harness-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(repoRoot, {{WORKSPACE_ROOT_FROM_HARNESS_JSON}});
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
const settings = { models, clientSupport };
const harnessRepoNameError = "repo folder name: expected";
const missingEntryPrefix = "missing ";
const repoRequiredFiles = requiredHarnessRepoFilesForWorkspaceCheck(settings);
const workspaceRequiredFiles = requiredWorkspaceFilesForWorkspaceCheck(settings);
const workspaceRoutingEntrypoints = workspaceEntrypointsForSettings(settings).filter(
  (entrypoint) => entrypoint.routing !== "presence",
);
const consumerRoutingEntrypoints = consumerEntrypointsForSettings(settings);

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

async function readIfExists(filePath) {
  if (!(await exists(filePath))) return null;
  return readFile(filePath, "utf8");
}

async function collectHarnessRoutingIssue({ basePath, relativePath, expectedHarnessRoot }) {
  const pointerPath = path.join(basePath, relativePath);
  const pointerContent = await readIfExists(pointerPath);
  if (pointerContent === null) return `${relativePath} missing.`;
  return assertReferencesHarnessRoot({
    pointerPath: relativePath,
    pointerContent,
    consumerRoot: basePath,
    expectedHarnessRoot,
    models,
  });
}

async function collectClaudeMemoryRoutingIssue({ basePath, relativePath }) {
  const pointerPath = path.join(basePath, relativePath);
  const pointerContent = await readIfExists(pointerPath);
  if (pointerContent === null) return `${relativePath} missing.`;
  if (!pointerContent.includes("../CLAUDE.md")) {
    return `${relativePath} must route through ../CLAUDE.md.`;
  }
  return assertReferencesHarnessRoot({
    pointerPath: relativePath,
    pointerContent,
    consumerRoot: basePath,
    expectedHarnessRoot: repoRoot,
    models,
    requireHarnessReference: false,
  });
}

async function collectEntrypointRoutingIssue({ basePath, entrypoint, expectedHarnessRoot }) {
  if (entrypoint.routing === "claude-memory") {
    return collectClaudeMemoryRoutingIssue({ basePath, relativePath: entrypoint.path });
  }
  return collectHarnessRoutingIssue({ basePath, relativePath: entrypoint.path, expectedHarnessRoot });
}

async function main() {
  const missing = [];
  if (path.basename(repoRoot) !== harnessRepoName) {
    missing.push(`${harnessRepoNameError} ${harnessRepoName}, found ${path.basename(repoRoot)}`);
  }

  missing.push(...(await collectMissing(repoRoot, repoRequiredFiles, "repo")));
  missing.push(...(await collectMissing(workspaceRoot, workspaceRequiredFiles, "workspace")));

  for (const entrypoint of workspaceRoutingEntrypoints) {
    const issue = await collectEntrypointRoutingIssue({ basePath: workspaceRoot, entrypoint, expectedHarnessRoot: repoRoot });
    if (issue) missing.push(`workspace:${issue}`);
  }

  for (const consumer of consumers) {
    const consumerRoot = path.resolve(workspaceRoot, consumer.workspacePath);
    if (!(await exists(consumerRoot))) {
      missing.push(`consumer:${consumer.name}:missing repo at ${consumerRoot}`);
      continue;
    }
    for (const entrypoint of consumerRoutingEntrypoints) {
      const issue = await collectEntrypointRoutingIssue({ basePath: consumerRoot, entrypoint, expectedHarnessRoot: repoRoot });
      if (issue) missing.push(`consumer:${consumer.name}:${issue}`);
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
