#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  applyAgentNativeSetup,
  planAgentNativeSetup,
} from "./agent-native-setup.mjs";
import { installationPlanHash } from "./agent-native-contract.mjs";

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag.startsWith("--")) {
      throw new Error(`Unexpected agent-native argument: ${flag}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }
    options[flag.slice(2)] = value;
    index += 1;
  }
  return options;
}

function required(options, name) {
  const value = options[name];
  if (!value) throw new Error(`Missing required option --${name}`);
  return value;
}

function repositoryRelative(from, to) {
  const relative = path.relative(from, to).replaceAll(path.sep, "/") || ".";
  return relative.startsWith(".") ? relative : `./${relative}`;
}

async function loadSetupInput(options) {
  const workspaceRoot = path.resolve(required(options, "workspace"));
  const draftPath = path.resolve(required(options, "config-draft"));
  const draft = JSON.parse(await readFile(draftPath, "utf8"));
  if (path.isAbsolute(draft.output.path)) {
    throw new Error("Agent-native setup requires a workspace-relative output.path.");
  }
  const harnessRoot = path.resolve(workspaceRoot, draft.output.path);
  const relativeHarness = path.relative(workspaceRoot, harnessRoot);
  if (relativeHarness === ".." || relativeHarness.startsWith(`..${path.sep}`)) {
    throw new Error("Agent-native harness output must remain inside the selected workspace.");
  }
  const configPath = path.join(harnessRoot, "harness.config.json");
  return {
    config: {
      ...draft,
      workspace: { root: repositoryRelative(path.dirname(configPath), workspaceRoot) },
    },
    configPath,
  };
}

function printHelp() {
  process.stdout.write(`Structor Agent-Native Setup

Usage:
  structor agent plan --workspace <path> --config-draft <path> --plan-id <id> --source-revision <40-char-sha> [--planned-at <iso>]
  structor agent apply --workspace <path> --config-draft <path> --plan <path> --approval <path> [--executed-at <iso>]
  structor agent hash --plan <path>

The plan command writes installation-plan JSON to stdout and does not mutate the selected workspace.
`);
}

async function run(argv) {
  const [command = "help", ...rest] = argv;
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  const options = parseOptions(rest);
  if (command === "plan") {
    const originalLog = console.log;
    const input = await loadSetupInput(options);
    console.log = () => {};
    try {
      const plan = await planAgentNativeSetup({
        ...input,
        planId: required(options, "plan-id"),
        sourceRevision: required(options, "source-revision"),
        ...(options["planned-at"] ? { plannedAt: options["planned-at"] } : {}),
      });
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    } finally {
      console.log = originalLog;
    }
    return;
  }
  if (command === "hash") {
    const plan = JSON.parse(await readFile(path.resolve(required(options, "plan")), "utf8"));
    process.stdout.write(`${installationPlanHash(plan)}\n`);
    return;
  }
  if (command === "apply") {
    const input = await loadSetupInput(options);
    const [plan, receipt] = await Promise.all([
      readFile(path.resolve(required(options, "plan")), "utf8").then(JSON.parse),
      readFile(path.resolve(required(options, "approval")), "utf8").then(JSON.parse),
    ]);
    const execution = await applyAgentNativeSetup({
      ...input,
      plan,
      receipt,
      ...(options["executed-at"] ? { executedAt: options["executed-at"] } : {}),
    });
    process.stdout.write(`${JSON.stringify(execution.result, null, 2)}\n`);
    if (execution.result.executionOutcome !== "applied") process.exitCode = 1;
    return;
  }
  throw new Error(`Unknown agent-native command: ${command}`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
