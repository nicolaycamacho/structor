import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  compactValidation,
  contributorWorkspacePlan,
  nextValidationCommands,
  packageCommand,
  parseArgs,
  relativeFrom,
  shouldExcludeCandidate,
  slugify,
} from "../bin/structor.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "bin/structor.mjs");

async function withTempDir(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "structor-cli-test-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runCli(args, cwd = repoRoot) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function outputText(result) {
  return `${result.stdout}\n${result.stderr}`.replace(/\x1b\[[0-9;]*m/g, "");
}

function runSetupContributor(args = []) {
  return spawnSync(process.execPath, [path.join(repoRoot, "scripts/setup-contributor.mjs"), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function assertSuccess(result, label) {
  assert.equal(result.status, 0, `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

async function createFixtureStructorRepo(root) {
  const fixtureRoot = path.join(root, "fixture-structor");
  await mkdir(path.join(fixtureRoot, "bin"), { recursive: true });
  await mkdir(path.join(fixtureRoot, "scripts"), { recursive: true });
  await mkdir(path.join(fixtureRoot, "contrib/self-harness"), { recursive: true });
  await writeFile(path.join(fixtureRoot, "package.json"), `${JSON.stringify({ name: "@structor-dev/cli", type: "module" })}\n`);
  await writeFile(path.join(fixtureRoot, "bin/structor.mjs"), "#!/usr/bin/env node\n");
  await writeFile(path.join(fixtureRoot, "contrib/self-harness/harness.config.json"), "{}\n");
  await writeFile(path.join(fixtureRoot, "scripts/setup-contributor.mjs"), `
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const selfHarnessRoot = path.resolve(process.cwd(), "..", "structor-self");
await mkdir(path.join(selfHarnessRoot, "scripts"), { recursive: true });
await writeFile(path.join(selfHarnessRoot, "scripts/validate-governance.mjs"), "console.log('fixture validate-governance passed');\\n");
await writeFile(path.join(selfHarnessRoot, "scripts/check-workspace.mjs"), "console.log('fixture check-workspace passed');\\n");
console.log("fixture setup complete");
`);

  for (const args of [
    ["init"],
    ["add", "."],
    ["-c", "user.email=fixture.invalid", "-c", "user.name=Fixture", "commit", "-m", "fixture"],
  ]) {
    const result = spawnSync("git", args, { cwd: fixtureRoot, encoding: "utf8" });
    assertSuccess(result, `git ${args.join(" ")}`);
  }

  return fixtureRoot;
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

test("parseArgs reads contribute structor flags", () => {
  const { command, options } = parseArgs([
    "contribute",
    "structor",
    "--workspace", "/ws",
    "--repo-url", "/fixtures/structor",
    "--yes",
    "--dry-run",
    "--force",
  ]);
  assert.equal(command, "contribute");
  assert.deepEqual(options._, ["structor"]);
  assert.equal(options.workspace, "/ws");
  assert.equal(options.repoUrl, "/fixtures/structor");
  assert.equal(options.yes, true);
  assert.equal(options.dryRun, true);
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

test("init customization step explains starter-only mode without scan selection", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "structor-cli-customization-"));
  try {
    const consumerRoot = path.join(workspaceRoot, "example-app");
    await mkdir(consumerRoot, { recursive: true });
    await writeFile(path.join(consumerRoot, "package.json"), `${JSON.stringify({ name: "example-app" })}\n`);

    const result = spawnSync(
      process.execPath,
      [cliPath, "init", "--workspace", workspaceRoot],
      {
        cwd: repoRoot,
        encoding: "utf8",
        input: [
          workspaceRoot,
          "Example Project",
          "example-project",
          "example-structor",
          "./example-structor",
          "1",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "n",
        ].join("\n"),
      },
    );

    assert.equal(result.status, 0, `init failed.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    assert.match(result.stdout, /Starter only creates generic harness content/);
    assert.match(result.stdout, /Light Scan and Deep Scan are planned future opt-in Consumer Repo Scan modes/);
    assert.doesNotMatch(result.stdout, /How much should Structor customize from consumer repos/);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
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

test("contributorWorkspacePlan defaults to the current folder workspace", () => {
  const plan = contributorWorkspacePlan({}, "/workspace");
  assert.equal(plan.workspaceRoot, "/workspace");
  assert.equal(plan.sourceRoot, "/workspace/structor");
  assert.equal(plan.selfHarnessRoot, "/workspace/structor-self");
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

test("help documents contribute structor", () => {
  const result = runCli(["help"]);
  assertSuccess(result, "structor help");
  assert.match(result.stdout, /contribute structor/);
});

test("contribute structor dry-run previews without writing", async () => {
  await withTempDir(async (root) => {
    const workspaceRoot = path.join(root, "preview");
    const result = runCli(["contribute", "structor", "--dry-run", "--workspace", workspaceRoot]);
    assertSuccess(result, "contribute structor dry-run");
    assert.match(result.stdout, /Contributor workspace preview/);
    assert.match(result.stdout, /Network reads/);
    assert.match(result.stdout, /Local filesystem writes/);
    assert.match(result.stdout, /Validation/);
    assert.equal(existsSync(workspaceRoot), false);
  });
});

test("contribute structor reuses an existing source checkout", async () => {
  await withTempDir(async (root) => {
    const sourceRoot = path.join(root, "workspace/structor");
    await mkdir(path.join(sourceRoot, "bin"), { recursive: true });
    await mkdir(path.join(sourceRoot, "scripts"), { recursive: true });
    await mkdir(path.join(sourceRoot, "contrib/self-harness"), { recursive: true });
    await writeFile(path.join(sourceRoot, "package.json"), `${JSON.stringify({ name: "@structor-dev/cli" })}\n`);
    await writeFile(path.join(sourceRoot, "bin/structor.mjs"), "");
    await writeFile(path.join(sourceRoot, "scripts/setup-contributor.mjs"), "");
    await writeFile(path.join(sourceRoot, "contrib/self-harness/harness.config.json"), "{}\n");

    const result = runCli(["contribute", "structor", "--dry-run", "--workspace", path.join(root, "workspace")]);
    assertSuccess(result, "contribute structor reuse dry-run");
    assert.match(result.stdout, /reuse existing local checkout/);
    assert.doesNotMatch(result.stdout, /git clone/);
  });
});

test("setup contributor forwards force to workspace bootstrap preview", () => {
  const result = runSetupContributor(["--dry-run", "--force"]);
  assertSuccess(result, "setup contributor force dry-run");
  assert.match(result.stdout, /bootstrap-workspace\.mjs --force/);
});

test("contribute structor completes from a local fixture repo without GitHub auth", async () => {
  await withTempDir(async (root) => {
    const fixtureRoot = await createFixtureStructorRepo(root);
    const workspaceRoot = path.join(root, "workspace");
    const result = runCli([
      "contribute",
      "structor",
      "--repo-url", fixtureRoot,
      "--workspace", workspaceRoot,
      "--yes",
    ]);

    assertSuccess(result, "contribute structor local fixture");
    assert.match(result.stdout, /Structor contributor workspace ready/);
    assert.match(result.stdout, /Validation: passed/);
    assert.equal(existsSync(path.join(workspaceRoot, "structor/package.json")), true);
    assert.equal(await readFile(path.join(workspaceRoot, "structor-self/scripts/check-workspace.mjs"), "utf8"), "console.log('fixture check-workspace passed');\n");
  });
});
