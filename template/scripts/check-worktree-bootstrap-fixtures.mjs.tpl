#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRepairPlan,
  classifyWorktreeBootstrap,
  models,
  parseWorktreeListPorcelain,
  requiredPointerFiles,
  renderPointerFile,
} from "./lib/worktree-bootstrap.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const harnessRoot = "/workspace/{{HARNESS_REPO_NAME}}";
const consumerRoot = "/workspace/{{PRIMARY_CONSUMER_NAME}}";
const workspaceAgentsPath = "AGENTS.md";
const workspaceClaudePath = "CLAUDE.md";
const workspaceCodexPath = ".codex/hooks.json";
const stateValid = "valid";
const stateMissing = "missing";
const stateStaleRelative = "stale_relative";
const stateWrongHarnessRoot = "wrong_harness_root";
const stateUnsupportedRepo = "unsupported_repo";
const stateMissingPath = "missing_path";
const stateDetached = "detached";
const statePrunable = "prunable";
const fixturePathPrefix = "scripts/fixtures/worktrees";
const fixturesMissingPathSuffix = "missing-path";
const tempConsumerRoot = "/tmp/{{PRIMARY_CONSUMER_NAME}}";
const testCaseTemplateConsumer = "{{PRIMARY_CONSUMER_NAME}}";
const invalidHarnessRoot = "Read ../{{HARNESS_REPO_NAME}}/AGENTS.md before editing.";
const wrongHarnessRootPointer = `Read /other/{{HARNESS_REPO_NAME}}/AGENTS.md before editing.`;
const harnessFiles = new Set([
  ...(models.openai ? ["AGENTS.md"] : []),
  ...(models.anthropic ? ["CLAUDE.md"] : []),
  "ai/AGENTS.md",
  "ai/HUB.md",
  "ai/context.md",
]);

function files(entries) {
  return [...requiredPointerFiles, workspaceCodexPath].map((relativePath) => ({
    relativePath,
    exists: Object.hasOwn(entries, relativePath),
    content: entries[relativePath] ?? "",
  }));
}

async function fileIsFile(filePath) {
  const relativePath = path.relative(harnessRoot, filePath).replaceAll(path.sep, "/");
  return harnessFiles.has(relativePath);
}

const validAgentPointer = `Read ${harnessRoot}/AGENTS.md before editing.`;
const validClaudePointer = `Read ${harnessRoot}/CLAUDE.md before editing.`;
const mixedAgentPointer = models.openai
  ? `Read ${harnessRoot}/AGENTS.md and ${harnessRoot}/ai/MISSING.md before editing.`
  : `Read ${harnessRoot}/CLAUDE.md and ${harnessRoot}/ai/MISSING.md before editing.`;
const staleAgentPointer = invalidHarnessRoot;
const validPointers = {
  ...(models.openai ? { [workspaceAgentsPath]: validAgentPointer } : {}),
  ...(models.anthropic ? { [workspaceClaudePath]: validClaudePointer } : {}),
};
const mixedPointers = models.openai
  ? {
      [workspaceAgentsPath]: mixedAgentPointer,
      ...(models.anthropic ? { [workspaceClaudePath]: validClaudePointer } : {}),
    }
  : {
      [workspaceClaudePath]: mixedAgentPointer,
    };
const stalePointers = Object.fromEntries(requiredPointerFiles.map((relativePath) => [relativePath, staleAgentPointer]));
const wrongRootPointers = Object.fromEntries(requiredPointerFiles.map((relativePath) => [relativePath, wrongHarnessRootPointer]));

const cases = [
  { name: "valid", targetPath: consumerRoot, repoName: testCaseTemplateConsumer, targetExists: true, files: files(validPointers), expectedState: stateValid, expectedValid: true, expectedRepairable: false },
  { name: "missing", targetPath: consumerRoot, repoName: testCaseTemplateConsumer, targetExists: true, files: files({}), expectedState: stateMissing, expectedValid: false, expectedRepairable: true },
  { name: "stale_relative", targetPath: tempConsumerRoot, repoName: testCaseTemplateConsumer, targetExists: true, files: files(stalePointers), expectedState: stateStaleRelative, expectedValid: false, expectedRepairable: true },
  { name: "wrong_harness_root", targetPath: consumerRoot, repoName: testCaseTemplateConsumer, targetExists: true, files: files(wrongRootPointers), expectedState: stateWrongHarnessRoot, expectedValid: false, expectedRepairable: true },
  { name: "unsupported_repo", targetPath: "/workspace/random-app", repoName: null, targetExists: true, files: files({ [workspaceAgentsPath]: validAgentPointer }), expectedState: stateUnsupportedRepo, expectedValid: false, expectedRepairable: false },
  { name: "missing_path", targetPath: path.join(repoRoot, `${fixturePathPrefix}/${fixturesMissingPathSuffix}`), repoName: testCaseTemplateConsumer, targetExists: false, files: files({}), expectedState: stateMissingPath, expectedValid: false, expectedRepairable: false },
  { name: "detached", targetPath: tempConsumerRoot, repoName: testCaseTemplateConsumer, targetExists: true, files: files(validPointers), worktreeRecord: { detached: true }, expectedState: stateDetached, expectedValid: true, expectedRepairable: false },
  { name: "prunable", targetPath: tempConsumerRoot, repoName: testCaseTemplateConsumer, targetExists: true, files: files({ [workspaceAgentsPath]: validAgentPointer }), worktreeRecord: { prunable: true }, expectedState: statePrunable, expectedValid: false, expectedRepairable: false },
];

for (const testCase of cases) {
  const result = await classifyWorktreeBootstrap({
    targetPath: testCase.targetPath,
    targetExists: testCase.targetExists,
    harnessRoot,
    repoName: testCase.repoName,
    files: testCase.files,
    worktreeRecord: testCase.worktreeRecord ?? {},
    fileIsFile,
  });
  assert.equal(result.state, testCase.expectedState, testCase.name);
  assert.equal(result.valid, testCase.expectedValid, testCase.name);
  assert.equal(result.repairable, testCase.expectedRepairable, testCase.name);
  if (result.repairable) assert.equal(buildRepairPlan({ inspection: result, harnessRoot }).writes.length > 0, true, testCase.name);
}

const mixedResult = await classifyWorktreeBootstrap({
  targetPath: consumerRoot,
  targetExists: true,
  harnessRoot,
  repoName: testCaseTemplateConsumer,
  files: files(mixedPointers),
  fileIsFile,
});
assert.equal(mixedResult.valid, false, "mixed_references");
assert.equal(mixedResult.repairable, true, "mixed_references");
assert.equal(mixedResult.state, stateMissing, "mixed_references");

const pointerPattern = new RegExp(`{{HARNESS_REPO_NAME}}/${models.openai ? "AGENTS" : "CLAUDE"}\\.md`);
const worktreePorcelainOutput = "worktree /repo/main\nHEAD abc\nbranch refs/heads/main\n\nworktree /repo/detached\nHEAD def\ndetached\n";

assert.match(renderPointerFile({ relativePath: requiredPointerFiles[0], harnessRoot, repoName: testCaseTemplateConsumer }), pointerPattern);
assert.equal(parseWorktreeListPorcelain(worktreePorcelainOutput).length, 2);

console.log("Worktree bootstrap fixture check passed.");
