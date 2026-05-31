import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
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

function runCli(args, cwd = repoRoot) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function outputText(result) {
  return `${result.stdout}\n${result.stderr}`.replace(/\x1b\[[0-9;]*m/g, "");
}

async function createDoctorWorkspace({ validation = { test: "npm test" } } = {}) {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "structor-doctor-"));
  const consumerRoot = path.join(workspaceRoot, "app");
  const harnessRoot = path.join(workspaceRoot, "demo-structor");
  const configPath = path.join(workspaceRoot, "harness.config.json");
  await mkdir(consumerRoot, { recursive: true });
  await writeFile(path.join(consumerRoot, "package.json"), `${JSON.stringify({ scripts: { test: "node --version" } }, null, 2)}\n`);
  await writeFile(configPath, `${JSON.stringify({
    project: {
      name: "Demo",
      slug: "demo",
      harnessRepoName: "demo-structor",
    },
    output: {
      path: "./demo-structor",
    },
    models: {
      openai: true,
      anthropic: false,
    },
    clientSupport: {
      codex: {
        hooks: false,
      },
      claude: {
        rules: false,
        hooks: false,
        skills: false,
      },
    },
    consumers: [
      {
        name: "app",
        path: "./app",
        purpose: "Application repository",
        validation,
      },
    ],
  }, null, 2)}\n`);

  const generate = spawnSync(process.execPath, [
    path.join(repoRoot, "scripts/init-harness.mjs"),
    "--config", configPath,
    "--install-consumer-entrypoints",
  ], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  assert.equal(generate.status, 0, `generation failed\nstdout:\n${generate.stdout}\nstderr:\n${generate.stderr}`);

  const bootstrap = spawnSync(process.execPath, [path.join(harnessRoot, "scripts/bootstrap-workspace.mjs")], {
    cwd: harnessRoot,
    encoding: "utf8",
  });
  assert.equal(bootstrap.status, 0, `workspace bootstrap failed\nstdout:\n${bootstrap.stdout}\nstderr:\n${bootstrap.stderr}`);

  return { workspaceRoot, consumerRoot, harnessRoot, configPath };
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

test("doctor reports a healthy generated workspace", async () => {
  const { workspaceRoot } = await createDoctorWorkspace();
  const result = runCli(["doctor", "--workspace", workspaceRoot]);
  assert.equal(result.status, 0, `doctor failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(outputText(result), /OK config file exists/);
  assert.match(outputText(result), /OK generated harness required files exist/);
  assert.match(outputText(result), /OK consumer pointer files route to generated harness: app/);
});

test("doctor names a missing generated file and exits non-zero", async () => {
  const { workspaceRoot, harnessRoot } = await createDoctorWorkspace();
  await rm(path.join(harnessRoot, "AGENTS.md"));
  const result = runCli(["doctor", "--workspace", workspaceRoot]);
  assert.notEqual(result.status, 0);
  assert.match(outputText(result), /FAIL generated harness required file exists - AGENTS\.md/);
});

test("doctor names a missing consumer pointer and exits non-zero", async () => {
  const { workspaceRoot, consumerRoot } = await createDoctorWorkspace();
  await rm(path.join(consumerRoot, "AGENTS.md"));
  const result = runCli(["doctor", "--workspace", workspaceRoot]);
  assert.notEqual(result.status, 0);
  assert.match(outputText(result), /consumer:app:AGENTS\.md missing/);
});

test("doctor names a stale consumer pointer and exits non-zero", async () => {
  const { workspaceRoot, consumerRoot } = await createDoctorWorkspace();
  const pointerPath = path.join(consumerRoot, "AGENTS.md");
  const stalePointer = (await readFile(pointerPath, "utf8")).replaceAll("../demo-structor", "../old/demo-structor");
  await writeFile(pointerPath, stalePointer);
  const result = runCli(["doctor", "--workspace", workspaceRoot]);
  assert.notEqual(result.status, 0);
  assert.match(outputText(result), /consumer:app:AGENTS\.md points at .*old\/demo-structor instead of .*demo-structor/);
});

test("doctor warns for consumers without validation commands but exits zero", async () => {
  const { workspaceRoot } = await createDoctorWorkspace({ validation: {} });
  const result = runCli(["doctor", "--workspace", workspaceRoot]);
  assert.equal(result.status, 0, `doctor failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(outputText(result), /WARN consumer validation command documented: app - no validation commands configured/);
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
