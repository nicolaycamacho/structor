#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
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

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "pipe" });
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

async function writeConfig(workspaceRoot, smokeCase) {
  for (const consumer of smokeCase.consumers) {
    await mkdir(path.join(workspaceRoot, consumer.name), { recursive: true });
    await writeFile(path.join(workspaceRoot, consumer.name, "README.md"), `# ${consumer.name}\n`);
  }

  const config = {
    $schema: path.relative(workspaceRoot, path.join(repoRoot, "schemas/harness-config.schema.json")),
    project: {
      name: `Smoke ${smokeCase.name}`,
      slug: `smoke-${smokeCase.name}`,
      harnessRepoName: `smoke-${smokeCase.name}-harness`,
    },
    output: {
      path: `./smoke-${smokeCase.name}-harness`,
    },
    models: smokeCase.models,
    clientSupport: {
      codex: { hooks: smokeCase.models.openai },
      claude: { rules: smokeCase.models.anthropic, hooks: false, skills: false },
    },
    consumers: smokeCase.consumers.map((consumer) => ({
      name: consumer.name,
      path: `./${consumer.name}`,
      purpose: consumer.purpose,
      validation: {
        lint: "npm run lint",
        test: "npm test",
      },
    })),
  };

  const configPath = path.join(workspaceRoot, "harness.config.json");
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return configPath;
}

async function validateCase(smokeCase) {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `harness-template-${smokeCase.name}-`));
  const configPath = await writeConfig(workspaceRoot, smokeCase);
  const harnessRoot = path.join(workspaceRoot, `smoke-${smokeCase.name}-harness`);

  run(process.execPath, [path.join(repoRoot, "scripts/init-harness.mjs"), "--config", configPath, "--dry-run"], repoRoot);
  run(
    process.execPath,
    [path.join(repoRoot, "scripts/init-harness.mjs"), "--config", configPath, "--install-consumer-entrypoints"],
    repoRoot,
  );
  run(process.execPath, ["scripts/validate-governance.mjs"], harnessRoot);
  assertExists(path.join(harnessRoot, "ai/views/index.html"), `${smokeCase.name} generated HTML view`);
  run(process.execPath, ["scripts/bootstrap-workspace.mjs", "--dry-run"], harnessRoot);
  run(process.execPath, ["scripts/bootstrap-workspace.mjs"], harnessRoot);
  run(process.execPath, ["scripts/check-workspace.mjs"], harnessRoot);

  if (smokeCase.models.openai) {
    assertExists(path.join(harnessRoot, "AGENTS.md"), `${smokeCase.name} OpenAI root entrypoint`);
    assertExists(path.join(harnessRoot, ".codex/hooks.json"), `${smokeCase.name} Codex hook config`);
    assertExists(path.join(harnessRoot, "scripts/check-codex-hooks.mjs"), `${smokeCase.name} Codex hook validator`);
    assertExists(path.join(harnessRoot, "scripts/hooks/codex-hook.mjs"), `${smokeCase.name} Codex hook script`);
    assertExists(
      path.join(harnessRoot, "ai/model-overlays/openai/AGENTS.md"),
      `${smokeCase.name} OpenAI overlay`,
    );
  } else {
    assertMissing(path.join(harnessRoot, "AGENTS.md"), `${smokeCase.name} OpenAI root entrypoint`);
    assertMissing(path.join(harnessRoot, ".codex/hooks.json"), `${smokeCase.name} Codex hook config`);
  }

  if (smokeCase.models.anthropic) {
    assertExists(path.join(harnessRoot, "CLAUDE.md"), `${smokeCase.name} Claude root entrypoint`);
    assertExists(path.join(harnessRoot, ".claude/CLAUDE.md"), `${smokeCase.name} Claude memory`);
    assertExists(path.join(harnessRoot, ".claude/rules/harness-client-surfaces.md"), `${smokeCase.name} Claude rule`);
    assertExists(
      path.join(harnessRoot, "scripts/check-claude-compatibility.mjs"),
      `${smokeCase.name} Claude compatibility validator`,
    );
    assertExists(
      path.join(harnessRoot, "ai/model-overlays/anthropic/CLAUDE.md"),
      `${smokeCase.name} Claude overlay`,
    );
  } else {
    assertMissing(path.join(harnessRoot, "CLAUDE.md"), `${smokeCase.name} Claude root entrypoint`);
    assertMissing(path.join(harnessRoot, ".claude/rules/harness-client-surfaces.md"), `${smokeCase.name} Claude rule`);
  }

  for (const consumer of smokeCase.consumers) {
    const consumerRoot = path.join(workspaceRoot, consumer.name);
    if (smokeCase.models.openai) assertExists(path.join(consumerRoot, "AGENTS.md"), `${consumer.name} AGENTS.md`);
    if (smokeCase.models.anthropic) {
      assertExists(path.join(consumerRoot, "CLAUDE.md"), `${consumer.name} CLAUDE.md`);
      assertExists(path.join(consumerRoot, ".claude/CLAUDE.md"), `${consumer.name} .claude/CLAUDE.md`);
    }
  }

  const readme = await readFile(path.join(harnessRoot, "README.md"), "utf8");
  if (!readme.includes("workspace")) {
    throw new Error(`${smokeCase.name} generated README does not include workspace bootstrap guidance.`);
  }
}

for (const smokeCase of cases) {
  await validateCase(smokeCase);
}

console.log("Template smoke check passed.");
