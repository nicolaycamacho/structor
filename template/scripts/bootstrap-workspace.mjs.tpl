#!/usr/bin/env node

import { cp, mkdir, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(repoRoot, "..");
const consumers = {{CONSUMER_CONFIG_JSON}};
const models = {
  openai: {{MODEL_OPENAI_ENABLED}},
  anthropic: {{MODEL_ANTHROPIC_ENABLED}},
};
const clientSupport = {
  claudeRules: {{CLIENT_CLAUDE_RULES_ENABLED}},
};

function parseArgs(argv) {
  return {
    force: argv.includes("--force"),
    dryRun: argv.includes("--dry-run"),
  };
}

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyIfAllowed(sourceRelative, targetRelative, options) {
  const source = path.join(repoRoot, sourceRelative);
  const target = path.join(workspaceRoot, targetRelative);
  if (!(await exists(source))) return;
  if (options.dryRun) {
    console.log(`would install ${target}`);
    return;
  }
  if ((await exists(target)) && !options.force) {
    console.log(`skipped existing ${target}`);
    return;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target);
  console.log(`installed ${target}`);
}

async function verifyConsumers() {
  const missing = [];
  for (const consumer of consumers) {
    const consumerRoot = path.resolve(workspaceRoot, consumer.workspacePath);
    if (!(await exists(consumerRoot))) {
      missing.push(`${consumer.name}: expected repo at ${consumerRoot}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing consumer repos:\n${missing.map((item) => `- ${item}`).join("\n")}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await verifyConsumers();

  if (models.openai) {
    await copyIfAllowed("workspace/AGENTS.md", "AGENTS.md", options);
  }
  if (models.anthropic) {
    await copyIfAllowed("workspace/CLAUDE.md", "CLAUDE.md", options);
    await copyIfAllowed("workspace/.claude/CLAUDE.md", ".claude/CLAUDE.md", options);
    await copyIfAllowed("workspace/.claude/settings.json", ".claude/settings.json", options);
    if (clientSupport.claudeRules) {
      await copyIfAllowed(
        "workspace/.claude/rules/harness-client-surfaces.md",
        ".claude/rules/harness-client-surfaces.md",
        options,
      );
    }
  }

  if (!options.dryRun) {
    execFileSync(process.execPath, [path.join(repoRoot, "scripts/check-workspace.mjs")], {
      cwd: repoRoot,
      stdio: "inherit",
    });
  }

  console.log("Workspace bootstrap complete.");
  console.log(`Workspace root: ${workspaceRoot}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
