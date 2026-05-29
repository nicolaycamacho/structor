#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "./lib.mjs";

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
const nodeCommand = "node";
const lintCommand = "npm run lint";
const testCommand = "npm test";
const openaiRootEntrypoint = "AGENTS.md";
const openaiCodexConfig = ".codex/hooks.json";
const claudeRootEntrypoint = "CLAUDE.md";
const claudeMemoryEntrypoint = ".claude/CLAUDE.md";
const claudeRulesEntrypoint = ".claude/rules/harness-client-surfaces.md";

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

function assertExists(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`${label} was not generated: ${filePath}`);
  }
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
      claude: { rules: smokeCase.models.anthropic, hooks: false, skills: false },
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

async function validateCase(smokeCase) {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `${tempRootPrefix}${smokeCase.name}-`));
  const configPath = await writeConfig(workspaceRoot, smokeCase);
  const harnessRoot = path.join(workspaceRoot, `${smokePrefix}${smokeCase.name}-structor`);

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

  if (smokeCase.models.openai) {
    assertExists(path.join(harnessRoot, "workspace/AGENTS.md"), `${smokeCase.name} generated workspace AGENTS`);
    assertExists(path.join(workspaceRoot, "AGENTS.md"), `${smokeCase.name} workspace AGENTS`);
  } else {
    assertMissing(path.join(harnessRoot, "workspace/AGENTS.md"), `${smokeCase.name} generated workspace AGENTS`);
    assertMissing(path.join(workspaceRoot, "AGENTS.md"), `${smokeCase.name} workspace AGENTS`);
  }
  if (smokeCase.models.anthropic) {
    assertExists(path.join(harnessRoot, "workspace/CLAUDE.md"), `${smokeCase.name} generated workspace CLAUDE`);
    assertExists(path.join(harnessRoot, "workspace/.claude/CLAUDE.md"), `${smokeCase.name} generated workspace Claude memory`);
    assertExists(path.join(harnessRoot, "workspace/.claude/settings.json"), `${smokeCase.name} generated workspace Claude settings`);
    assertExists(path.join(workspaceRoot, "CLAUDE.md"), `${smokeCase.name} workspace CLAUDE`);
    assertExists(path.join(workspaceRoot, ".claude/CLAUDE.md"), `${smokeCase.name} workspace Claude memory`);
    assertExists(path.join(workspaceRoot, ".claude/settings.json"), `${smokeCase.name} workspace Claude settings`);
  } else {
    assertMissing(path.join(harnessRoot, "workspace/CLAUDE.md"), `${smokeCase.name} generated workspace CLAUDE`);
    assertMissing(path.join(harnessRoot, "workspace/.claude/CLAUDE.md"), `${smokeCase.name} generated workspace Claude memory`);
    assertMissing(path.join(harnessRoot, "workspace/.claude/settings.json"), `${smokeCase.name} generated workspace Claude settings`);
    assertMissing(path.join(workspaceRoot, "CLAUDE.md"), `${smokeCase.name} workspace CLAUDE`);
    assertMissing(path.join(workspaceRoot, ".claude/CLAUDE.md"), `${smokeCase.name} workspace Claude memory`);
    assertMissing(path.join(workspaceRoot, ".claude/settings.json"), `${smokeCase.name} workspace Claude settings`);
  }

  if (smokeCase.models.openai) {
    assertExists(path.join(harnessRoot, openaiRootEntrypoint), `${smokeCase.name} OpenAI root entrypoint`);
    assertExists(path.join(harnessRoot, openaiCodexConfig), `${smokeCase.name} Codex hook config`);
    assertExists(path.join(harnessRoot, "scripts/check-codex-hooks.mjs"), `${smokeCase.name} Codex hook validator`);
    assertExists(path.join(harnessRoot, "scripts/hooks/codex-hook.mjs"), `${smokeCase.name} Codex hook script`);
    assertExists(
      path.join(harnessRoot, "ai/model-overlays/openai/AGENTS.md"),
      `${smokeCase.name} OpenAI overlay`,
    );
  } else {
    assertMissing(path.join(harnessRoot, openaiRootEntrypoint), `${smokeCase.name} OpenAI root entrypoint`);
    assertMissing(path.join(harnessRoot, ".codex/hooks.json"), `${smokeCase.name} Codex hook config`);
  }

  if (smokeCase.models.anthropic) {
    assertExists(path.join(harnessRoot, claudeRootEntrypoint), `${smokeCase.name} Claude root entrypoint`);
    assertExists(path.join(harnessRoot, claudeMemoryEntrypoint), `${smokeCase.name} Claude memory`);
    assertExists(path.join(harnessRoot, claudeRulesEntrypoint), `${smokeCase.name} Claude rule`);
    assertExists(
      path.join(harnessRoot, "scripts/check-claude-compatibility.mjs"),
      `${smokeCase.name} Claude compatibility validator`,
    );
    assertExists(
      path.join(harnessRoot, "ai/model-overlays/anthropic/CLAUDE.md"),
      `${smokeCase.name} Claude overlay`,
    );
  } else {
    assertMissing(path.join(harnessRoot, claudeRootEntrypoint), `${smokeCase.name} Claude root entrypoint`);
    assertMissing(path.join(harnessRoot, claudeRulesEntrypoint), `${smokeCase.name} Claude rule`);
  }

  for (const consumer of smokeCase.consumers) {
    const consumerRoot = path.join(workspaceRoot, consumer.name);
    if (smokeCase.models.openai) assertExists(path.join(consumerRoot, "AGENTS.md"), `${consumer.name} AGENTS.md`);
    if (smokeCase.models.anthropic) {
      assertExists(path.join(consumerRoot, claudeRootEntrypoint), `${consumer.name} CLAUDE.md`);
      assertExists(path.join(consumerRoot, claudeMemoryEntrypoint), `${consumer.name} .claude/CLAUDE.md`);
    }
  }

  const readme = await readFile(path.join(harnessRoot, "README.md"), "utf8");
  if (!readme.includes("workspace")) {
    throw new Error(`${smokeCase.name} generated README does not include workspace bootstrap guidance.`);
  }

  const firstConsumerRoot = path.join(workspaceRoot, smokeCase.consumers[0].name);
  if (smokeCase.models.openai) {
    const agentsPath = path.join(firstConsumerRoot, openaiRootEntrypoint);
    await writeFile(agentsPath, `This mentions ${path.basename(harnessRoot)} but has no usable path.\n`);
    assertFails(nodeCommand, ["scripts/check-workspace.mjs"], harnessRoot, `${smokeCase.name} substring-only pointer`, "does not contain a resolvable");
    await writeFile(agentsPath, `Read /tmp/${path.basename(harnessRoot)}/AGENTS.md before editing.\n`);
    assertFails(nodeCommand, ["scripts/check-workspace.mjs"], harnessRoot, `${smokeCase.name} stale pointer`, "instead of");
  }
  if (smokeCase.models.anthropic && !smokeCase.models.openai) {
    const claudePath = path.join(firstConsumerRoot, claudeRootEntrypoint);
    const claudeMemoryPath = path.join(firstConsumerRoot, claudeMemoryEntrypoint);
    await writeFile(claudePath, `This mentions ${path.basename(harnessRoot)} but has no usable path.\n`);
    assertFails(nodeCommand, ["scripts/check-workspace.mjs"], harnessRoot, `${smokeCase.name} substring-only Claude pointer`, "does not contain a resolvable");
    await writeFile(claudePath, `Read /tmp/${path.basename(harnessRoot)}/CLAUDE.md before editing.\n`);
    assertFails(nodeCommand, ["scripts/check-workspace.mjs"], harnessRoot, `${smokeCase.name} stale Claude pointer`, "instead of");
    await writeFile(
      claudePath,
      `Read ${path.join(harnessRoot, "CLAUDE.md")} before editing.\nRead ${path.join(harnessRoot, "ai/AGENTS.md")} before editing.\nRead ${path.join(harnessRoot, "ai/HUB.md")} before editing.\nRead ${path.join(harnessRoot, "ai/context.md")} before editing.\n`,
    );
    await writeFile(claudeMemoryPath, `@../CLAUDE.md\nRead ${path.join(harnessRoot, "AGENTS.md")} before editing.\n`);
    assertFails(
      nodeCommand,
      ["scripts/check-workspace.mjs"],
      harnessRoot,
      `${smokeCase.name} Claude memory stale ref`,
    );
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
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `${tempRootPrefix}force-consumer-entrypoints-`));
  const smokeCase = {
    name: "force-consumer-entrypoints",
    models: { openai: true, anthropic: false },
    consumers: [{ name: "product-app", purpose: "Application repository" }],
  };
  const configPath = await writeConfig(workspaceRoot, smokeCase);
  const agentsPath = path.join(workspaceRoot, "product-app", openaiRootEntrypoint);
  await writeFile(agentsPath, "OLD");

  run(nodeCommand, [path.join(repoRoot, initHarnessScript), "--config", configPath, "--install-consumer-entrypoints"], repoRoot);
  if (await readFile(agentsPath, "utf8") !== "OLD") {
    throw new Error("consumer entrypoint should be skipped without --force.");
  }

  run(
    nodeCommand,
    [path.join(repoRoot, initHarnessScript), "--config", configPath, "--install-consumer-entrypoints", "--force"],
    repoRoot,
  );
  const forcedContent = await readFile(agentsPath, "utf8");
  if (forcedContent === "OLD" || !forcedContent.includes("This consumer repository is governed by")) {
    throw new Error("consumer entrypoint should be overwritten with --force.");
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

console.log("Template smoke check passed.");
