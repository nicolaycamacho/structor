#!/usr/bin/env node

import { cp, mkdir, access, lstat, realpath } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { workspaceEntrypointsForSettings } from "./generated-harness-contract.mjs";

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
const workspaceEntrypoints = workspaceEntrypointsForSettings({ models, clientSupport });

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

function isSameOrInsidePath(candidate, root) {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function lstatIfExists(targetPath) {
  try {
    return await lstat(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function canonicalPathForWrite(targetPath) {
  let currentPath = path.resolve(targetPath);
  const missingSegments = [];

  while (true) {
    if (await exists(currentPath)) {
      return path.join(await realpath(currentPath), ...missingSegments);
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return path.join(currentPath, ...missingSegments);
    }

    missingSegments.unshift(path.basename(currentPath));
    currentPath = parentPath;
  }
}

async function firstSymlinkUnderRoot(targetPath, rootPath) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);
  if (!isSameOrInsidePath(resolvedTarget, resolvedRoot)) return null;

  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative === "") return null;

  let currentPath = resolvedRoot;
  for (const segment of relative.split(path.sep)) {
    currentPath = path.join(currentPath, segment);
    const info = await lstatIfExists(currentPath);
    if (info === null) return null;
    if (info.isSymbolicLink()) return currentPath;
  }

  return null;
}

async function assertSafeWriteTarget({ targetPath, rootPath, label }) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);
  if (!isSameOrInsidePath(resolvedTarget, resolvedRoot)) {
    throw new Error(`${label} is unsafe: target ${resolvedTarget} must stay inside ${resolvedRoot}.`);
  }

  const symlinkPath = await firstSymlinkUnderRoot(resolvedTarget, resolvedRoot);
  if (symlinkPath !== null) {
    throw new Error(`${label} is unsafe: symlinked write targets are not allowed (${symlinkPath}).`);
  }

  const canonicalRoot = await canonicalPathForWrite(resolvedRoot);
  const canonicalTarget = await canonicalPathForWrite(resolvedTarget);
  if (!isSameOrInsidePath(canonicalTarget, canonicalRoot)) {
    throw new Error(`${label} is unsafe: resolved target escapes ${canonicalRoot}: ${canonicalTarget}.`);
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
  await assertSafeWriteTarget({
    targetPath: target,
    rootPath: workspaceRoot,
    label: `Workspace bootstrap target ${targetRelative}`,
  });
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

  for (const entrypoint of workspaceEntrypoints) {
    await copyIfAllowed(entrypoint.source, entrypoint.path, options);
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
