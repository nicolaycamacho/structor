import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  compactValidation,
  nextValidationCommands,
  packageCommand,
  parseArgs,
  relativeFrom,
  shouldExcludeCandidate,
  slugify,
} from "../bin/structor.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "bin/structor.mjs");

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

test("parseArgs defaults to the help command", () => {
  assert.equal(parseArgs([]).command, "help");
});

test("parseArgs reads init flags and valued options", () => {
  const { command, options } = parseArgs([
    "init",
    "--workspace", "/ws",
    "--config", "cfg.json",
    "--yes",
    "--install-consumer-entrypoints",
    "--force",
  ]);
  assert.equal(command, "init");
  assert.equal(options.workspace, "/ws");
  assert.equal(options.config, "cfg.json");
  assert.equal(options.yes, true);
  assert.equal(options.installConsumerEntrypoints, true);
  assert.equal(options.force, true);
});

test("parseArgs collects positional args for passthrough", () => {
  const { command, options } = parseArgs(["generate", "extra", "values"]);
  assert.equal(command, "generate");
  assert.deepEqual(options._, ["extra", "values"]);
});

test("init and doctor reject unknown flags before running command behavior", () => {
  for (const command of ["init", "doctor"]) {
    const result = runCli([command, "--bogus"]);
    assert.notEqual(result.status, 0, `${command} should reject unknown flags.`);
    assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(`Unknown argument for structor ${command}: --bogus`));
  }
});

test("generate still passes generator-specific flags through", () => {
  const result = runCli(["generate", "--dry-run", "--config", "harness.config.example.json"]);
  assert.equal(result.status, 0, `generate passthrough failed.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stdout, /would create/);
});

test("slugify normalizes arbitrary names", () => {
  assert.equal(slugify("My Cool App"), "my-cool-app");
  assert.equal(slugify("--weird__name--"), "weird-name");
  assert.equal(slugify(""), "project");
});

test("relativeFrom produces dot-prefixed relative paths", () => {
  assert.equal(relativeFrom("/ws", "/ws"), ".");
  assert.equal(relativeFrom("/ws", "/ws/app"), "./app");
  assert.equal(relativeFrom("/ws/harness", "/ws/app"), "../app");
});

test("shouldExcludeCandidate filters non-consumer folders", () => {
  assert.equal(shouldExcludeCandidate(".git"), true);
  assert.equal(shouldExcludeCandidate("node_modules"), true);
  assert.equal(shouldExcludeCandidate("structor"), true);
  assert.equal(shouldExcludeCandidate("demo-structor"), true);
  assert.equal(shouldExcludeCandidate("my-app-harness"), true);
  assert.equal(shouldExcludeCandidate("frontend"), false);
});

test("packageCommand builds manager-specific commands", () => {
  assert.equal(packageCommand("npm", "lint"), "npm run lint");
  assert.equal(packageCommand("pnpm", "test"), "pnpm test");
  assert.equal(packageCommand("yarn", "build"), "yarn build");
});

test("compactValidation drops empty commands", () => {
  assert.deepEqual(
    compactValidation({ lint: "npm run lint", test: "", build: "  " }),
    { lint: "npm run lint" },
  );
});

test("nextValidationCommands targets the generated output path", () => {
  const commands = nextValidationCommands({ output: { path: "../demo-structor" } });
  assert.equal(commands[0], "cd ../demo-structor");
  assert.ok(commands.includes("node scripts/check-workspace.mjs"));
});
