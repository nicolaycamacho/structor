#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const eventSessionStart = "SessionStart";
const eventUserPromptSubmit = "UserPromptSubmit";
const eventPreToolUse = "PreToolUse";
const eventPermissionRequest = "PermissionRequest";
const eventPostToolUse = "PostToolUse";
const eventStop = "Stop";
const hookCommandForEvent = (event) => `node scripts/hooks/codex-hook.mjs ${event} --json`;
const fixtureTimeoutMs = 2000;
const defaultExitCodeSuccess = 0;

const expectedEvents = [
  eventSessionStart,
  eventUserPromptSubmit,
  eventPreToolUse,
  eventPermissionRequest,
  eventPostToolUse,
  eventStop,
];
const expectedEventSet = new Set(expectedEvents);
const syncFileMutationApis = [
  "appendFileSync",
  "chmodSync",
  "chownSync",
  "copyFileSync",
  "cpSync",
  "fchmodSync",
  "fchownSync",
  "fdatasyncSync",
  "fsyncSync",
  "ftruncateSync",
  "futimesSync",
  "lchmodSync",
  "lchownSync",
  "linkSync",
  "lutimesSync",
  "mkdirSync",
  "mkdtempSync",
  "renameSync",
  "rmSync",
  "rmdirSync",
  "symlinkSync",
  "truncateSync",
  "unlinkSync",
  "utimesSync",
  "writeFileSync",
  "writeSync",
  "writevSync",
];
const asyncFileMutationApis = [
  "appendFile",
  "chmod",
  "chown",
  "copyFile",
  "cp",
  "fchmod",
  "fchown",
  "fdatasync",
  "fsync",
  "ftruncate",
  "futimes",
  "lchmod",
  "lchown",
  "link",
  "lutimes",
  "mkdir",
  "mkdtemp",
  "rename",
  "rm",
  "rmdir",
  "symlink",
  "truncate",
  "unlink",
  "utimes",
  "writeFile",
  "writev",
];
const writeOpenFlagPattern = String.raw`(?:a|a\+|as|as\+|ax|ax\+|r\+|rs\+|w|w\+|wx|wx\+)`;
const syncFileMutationPattern = new RegExp(`\\b(?:${syncFileMutationApis.join("|")})\\b`);
const asyncFileMutationPattern = new RegExp(`\\b(?:${asyncFileMutationApis.join("|")})\\s*\\(`);
const hookScriptBanRules = [
  { pattern: /node:child_process|from\s+["']child_process["']/i, label: "process supervision" },
  { pattern: /\b(fetch|XMLHttpRequest)\s*\(/, label: "network call" },
  { pattern: /from\s+["']node:fs\/promises["']|from\s+["']fs\/promises["']/i, label: "file-system write-capable import" },
  { pattern: asyncFileMutationPattern, label: "file mutation" },
  { pattern: syncFileMutationPattern, label: "synchronous file mutation" },
  { pattern: /\bcreateWriteStream\b/, label: "write-capable stream" },
  {
    pattern: new RegExp(`\\b(?:open|openSync)\\s*\\([^;\\n]*,\\s*["']${writeOpenFlagPattern}["']`, "i"),
    label: "write-capable file open",
  },
  {
    pattern: /\b(?:open|openSync)\s*\([^;\n]*\b(?:O_WRONLY|O_RDWR|O_CREAT|O_TRUNC|O_APPEND)\b/i,
    label: "write-capable file open",
  },
];

const fixtures = [
  {
    name: "session-start-context",
    event: eventSessionStart,
    input: { cwd: repoRoot },
    expectedAction: "context",
    expectedExitCode: defaultExitCodeSuccess,
  },
  {
    name: "prompt-implementation-context",
    event: eventUserPromptSubmit,
    input: { prompt: "implement the next task" },
    expectedAction: "context",
    expectedExitCode: defaultExitCodeSuccess,
  },
  {
    name: "destructive-command-deny",
    event: eventPreToolUse,
    input: { toolInput: { cmd: "git reset --hard HEAD" } },
    expectedAction: "deny",
    expectedExitCode: 2,
  },
  {
    name: "destructive-command-deny-global-option",
    event: eventPreToolUse,
    input: { toolInput: { cmd: "git -C /repo reset --hard HEAD" } },
    expectedAction: "deny",
    expectedExitCode: 2,
  },
  {
    name: "force-push-deny-short-flag",
    event: eventPreToolUse,
    input: { toolInput: { cmd: "git push -f origin main" } },
    expectedAction: "deny",
    expectedExitCode: 2,
  },
  {
    name: "force-push-deny-refspec",
    event: eventPreToolUse,
    input: { toolInput: { cmd: "git push origin +main" } },
    expectedAction: "deny",
    expectedExitCode: 2,
  },
  {
    name: "secret-read-deny-printenv",
    event: eventPreToolUse,
    input: { toolInput: { cmd: "printenv SECRET_TOKEN" } },
    expectedAction: "deny",
    expectedExitCode: 2,
  },
  {
    name: "failed-validation-context",
    event: eventPostToolUse,
    input: { command: "node scripts/validate-governance.mjs", exitCode: 1 },
    expectedAction: "context",
    expectedExitCode: defaultExitCodeSuccess,
  },
  {
    name: "stop-no-change-allow",
    event: eventStop,
    input: { changedFiles: [] },
    expectedAction: "allow",
    expectedExitCode: defaultExitCodeSuccess,
  },
  {
    name: "malformed-input-context",
    event: eventPreToolUse,
    rawInput: "{not json",
    expectedAction: "context",
    expectedExitCode: defaultExitCodeSuccess,
  },
];

const invalidConfigFixtures = [
  {
    name: "extra-hook-command",
    expectedMessage: "PreToolUse must configure exactly one hook command.",
    mutate(config) {
      config.hooks.PreToolUse[0].hooks.push({
        type: "command",
        command: "node scripts/hooks/extra-hook.mjs PreToolUse --json",
      });
    },
  },
  {
    name: "extra-hook-entry",
    expectedMessage: "Stop must configure exactly one hook entry.",
    mutate(config) {
      config.hooks.Stop.push({
        matcher: "*",
        timeoutMs: fixtureTimeoutMs,
        hooks: [{ type: "command", command: "node scripts/hooks/codex-hook.mjs Stop --json" }],
      });
    },
  },
  {
    name: "extra-hook-event",
    expectedMessage: ".codex/hooks.json must not define unexpected CustomEvent hook entry.",
    mutate(config) {
      config.hooks.CustomEvent = [
        {
          matcher: "*",
          timeoutMs: fixtureTimeoutMs,
          hooks: [{ type: "command", command: "node scripts/hooks/codex-hook.mjs CustomEvent --json" }],
        },
      ];
    },
  },
];

const invalidHookScriptFixtures = [
  {
    name: "sync-mutation-import",
    source: "import { writeFileSync } from 'node:fs';\n",
    expectedLabel: "synchronous file mutation",
  },
  ...syncFileMutationApis.map((api) => ({
    name: `sync-mutation-${api}`,
    source: `fs.${api}('hook-target');\n`,
    expectedLabel: "synchronous file mutation",
  })),
  {
    name: "write-stream-call",
    source: "createWriteStream('hook.log');\n",
    expectedLabel: "write-capable stream",
  },
  {
    name: "write-open-call",
    source: "openSync('hook.log', 'w');\n",
    expectedLabel: "write-capable file open",
  },
  {
    name: "write-open-constant",
    source: "openSync('hook.log', constants.O_WRONLY | constants.O_CREAT);\n",
    expectedLabel: "write-capable file open",
  },
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

function checkTimeoutLimit(errors, event, timeoutMs) {
  if (timeoutMs && timeoutMs > fixtureTimeoutMs) {
    errors.push(`${event} timeoutMs must be ${fixtureTimeoutMs} or less.`);
  }
}

function hookCommandFor(event) {
  return hookCommandForEvent(event);
}

function expectedHookConfig() {
  return {
    version: 1,
    hooks: Object.fromEntries(
      expectedEvents.map((event) => [
        event,
        [
          {
            matcher: "*",
            timeoutMs: fixtureTimeoutMs,
            hooks: [{ type: "command", command: hookCommandFor(event) }],
          },
        ],
      ]),
    ),
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function checkConfigObject(errors, config, label = ".codex/hooks.json") {
  if (config.version !== 1) errors.push(".codex/hooks.json must set version: 1.");
  if (!config.hooks || typeof config.hooks !== "object" || Array.isArray(config.hooks)) {
    errors.push(`${label} must define hooks object.`);
    return;
  }
  for (const event of Object.keys(config.hooks)) {
    if (!expectedEventSet.has(event)) {
      errors.push(`${label} must not define unexpected ${event} hook entry.`);
    }
  }
  for (const event of expectedEvents) {
    const entries = config.hooks?.[event];
    if (!Array.isArray(entries) || entries.length === 0) {
      errors.push(`.codex/hooks.json missing ${event} hook entry.`);
      continue;
    }
    for (const entry of entries) {
      checkTimeoutLimit(errors, event, entry.timeoutMs);
    }
    if (entries.length !== 1) {
      errors.push(`${event} must configure exactly one hook entry.`);
      continue;
    }
    const [entry] = entries;
    const hooks = entry.hooks;
    if (!Array.isArray(hooks) || hooks.length !== 1) {
      errors.push(`${event} must configure exactly one hook command.`);
      continue;
    }
    const [hook] = hooks;
    const expectedCommand = hookCommandFor(event);
    if (hook.type !== "command" || hook.command !== expectedCommand) {
      errors.push(`${event} must reference committed command '${expectedCommand}'.`);
    }
  }
}

async function checkConfig(errors) {
  checkConfigObject(errors, await readJson(".codex/hooks.json"));
}

function checkConfigFixtures(errors) {
  for (const fixture of invalidConfigFixtures) {
    const config = cloneJson(expectedHookConfig());
    fixture.mutate(config);
    const fixtureErrors = [];
    checkConfigObject(fixtureErrors, config);
    if (!fixtureErrors.some((error) => error.includes(fixture.expectedMessage))) {
      errors.push(`${fixture.name}: missing expected config validation error '${fixture.expectedMessage}'.`);
    }
  }
}

function checkHookScriptSource(errors, relativePath, source) {
  for (const banned of hookScriptBanRules) {
    if (banned.pattern.test(source)) {
      errors.push(`${relativePath} contains ${banned.label} token. Hook scripts must stay deterministic and local.`);
    }
  }
}

async function checkHookScripts(errors) {
  const hooksDir = path.join(repoRoot, "scripts/hooks");
  const files = (await readdir(hooksDir, { recursive: true }))
    .filter((file) => file.endsWith(".mjs"))
    .map((file) => `scripts/hooks/${file}`);
  for (const relativePath of files) {
    const source = await readFile(path.join(repoRoot, relativePath), "utf8");
    checkHookScriptSource(errors, relativePath, source);
  }
}

function checkHookScriptFixtures(errors) {
  for (const fixture of invalidHookScriptFixtures) {
    const fixtureErrors = [];
    checkHookScriptSource(fixtureErrors, `fixture/${fixture.name}.mjs`, fixture.source);
    if (!fixtureErrors.some((error) => error.includes(fixture.expectedLabel))) {
      errors.push(`${fixture.name}: missing expected hook script validation error '${fixture.expectedLabel}'.`);
    }
  }
}

function checkDenyRules(errors, denyRules) {
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
    timeout: fixtureTimeoutMs,
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
checkConfigFixtures(errors);
await checkHookScripts(errors);
checkHookScriptFixtures(errors);

if (errors.length === 0) {
  const { denyRules } = await import("./hooks/lib/codex-hooks-core.mjs");
  checkDenyRules(errors, denyRules);
}

if (errors.length === 0) {
  checkFixtures(errors);
}

if (errors.length > 0) {
  console.error("Codex hook check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Codex hook check passed.");
console.log("External writes/network/runtime-state writes: none detected in hook scripts.");
