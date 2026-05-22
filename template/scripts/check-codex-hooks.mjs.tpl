#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { denyRules } from "./hooks/lib/codex-hooks-core.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedEvents = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "Stop",
];

const fixtures = [
  {
    name: "session-start-context",
    event: "SessionStart",
    input: { cwd: repoRoot },
    expectedAction: "context",
    expectedExitCode: 0,
  },
  {
    name: "prompt-implementation-context",
    event: "UserPromptSubmit",
    input: { prompt: "implement the next task" },
    expectedAction: "context",
    expectedExitCode: 0,
  },
  {
    name: "destructive-command-deny",
    event: "PreToolUse",
    input: { toolInput: { cmd: "git reset --hard HEAD" } },
    expectedAction: "deny",
    expectedExitCode: 2,
  },
  {
    name: "failed-validation-context",
    event: "PostToolUse",
    input: { command: "node scripts/validate-governance.mjs", exitCode: 1 },
    expectedAction: "context",
    expectedExitCode: 0,
  },
  {
    name: "stop-no-change-allow",
    event: "Stop",
    input: { changedFiles: [] },
    expectedAction: "allow",
    expectedExitCode: 0,
  },
  {
    name: "malformed-input-context",
    event: "PreToolUse",
    rawInput: "{not json",
    expectedAction: "context",
    expectedExitCode: 0,
  },
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

function hookCommandFor(event) {
  return `node scripts/hooks/codex-hook.mjs ${event}`;
}

async function checkConfig(errors) {
  const config = await readJson(".codex/hooks.json");
  if (config.version !== 1) errors.push(".codex/hooks.json must set version: 1.");
  for (const event of expectedEvents) {
    const entries = config.hooks?.[event];
    if (!Array.isArray(entries) || entries.length === 0) {
      errors.push(`.codex/hooks.json missing ${event} hook entry.`);
      continue;
    }
    const commands = entries.flatMap((entry) => (entry.hooks ?? []).map((hook) => hook.command));
    const expectedCommand = hookCommandFor(event);
    if (!commands.includes(expectedCommand)) {
      errors.push(`${event} must reference committed command '${expectedCommand}'.`);
    }
    for (const entry of entries) {
      if (entry.timeoutMs && entry.timeoutMs > 2000) errors.push(`${event} timeoutMs must be 2000 or less.`);
    }
  }
}

async function checkHookScripts(errors) {
  const hooksDir = path.join(repoRoot, "scripts/hooks");
  const files = (await readdir(hooksDir, { recursive: true }))
    .filter((file) => file.endsWith(".mjs"))
    .map((file) => `scripts/hooks/${file}`);
  const bannedPatterns = [
    { pattern: /node:child_process|from\s+["']child_process["']/i, label: "process supervision" },
    { pattern: /\b(fetch|XMLHttpRequest)\s*\(/, label: "network call" },
    { pattern: /from\s+["']node:fs\/promises["']|from\s+["']fs\/promises["']/i, label: "file-system write-capable import" },
    { pattern: /\b(writeFile|appendFile|mkdir|rm|unlink|rmdir)\s*\(/, label: "file mutation" },
  ];
  for (const relativePath of files) {
    const source = await readFile(path.join(repoRoot, relativePath), "utf8");
    for (const banned of bannedPatterns) {
      if (banned.pattern.test(source)) {
        errors.push(`${relativePath} contains ${banned.label} token. Hook scripts must stay deterministic and local.`);
      }
    }
  }
}

function checkDenyRules(errors) {
  for (const rule of denyRules) {
    for (const field of ["id", "prevents", "remediation", "falsePositiveNote"]) {
      if (!rule[field]) errors.push(`deny rule missing ${field}.`);
    }
    if (!Array.isArray(rule.policyDocs) || rule.policyDocs.length === 0) {
      errors.push(`${rule.id ?? "deny rule"} missing policyDocs.`);
    }
    if (!(rule.pattern instanceof RegExp)) {
      errors.push(`${rule.id ?? "deny rule"} missing RegExp pattern.`);
    }
  }
}

function runFixture(fixture) {
  const child = spawnSync(process.execPath, ["scripts/hooks/codex-hook.mjs", fixture.event, "--json"], {
    cwd: repoRoot,
    input: fixture.rawInput ?? JSON.stringify(fixture.input ?? {}),
    encoding: "utf8",
    timeout: 2000,
  });
  return child;
}

function checkFixtures(errors) {
  for (const fixture of fixtures) {
    const child = runFixture(fixture);
    if (child.error) {
      errors.push(`${fixture.name}: hook execution failed (${child.error.message}).`);
      continue;
    }
    let output;
    try {
      output = JSON.parse(child.stdout);
    } catch {
      errors.push(`${fixture.name}: hook did not return JSON output. stdout=${JSON.stringify(child.stdout)}`);
      continue;
    }
    if (child.status !== fixture.expectedExitCode) {
      errors.push(`${fixture.name}: expected exit ${fixture.expectedExitCode}, got ${child.status}.`);
    }
    if (output.action !== fixture.expectedAction) {
      errors.push(`${fixture.name}: expected action ${fixture.expectedAction}, got ${output.action}.`);
    }
  }
}

const errors = [];
await checkConfig(errors);
await checkHookScripts(errors);
checkDenyRules(errors);
checkFixtures(errors);

if (errors.length > 0) {
  console.error("Codex hook check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Codex hook check passed.");
console.log("External writes/network/runtime-state writes: none detected in hook scripts.");
