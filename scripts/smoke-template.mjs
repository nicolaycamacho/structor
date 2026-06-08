#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "./lib.mjs";
import {
  artifactEnabled,
  artifactTargetPath,
  consumerEntrypointsForSettings,
  generatedHarnessArtifacts,
  requiredHarnessRepoFilesForWorkspaceCheck,
  requiredWorkspaceFilesForWorkspaceCheck,
  validationPlanForSettings,
} from "./generated-harness-contract.mjs";

const cases = [
  {
    name: "openai-only",
    models: { openai: true, anthropic: false },
    consumers: [{ name: "product-app", purpose: "Application repository" }],
  },
  {
    name: "anthropic-only",
    models: { openai: false, anthropic: true },
    consumers: [{ name: "product-app", purpose: "Application repository" }],
  },
  {
    name: "both-models",
    models: { openai: true, anthropic: true },
    consumers: [
      { name: "product-frontend", purpose: "Frontend application repository" },
      { name: "product-backend", purpose: "Backend API repository" },
    ],
  },
];
const smokePrefix = "smoke-";
const tempRootPrefix = "structor-";
const harnessConfigFileName = "harness.config.json";
const harnessSchemaPath = "schemas/harness-config.schema.json";
const initHarnessScript = "scripts/init-harness.mjs";
const cliPath = path.join(repoRoot, "bin/structor.mjs");
const nodeCommand = "node";
const lintCommand = "npm run lint";
const testCommand = "npm test";

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "pipe" });
}

function runResult(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: "utf8" });
}

function assertFails(command, args, cwd, label, expectedMessage) {
  const result = runResult(command, args, cwd);
  if (result.status === 0) {
    throw new Error(`${label} should have failed.`);
  }
  const output = `${result.stdout}\n${result.stderr}`;
  if (expectedMessage && !output.includes(expectedMessage)) {
    throw new Error(`${label} failed without expected message ${JSON.stringify(expectedMessage)}. Output: ${output}`);
  }
}

function assertResultFails(result, label, expectedMessage) {
  if (result.status === 0) {
    throw new Error(`${label} should have failed.`);
  }
  const output = `${result.stdout}\n${result.stderr}`;
  if (expectedMessage && !output.includes(expectedMessage)) {
    throw new Error(`${label} failed without expected message ${JSON.stringify(expectedMessage)}. Output: ${output}`);
  }
}

function assertExists(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`${label} was not generated: ${filePath}`);
  }
}

async function preservedGuidanceRun(consumerRoot) {
  const preserveRoot = path.join(consumerRoot, ".structor", "preserved-guidance");
  assertExists(preserveRoot, "preserved guidance root");
  const timestamps = (await readdir(preserveRoot)).sort();
  if (timestamps.length !== 1) {
    throw new Error(`expected one preserved-guidance timestamp, found ${timestamps.length}`);
  }
  return path.join(preserveRoot, timestamps[0]);
}

function initInput({ workspaceRoot, outputPath, modelChoice = "1" }) {
  return [
    workspaceRoot,
    "",
    outputPath,
    modelChoice,
    "",
  ].join("\n");
}

function assertMissing(filePath, label) {
  if (existsSync(filePath)) {
    throw new Error(`${label} should not have been generated: ${filePath}`);
  }
}

async function writeConfig(workspaceRoot, smokeCase, overrides = {}) {
  for (const consumer of smokeCase.consumers) {
    await mkdir(path.join(workspaceRoot, consumer.name), { recursive: true });
    await writeFile(path.join(workspaceRoot, consumer.name, "README.md"), `# ${consumer.name}\n`);
    await writeFile(path.join(workspaceRoot, consumer.name, "package.json"), `${JSON.stringify({ name: consumer.name })}\n`);
  }

  const config = {
    $schema: path.relative(workspaceRoot, path.join(repoRoot, harnessSchemaPath)),
    project: {
      name: `Smoke ${smokeCase.name}`,
      slug: `smoke-${smokeCase.name}`,
      harnessRepoName: `smoke-${smokeCase.name}-structor`,
    },
    output: overrides.output ?? {
      path: `./smoke-${smokeCase.name}-structor`,
    },
    models: overrides.models ?? smokeCase.models,
    clientSupport: {
      codex: { hooks: smokeCase.models.openai },
      claude: { rules: false, hooks: false, skills: false },
    },
    consumers: overrides.consumers ?? smokeCase.consumers.map((consumer) => ({
      name: consumer.name,
      path: `./${consumer.name}`,
      purpose: consumer.purpose,
      validation: {
        lint: lintCommand,
        test: testCommand,
      },
    })),
  };
  if (overrides.removeProject) delete config.project;

  const configPath = path.join(workspaceRoot, harnessConfigFileName);
  await writeFile(configPath, overrides.rawJson ?? `${JSON.stringify(config, null, 2)}\n`);
  return configPath;
}

function settingsForSmokeCase(smokeCase) {
  return {
    models: smokeCase.models,
    clientSupport: {
      codexHooks: smokeCase.models.openai,
      claudeRules: false,
      claudeHooks: false,
      claudeSkills: false,
    },
  };
}

function findEntrypoint(entrypoints, predicate, label) {
  const entrypoint = entrypoints.find(predicate);
  if (!entrypoint) throw new Error(`Generated harness contract is missing ${label}.`);
  return entrypoint;
}

function assertContractSurfaces({ smokeCase, workspaceRoot, harnessRoot }) {
  const settings = settingsForSmokeCase(smokeCase);
  for (const relativePath of requiredHarnessRepoFilesForWorkspaceCheck(settings)) {
    assertExists(path.join(harnessRoot, relativePath), `${smokeCase.name} contract repo file ${relativePath}`);
  }
  for (const relativePath of requiredWorkspaceFilesForWorkspaceCheck(settings)) {
    assertExists(path.join(workspaceRoot, relativePath), `${smokeCase.name} contract workspace file ${relativePath}`);
  }
  for (const artifact of generatedHarnessArtifacts.filter((item) => item.generated && !artifactEnabled(item, settings))) {
    assertMissing(path.join(harnessRoot, artifactTargetPath(artifact)), `${smokeCase.name} disabled contract artifact ${artifactTargetPath(artifact)}`);
  }
  for (const consumer of smokeCase.consumers) {
    const consumerRoot = path.join(workspaceRoot, consumer.name);
    for (const entrypoint of consumerEntrypointsForSettings(settings)) {
      assertExists(path.join(consumerRoot, entrypoint.path), `${consumer.name} contract entrypoint ${entrypoint.path}`);
    }
  }

  const plan = validationPlanForSettings(settings);
  if (settings.clientSupport.codexHooks) {
    const codexDependencies = plan.checkDependencies["scripts/check-codex-hooks.mjs"] ?? [];
    for (const dependency of ["scripts/hooks/codex-hook.mjs", "scripts/hooks/lib/codex-hooks-core.mjs"]) {
      if (!codexDependencies.includes(dependency)) {
        throw new Error(`Codex hook validation must trust generated dependency ${dependency}.`);
      }
    }
  }
}

async function validateCase(smokeCase) {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `${tempRootPrefix}${smokeCase.name}-`));
  const configPath = await writeConfig(workspaceRoot, smokeCase);
  const harnessRoot = path.join(workspaceRoot, `${smokePrefix}${smokeCase.name}-structor`);
  const settings = settingsForSmokeCase(smokeCase);
  const consumerEntrypoints = consumerEntrypointsForSettings(settings);

  run(nodeCommand, [path.join(repoRoot, initHarnessScript), "--config", configPath, "--dry-run"], repoRoot);
  run(
    nodeCommand,
    [path.join(repoRoot, initHarnessScript), "--config", configPath, "--install-consumer-entrypoints"],
    repoRoot,
  );
  run(nodeCommand, ["scripts/validate-governance.mjs"], harnessRoot);
  assertExists(path.join(harnessRoot, "ai/views/index.html"), `${smokeCase.name} generated HTML view`);
  run(nodeCommand, ["scripts/bootstrap-workspace.mjs", "--dry-run"], harnessRoot);
  run(nodeCommand, ["scripts/bootstrap-workspace.mjs"], harnessRoot);
  run(nodeCommand, ["scripts/check-workspace.mjs"], harnessRoot);
  assertContractSurfaces({ smokeCase, workspaceRoot, harnessRoot });

  const readme = await readFile(path.join(harnessRoot, "README.md"), "utf8");
  if (!readme.includes("workspace")) {
    throw new Error(`${smokeCase.name} generated README does not include workspace bootstrap guidance.`);
  }

  const firstConsumerRoot = path.join(workspaceRoot, smokeCase.consumers[0].name);
  if (smokeCase.models.openai) {
    const agentsPath = path.join(
      firstConsumerRoot,
      findEntrypoint(consumerEntrypoints, (entrypoint) => entrypoint.model === "openai", "OpenAI consumer entrypoint").path,
    );
    await writeFile(agentsPath, `This mentions ${path.basename(harnessRoot)} but has no usable path.\n`);
    assertFails(nodeCommand, ["scripts/check-workspace.mjs"], harnessRoot, `${smokeCase.name} substring-only pointer`, "does not contain a resolvable");
    await writeFile(agentsPath, `Read /tmp/${path.basename(harnessRoot)}/AGENTS.md before editing.\n`);
    assertFails(nodeCommand, ["scripts/check-workspace.mjs"], harnessRoot, `${smokeCase.name} stale pointer`, "instead of");
  }
  if (smokeCase.models.anthropic && !smokeCase.models.openai) {
    const claudePath = path.join(
      firstConsumerRoot,
      findEntrypoint(
        consumerEntrypoints,
        (entrypoint) => entrypoint.model === "anthropic" && entrypoint.routing === "harness",
        "Claude consumer entrypoint",
      ).path,
    );
    await writeFile(claudePath, `This mentions ${path.basename(harnessRoot)} but has no usable path.\n`);
    assertFails(nodeCommand, ["scripts/check-workspace.mjs"], harnessRoot, `${smokeCase.name} substring-only Claude pointer`, "does not contain a resolvable");
    await writeFile(claudePath, `Read /tmp/${path.basename(harnessRoot)}/CLAUDE.md before editing.\n`);
    assertFails(nodeCommand, ["scripts/check-workspace.mjs"], harnessRoot, `${smokeCase.name} stale Claude pointer`, "instead of");
  }
}

for (const smokeCase of cases) {
  await validateCase(smokeCase);
}

async function validateNegativeConfigCase({ name, overrides, args = [], expectedMessage, setup }) {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `${tempRootPrefix}${name}-`));
  const smokeCase = { name, models: { openai: true, anthropic: false }, consumers: [{ name: "product-app", purpose: "Application repository" }] };
  const configPath = await writeConfig(workspaceRoot, smokeCase, overrides);
  if (setup) await setup(workspaceRoot);
  assertFails(
    nodeCommand,
    [path.join(repoRoot, initHarnessScript), "--config", configPath, "--dry-run", ...args],
    repoRoot,
    name,
    expectedMessage,
  );
}

await validateNegativeConfigCase({
  name: "no-models",
  overrides: { models: { openai: false, anthropic: false } },
  expectedMessage: "Invalid harness config: at least one model provider must be enabled.",
});
await validateNegativeConfigCase({
  name: "malformed-json",
  overrides: { rawJson: "{not json" },
});
await validateNegativeConfigCase({
  name: "missing-project",
  overrides: { removeProject: true },
  expectedMessage: "project is required",
});
await validateNegativeConfigCase({
  name: "absolute-output",
  overrides: { output: { path: path.join(os.tmpdir(), "absolute-harness-output") } },
  expectedMessage: "absolute output paths require --allow-absolute-output",
});
await validateNegativeConfigCase({
  name: "relative-traversal-output",
  overrides: { output: { path: "../outside-harness-output" } },
  expectedMessage: "workspace boundary",
});
await validateNegativeConfigCase({
  name: "symlink-output",
  overrides: { output: { path: "./linked-harness-output" } },
  expectedMessage: "symlinked output directories",
  setup: async (workspaceRoot) => {
    await symlink(path.join(workspaceRoot, "product-app"), path.join(workspaceRoot, "linked-harness-output"), "dir");
  },
});
await validateNegativeConfigCase({
  name: "template-root-output",
  overrides: { output: { path: repoRoot } },
  args: ["--allow-absolute-output"],
  expectedMessage: "template repo",
});
await validateNegativeConfigCase({
  name: "inside-template-output",
  overrides: { output: { path: path.join(repoRoot, "generated-harness") } },
  args: ["--allow-absolute-output"],
  expectedMessage: "template repo",
});
await validateNegativeConfigCase({
  name: "consumer-root-output",
  overrides: { output: { path: "./product-app" } },
  expectedMessage: "configured consumer repo",
});
await validateNegativeConfigCase({
  name: "inside-consumer-output",
  overrides: { output: { path: "./product-app/generated-harness" } },
  expectedMessage: "configured consumer repo",
});
await validateNegativeConfigCase({
  name: "workspace-root-output",
  overrides: { output: { path: "." } },
  expectedMessage: "workspace root",
});
await validateNegativeConfigCase({
  name: "git-segment-output",
  overrides: { output: { path: "./generated/.git/harness" } },
  expectedMessage: ".git path segment",
});
await validateNegativeConfigCase({
  name: "absolute-consumer",
  overrides: {
    consumers: [{
      name: "outside-app",
      path: path.join(os.tmpdir(), "outside-app"),
      purpose: "Application repository",
      validation: {},
    }],
  },
  expectedMessage: "absolute paths are not allowed",
});
await validateNegativeConfigCase({
  name: "traversal-consumer",
  overrides: {
    consumers: [{
      name: "outside-app",
      path: "../outside-app",
      purpose: "Application repository",
      validation: {},
    }],
  },
  expectedMessage: "relative traversal",
});
await validateNegativeConfigCase({
  name: "force-traversal-consumer",
  overrides: {
    consumers: [{
      name: "outside-app",
      path: "../outside-app",
      purpose: "Application repository",
      validation: {},
    }],
  },
  args: ["--install-consumer-entrypoints", "--force"],
  expectedMessage: "relative traversal",
});
await validateNegativeConfigCase({
  name: "unconfirmed-consumer",
  overrides: {
    consumers: [{
      name: "not-repo",
      path: "./not-repo",
      purpose: "Existing directory without repo signals",
      validation: {},
    }],
  },
  args: ["--install-consumer-entrypoints"],
  expectedMessage: "not a confirmed consumer repository",
  setup: async (workspaceRoot) => {
    await mkdir(path.join(workspaceRoot, "not-repo"), { recursive: true });
  },
});
await validateNegativeConfigCase({
  name: "symlinked-consumer",
  overrides: {
    consumers: [{
      name: "linked-app",
      path: "./linked-app",
      purpose: "Symlinked application repository",
      validation: {},
    }],
  },
  args: ["--install-consumer-entrypoints"],
  expectedMessage: "symlinked consumer paths",
  setup: async (workspaceRoot) => {
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), `${tempRootPrefix}outside-consumer-`));
    await writeFile(path.join(outsideRoot, "package.json"), `${JSON.stringify({ name: "outside-app" })}\n`);
    await symlink(outsideRoot, path.join(workspaceRoot, "linked-app"), "dir");
  },
});

{
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `${tempRootPrefix}worktree-pointer-symlink-`));
  const smokeCase = {
    name: "worktree-pointer-symlink",
    models: { openai: true, anthropic: false },
    consumers: [{ name: "product-app", purpose: "Application repository" }],
  };
  const configPath = await writeConfig(workspaceRoot, smokeCase);
  const harnessRoot = path.join(workspaceRoot, "smoke-worktree-pointer-symlink-structor");
  const consumerRoot = path.join(workspaceRoot, "product-app");
  const outsideRoot = path.join(workspaceRoot, "outside-pointer");
  const openaiEntrypoint = findEntrypoint(
    consumerEntrypointsForSettings(settingsForSmokeCase(smokeCase)),
    (entrypoint) => entrypoint.model === "openai",
    "OpenAI consumer entrypoint",
  );
  const outsidePointer = path.join(outsideRoot, openaiEntrypoint.path);
  await mkdir(outsideRoot);
  await writeFile(outsidePointer, "Read /tmp/other-structor/AGENTS.md before editing.\n");

  run(nodeCommand, [path.join(repoRoot, initHarnessScript), "--config", configPath], repoRoot);
  run("git", ["init"], consumerRoot);
  await symlink(outsidePointer, path.join(consumerRoot, openaiEntrypoint.path));

  assertFails(
    nodeCommand,
    ["scripts/bootstrap-codex-worktree.mjs", consumerRoot],
    harnessRoot,
    "worktree pointer symlink",
    "symlinked write targets",
  );
  if ((await readFile(outsidePointer, "utf8")) !== "Read /tmp/other-structor/AGENTS.md before editing.\n") {
    throw new Error("worktree repair should not write through a symlinked pointer file.");
  }
}

{
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `${tempRootPrefix}preserve-consumer-entrypoints-`));
  const smokeCase = {
    name: "preserve-consumer-entrypoints",
    models: { openai: true, anthropic: true },
    consumers: [{ name: "product-app", purpose: "Application repository" }],
  };
  const configPath = await writeConfig(workspaceRoot, smokeCase);
  const consumerRoot = path.join(workspaceRoot, "product-app");
  const agentsPath = path.join(consumerRoot, "AGENTS.md");
  const claudePath = path.join(consumerRoot, "CLAUDE.md");
  await writeFile(agentsPath, "OLD AGENTS");
  await writeFile(claudePath, "OLD CLAUDE");
  await mkdir(path.join(consumerRoot, ".ai", "openai"), { recursive: true });
  await writeFile(path.join(consumerRoot, ".ai", "openai", "context.md"), "# local context\n");

  assertFails(
    nodeCommand,
    [path.join(repoRoot, initHarnessScript), "--config", configPath, "--install-consumer-entrypoints"],
    repoRoot,
    "preserve required without flag",
    "Existing root guidance files require preservation consent",
  );
  if (await readFile(agentsPath, "utf8") !== "OLD AGENTS") {
    throw new Error("consumer AGENTS.md should remain unchanged when preservation is not authorized.");
  }
  assertMissing(
    path.join(workspaceRoot, "smoke-preserve-consumer-entrypoints-structor"),
    "unauthorized lower-level init generated harness",
  );

  assertFails(
    nodeCommand,
    [path.join(repoRoot, initHarnessScript), "--config", configPath, "--install-consumer-entrypoints", "--force"],
    repoRoot,
    "force should not authorize root guidance takeover",
    "Existing root guidance files require preservation consent",
  );
  if (await readFile(claudePath, "utf8") !== "OLD CLAUDE") {
    throw new Error("consumer CLAUDE.md should remain unchanged when only --force is provided.");
  }

  run(
    nodeCommand,
    [path.join(repoRoot, initHarnessScript), "--config", configPath, "--install-consumer-entrypoints", "--force", "--preserve-existing-guidance"],
    repoRoot,
  );
  const preserveRoot = await preservedGuidanceRun(consumerRoot);
  if (await readFile(path.join(preserveRoot, "AGENTS.md"), "utf8") !== "OLD AGENTS") {
    throw new Error("preserved AGENTS.md should contain the original guidance.");
  }
  if (await readFile(path.join(preserveRoot, "CLAUDE.md"), "utf8") !== "OLD CLAUDE") {
    throw new Error("preserved CLAUDE.md should contain the original guidance.");
  }
  const manifest = JSON.parse(await readFile(path.join(preserveRoot, "manifest.json"), "utf8"));
  if (manifest.preservedFiles.length !== 2 || !manifest.additionalGuidanceCandidates.includes(".ai/openai/context.md")) {
    throw new Error("preserved guidance manifest should record both root files and conservative candidates.");
  }
  const agentsContent = await readFile(agentsPath, "utf8");
  if (!agentsContent.includes("This consumer repository is governed by") || !agentsContent.includes("Preserved Guidance")) {
    throw new Error("consumer AGENTS.md should be replaced with a Structor entrypoint that mentions preserved guidance.");
  }
  const taskContent = await readFile(path.join(workspaceRoot, "smoke-preserve-consumer-entrypoints-structor", "ai/tasks/populate-generated-harness.md"), "utf8");
  if (!taskContent.includes(".structor/preserved-guidance/")) {
    throw new Error("generated populate-generated-harness task should include the preserved guidance path.");
  }

  run(
    nodeCommand,
    [path.join(repoRoot, initHarnessScript), "--config", configPath, "--install-consumer-entrypoints"],
    repoRoot,
  );
  const preservedRuns = await readdir(path.join(consumerRoot, ".structor", "preserved-guidance"));
  if (preservedRuns.length !== 1) {
    throw new Error("rerun after preserved-guidance init should verify the Structor entrypoint without creating migration debt.");
  }
}

async function validatePreserveRootGuidanceCase({ name, models, existingFiles, expectedGeneratedFiles }) {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `${tempRootPrefix}${name}-`));
  const smokeCase = {
    name,
    models,
    consumers: [{ name: "product-app", purpose: "Application repository" }],
  };
  const configPath = await writeConfig(workspaceRoot, smokeCase);
  const harnessRoot = path.join(workspaceRoot, `smoke-${name}-structor`);
  const consumerRoot = path.join(workspaceRoot, "product-app");
  for (const [fileName, content] of Object.entries(existingFiles)) {
    await writeFile(path.join(consumerRoot, fileName), content);
  }

  run(
    nodeCommand,
    [path.join(repoRoot, initHarnessScript), "--config", configPath, "--install-consumer-entrypoints", "--preserve-existing-guidance"],
    repoRoot,
  );
  const preserveRoot = await preservedGuidanceRun(consumerRoot);
  const timestampName = path.basename(preserveRoot);
  const manifest = JSON.parse(await readFile(path.join(preserveRoot, "manifest.json"), "utf8"));

  for (const [fileName, content] of Object.entries(existingFiles)) {
    if (await readFile(path.join(preserveRoot, fileName), "utf8") !== content) {
      throw new Error(`${name} should preserve ${fileName}.`);
    }
    if (!manifest.preservedFiles.some((file) => file.source === fileName)) {
      throw new Error(`${name} manifest should record ${fileName}.`);
    }
  }
  for (const fileName of expectedGeneratedFiles) {
    const generatedContent = await readFile(path.join(consumerRoot, fileName), "utf8");
    if (!generatedContent.includes("This consumer repository is governed by") || !generatedContent.includes(timestampName)) {
      throw new Error(`${name} should replace ${fileName} with a Structor entrypoint that mentions preserved guidance.`);
    }
  }
  run(nodeCommand, ["scripts/bootstrap-workspace.mjs"], harnessRoot);
  run(nodeCommand, ["scripts/check-workspace.mjs"], harnessRoot);
}

await validatePreserveRootGuidanceCase({
  name: "preserve-openai-only",
  models: { openai: true, anthropic: false },
  existingFiles: { "AGENTS.md": "OLD AGENTS" },
  expectedGeneratedFiles: ["AGENTS.md"],
});

await validatePreserveRootGuidanceCase({
  name: "preserve-anthropic-only",
  models: { openai: false, anthropic: true },
  existingFiles: { "CLAUDE.md": "OLD CLAUDE" },
  expectedGeneratedFiles: ["CLAUDE.md"],
});

{
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `${tempRootPrefix}yes-abort-guidance-`));
  const consumerRoot = path.join(workspaceRoot, "product-app");
  await mkdir(consumerRoot, { recursive: true });
  await writeFile(path.join(consumerRoot, "package.json"), `${JSON.stringify({ name: "product-app" })}\n`);
  await writeFile(path.join(consumerRoot, "AGENTS.md"), "OLD AGENTS");

  const result = spawnSync(
    process.execPath,
    [cliPath, "init", "--workspace", workspaceRoot, "--yes"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      input: initInput({
        workspaceRoot,
        projectName: "Example Project",
        projectSlug: "example-project",
        harnessRepoName: "example-project-structor",
        outputPath: "./example-project-structor",
        modelChoice: "2",
      }),
    },
  );
  assertResultFails(result, "--yes existing guidance", "pass --yes --preserve-existing-guidance");
  if (await readFile(path.join(consumerRoot, "AGENTS.md"), "utf8") !== "OLD AGENTS") {
    throw new Error("--yes without preservation should leave AGENTS.md unchanged.");
  }
}

{
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `${tempRootPrefix}yes-preserve-guidance-`));
  const consumerRoot = path.join(workspaceRoot, "product-app");
  const harnessRoot = path.join(workspaceRoot, "example-project-structor");
  await mkdir(consumerRoot, { recursive: true });
  await writeFile(path.join(consumerRoot, "package.json"), `${JSON.stringify({ name: "product-app" })}\n`);
  await writeFile(path.join(consumerRoot, "AGENTS.md"), "OLD AGENTS");

  const result = spawnSync(
    process.execPath,
    [cliPath, "init", "--workspace", workspaceRoot, "--yes", "--preserve-existing-guidance"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      input: initInput({
        workspaceRoot,
        projectName: "Example Project",
        projectSlug: "example-project",
        harnessRepoName: "example-project-structor",
        outputPath: "./example-project-structor",
        modelChoice: "2",
      }),
    },
  );
  if (result.status !== 0) {
    throw new Error(`--yes --preserve-existing-guidance should succeed.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  const preserveRoot = await preservedGuidanceRun(consumerRoot);
  if (await readFile(path.join(preserveRoot, "AGENTS.md"), "utf8") !== "OLD AGENTS") {
    throw new Error("--yes --preserve-existing-guidance should preserve AGENTS.md.");
  }
  run(nodeCommand, ["scripts/check-workspace.mjs"], harnessRoot);
}

{
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `${tempRootPrefix}no-existing-guidance-task-`));
  const smokeCase = {
    name: "no-existing-guidance-task",
    models: { openai: true, anthropic: false },
    consumers: [{ name: "product-app", purpose: "Application repository" }],
  };
  const configPath = await writeConfig(workspaceRoot, smokeCase);
  const harnessRoot = path.join(workspaceRoot, "smoke-no-existing-guidance-task-structor");
  const consumerRoot = path.join(workspaceRoot, "product-app");

  run(nodeCommand, [path.join(repoRoot, initHarnessScript), "--config", configPath, "--install-consumer-entrypoints"], repoRoot);
  assertMissing(path.join(consumerRoot, ".structor", "preserved-guidance"), "no-existing-guidance preserved guidance");
  const taskContent = await readFile(path.join(harnessRoot, "ai/tasks/populate-generated-harness.md"), "utf8");
  if (!taskContent.includes("repo scan evidence only") || !taskContent.includes("./smoke-no-existing-guidance-task-structor")) {
    throw new Error("no-existing-guidance task should exist with repo-scan-only behavior and concrete harness path.");
  }
}

{
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `${tempRootPrefix}check-config-`));
  const smokeCase = { name: "check-config", models: { openai: true, anthropic: false }, consumers: [{ name: "product-app", purpose: "Application repository" }] };
  const configPath = await writeConfig(workspaceRoot, smokeCase, { output: { path: "." } });
  assertFails(
    nodeCommand,
    [path.join(repoRoot, "scripts/check-config.mjs"), "--config", configPath],
    repoRoot,
    "check-config workspace-root-output",
    "workspace root",
  );
}

{
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `${tempRootPrefix}matching-root-entrypoint-`));
  const smokeCase = {
    name: "matching-root-entrypoint",
    models: { openai: true, anthropic: false },
    consumers: [{ name: "product-app", purpose: "Application repository" }],
  };
  const configPath = await writeConfig(workspaceRoot, smokeCase);
  const consumerRoot = path.join(workspaceRoot, "product-app");

  run(nodeCommand, [path.join(repoRoot, initHarnessScript), "--config", configPath, "--install-consumer-entrypoints"], repoRoot);
  run(nodeCommand, [path.join(repoRoot, initHarnessScript), "--config", configPath, "--install-consumer-entrypoints", "--preserve-existing-guidance"], repoRoot);
  assertMissing(path.join(consumerRoot, ".structor", "preserved-guidance"), "matching Structor root entrypoint preserved guidance");
}

console.log("Template smoke check passed.");
