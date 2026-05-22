#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRepairPlan,
  classifyWorktreeBootstrap,
  parseWorktreeListPorcelain,
  renderPointerFile,
} from "./lib/worktree-bootstrap.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const harnessRoot = "/workspace/{{HARNESS_REPO_NAME}}";
const consumerRoot = "/workspace/{{PRIMARY_CONSUMER_NAME}}";

function files(entries) {
  return ["AGENTS.md", "CLAUDE.md", ".codex/hooks.json"].map((relativePath) => ({
    relativePath,
    exists: Object.hasOwn(entries, relativePath),
    content: entries[relativePath] ?? "",
  }));
}

const validAgentPointer = `Read ${harnessRoot}/AGENTS.md before editing.`;
const validClaudePointer = `Read ${harnessRoot}/CLAUDE.md before editing.`;
const staleAgentPointer = `Read ../{{HARNESS_REPO_NAME}}/AGENTS.md before editing.`;
const wrongAgentPointer = `Read /other/{{HARNESS_REPO_NAME}}/AGENTS.md before editing.`;

const cases = [
  { name: "valid", targetPath: consumerRoot, repoName: "{{PRIMARY_CONSUMER_NAME}}", targetExists: true, files: files({ "AGENTS.md": validAgentPointer, "CLAUDE.md": validClaudePointer }), expectedState: "valid", expectedValid: true, expectedRepairable: false },
  { name: "missing", targetPath: consumerRoot, repoName: "{{PRIMARY_CONSUMER_NAME}}", targetExists: true, files: files({}), expectedState: "missing", expectedValid: false, expectedRepairable: true },
  { name: "stale_relative", targetPath: "/tmp/{{PRIMARY_CONSUMER_NAME}}", repoName: "{{PRIMARY_CONSUMER_NAME}}", targetExists: true, files: files({ "AGENTS.md": staleAgentPointer, "CLAUDE.md": staleAgentPointer }), expectedState: "stale_relative", expectedValid: false, expectedRepairable: true },
  { name: "wrong_harness_root", targetPath: consumerRoot, repoName: "{{PRIMARY_CONSUMER_NAME}}", targetExists: true, files: files({ "AGENTS.md": wrongAgentPointer, "CLAUDE.md": wrongAgentPointer }), expectedState: "wrong_harness_root", expectedValid: false, expectedRepairable: true },
  { name: "unsupported_repo", targetPath: "/workspace/random-app", repoName: null, targetExists: true, files: files({ "AGENTS.md": validAgentPointer }), expectedState: "unsupported_repo", expectedValid: false, expectedRepairable: false },
  { name: "missing_path", targetPath: path.join(repoRoot, "scripts/fixtures/worktrees/missing-path"), repoName: "{{PRIMARY_CONSUMER_NAME}}", targetExists: false, files: files({}), expectedState: "missing_path", expectedValid: false, expectedRepairable: false },
  { name: "detached", targetPath: "/tmp/{{PRIMARY_CONSUMER_NAME}}", repoName: "{{PRIMARY_CONSUMER_NAME}}", targetExists: true, files: files({ "AGENTS.md": validAgentPointer, "CLAUDE.md": validClaudePointer }), worktreeRecord: { detached: true }, expectedState: "detached", expectedValid: true, expectedRepairable: false },
  { name: "prunable", targetPath: "/tmp/{{PRIMARY_CONSUMER_NAME}}", repoName: "{{PRIMARY_CONSUMER_NAME}}", targetExists: true, files: files({ "AGENTS.md": validAgentPointer }), worktreeRecord: { prunable: true }, expectedState: "prunable", expectedValid: false, expectedRepairable: false },
];

for (const testCase of cases) {
  const result = classifyWorktreeBootstrap({
    targetPath: testCase.targetPath,
    targetExists: testCase.targetExists,
    harnessRoot,
    repoName: testCase.repoName,
    files: testCase.files,
    worktreeRecord: testCase.worktreeRecord ?? {},
  });
  assert.equal(result.state, testCase.expectedState, testCase.name);
  assert.equal(result.valid, testCase.expectedValid, testCase.name);
  assert.equal(result.repairable, testCase.expectedRepairable, testCase.name);
  if (result.repairable) assert.equal(buildRepairPlan({ inspection: result, harnessRoot }).writes.length > 0, true, testCase.name);
}

assert.match(renderPointerFile({ relativePath: "AGENTS.md", harnessRoot, repoName: "{{PRIMARY_CONSUMER_NAME}}" }), /{{HARNESS_REPO_NAME}}\/AGENTS\.md/);
assert.equal(parseWorktreeListPorcelain("worktree /repo/main\nHEAD abc\nbranch refs/heads/main\n\nworktree /repo/detached\nHEAD def\ndetached\n").length, 2);

console.log("Worktree bootstrap fixture check passed.");
