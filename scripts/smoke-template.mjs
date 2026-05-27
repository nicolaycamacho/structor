#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
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
  }

  const config = {
    $schema: path.relative(workspaceRoot, path.join(repoRoot, harnessSchemaPath)),
    project: {
      name: `Smoke ${smokeCase.name}`,
      slug: `smoke-${smokeCase.name}`,
      harnessRepoName: `smoke-${smokeCase.name}-harness`,
    },
    output: overrides.output ?? {
      path: `./smoke-${smokeCase.name}-harness`,
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
  const harnessRoot = path.join(workspaceRoot, `${smokePrefix}${smokeCase.name}-harness`);

  run(process.execPath, [path.join(repoRoot, initHarnessScript), "--config", configPath, "--dry-run"], repoRoot);
  run(
    process.execPath,
    [path.join(repoRoot, initHarnessScript), "--config", configPath, "--install-consumer-entrypoints"],
    repoRoot,
  );
  run(process.execPath, ["scripts/validate-governance.mjs"], harnessRoot);
  assertExists(path.join(harnessRoot, "ai/views/index.html"), `${smokeCase.name} generated HTML view`);
  run(process.execPath, ["scripts/bootstrap-workspace.mjs", "--dry-run"], harnessRoot);
  run(process.execPath, ["scripts/bootstrap-workspace.mjs"], harnessRoot);
  run(process.execPath, ["scripts/check-workspace.mjs"], harnessRoot);

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
    assertFails(process.execPath, ["scripts/check-workspace.mjs"], harnessRoot, `${smokeCase.name} substring-only pointer`, "does not contain a resolvable");
    await writeFile(agentsPath, `Read /tmp/${path.basename(harnessRoot)}/AGENTS.md before editing.\n`);
    assertFails(process.execPath, ["scripts/check-workspace.mjs"], harnessRoot, `${smokeCase.name} stale pointer`, "instead of");
  }
  if (smokeCase.models.anthropic && !smokeCase.models.openai) {
    const claudePath = path.join(firstConsumerRoot, claudeRootEntrypoint);
    const claudeMemoryPath = path.join(firstConsumerRoot, claudeMemoryEntrypoint);
    await writeFile(claudePath, `This mentions ${path.basename(harnessRoot)} but has no usable path.\n`);
    assertFails(process.execPath, ["scripts/check-workspace.mjs"], harnessRoot, `${smokeCase.name} substring-only Claude pointer`, "does not contain a resolvable");
    await writeFile(claudePath, `Read /tmp/${path.basename(harnessRoot)}/CLAUDE.md before editing.\n`);
    assertFails(process.execPath, ["scripts/check-workspace.mjs"], harnessRoot, `${smokeCase.name} stale Claude pointer`, "instead of");
    await writeFile(
      claudePath,
      `Read ${path.join(harnessRoot, "CLAUDE.md")} before editing.\nRead ${path.join(harnessRoot, "ai/AGENTS.md")} before editing.\nRead ${path.join(harnessRoot, "ai/HUB.md")} before editing.\nRead ${path.join(harnessRoot, "ai/context.md")} before editing.\n`,
    );
    await writeFile(claudeMemoryPath, `@../CLAUDE.md\nRead ${path.join(harnessRoot, "AGENTS.md")} before editing.\n`);
    assertFails(
      process.execPath,
      ["scripts/check-workspace.mjs"],
      harnessRoot,
      `${smokeCase.name} Claude memory stale ref`,
    );
  }
}

for (const smokeCase of cases) {
  await validateCase(smokeCase);
}

async function validateNegativeConfigCase({ name, overrides, args = [], expectedMessage }) {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `${tempRootPrefix}${name}-`));
  const smokeCase = { name, models: { openai: true, anthropic: false }, consumers: [{ name: "product-app", purpose: "Application repository" }] };
  const configPath = await writeConfig(workspaceRoot, smokeCase, overrides);
  assertFails(
    process.execPath,
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

{
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `${tempRootPrefix}check-config-`));
  const smokeCase = { name: "check-config", models: { openai: true, anthropic: false }, consumers: [{ name: "product-app", purpose: "Application repository" }] };
  const configPath = await writeConfig(workspaceRoot, smokeCase, { output: { path: "." } });
  assertFails(
    process.execPath,
    [path.join(repoRoot, "scripts/check-config.mjs"), "--config", configPath],
    repoRoot,
    "check-config workspace-root-output",
    "workspace root",
  );
}

console.log("Template smoke check passed.");
