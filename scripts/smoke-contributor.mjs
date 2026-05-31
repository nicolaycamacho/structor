#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeCommand = process.execPath;
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "structor-contributor-smoke-"));

function commandText(command, args) {
  return [command, ...args].join(" ");
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error([
      `${commandText(command, args)} failed with status ${result.status}`,
      result.stdout.trim() ? `stdout:\n${result.stdout.trim()}` : null,
      result.stderr.trim() ? `stderr:\n${result.stderr.trim()}` : null,
    ].filter(Boolean).join("\n"));
  }
  return result;
}

async function phase(name, runPhase) {
  console.log(`[contributor-smoke] ${name}`);
  try {
    return await runPhase();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Contributor smoke failed during ${name}: ${message}`);
  }
}

function assertExists(filePath, label) {
  if (!existsSync(filePath)) throw new Error(`${label} was not created: ${filePath}`);
}

function assertMissing(filePath, label) {
  if (existsSync(filePath)) throw new Error(`${label} should not exist: ${filePath}`);
}

async function assertFileIncludes(filePath, expected, label) {
  const content = await readFile(filePath, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${label} did not include expected text ${JSON.stringify(expected)}.`);
  }
  return content;
}

async function copySourceFixture(targetRoot) {
  await cp(repoRoot, targetRoot, {
    recursive: true,
    filter(sourcePath) {
      const relativePath = path.relative(repoRoot, sourcePath);
      if (relativePath === "") return true;
      const [topLevel] = relativePath.split(path.sep);
      return !new Set([".git", "node_modules"]).has(topLevel) && !relativePath.endsWith(".tgz");
    },
  });
}

function initGitFixture(repoPath) {
  run("git", ["init"], repoPath);
  run("git", ["add", "."], repoPath);
  run("git", [
    "-c", "user.email=fixture@example.com",
    "-c", "user.name=Fixture",
    "commit", "-m", "fixture",
  ], repoPath);
}

async function smokeManualContributorSetup() {
  const workspaceRoot = path.join(tempRoot, "manual-workspace");
  const sourceRoot = path.join(workspaceRoot, "structor");
  const selfHarnessRoot = path.join(workspaceRoot, "structor-self");
  await mkdir(workspaceRoot, { recursive: true });
  await copySourceFixture(sourceRoot);

  const sourceEntrypoint = path.join(sourceRoot, "AGENTS.md");
  await writeFile(sourceEntrypoint, "preexisting source entrypoint\n");

  run(nodeCommand, ["scripts/setup-contributor.mjs"], sourceRoot);
  assertExists(path.join(selfHarnessRoot, "scripts/validate-governance.mjs"), "manual self-harness governance check");
  assertExists(path.join(selfHarnessRoot, "scripts/check-workspace.mjs"), "manual self-harness workspace check");
  await assertFileIncludes(sourceEntrypoint, "preexisting source entrypoint", "default source entrypoint skip");

  run(nodeCommand, ["scripts/validate-governance.mjs"], selfHarnessRoot);
  run(nodeCommand, ["scripts/check-workspace.mjs"], selfHarnessRoot);

  run(nodeCommand, ["scripts/setup-contributor.mjs", "--force"], sourceRoot);
  await assertFileIncludes(sourceEntrypoint, "Structor Self-Harness", "forced source entrypoint rewrite");
}

async function smokeContributeCommand() {
  const fixtureRoot = path.join(tempRoot, "fixture-structor");
  await copySourceFixture(fixtureRoot);
  initGitFixture(fixtureRoot);

  const dryRunWorkspace = path.join(tempRoot, "dry-run-workspace");
  const dryRun = run(nodeCommand, [
    "bin/structor.mjs",
    "contribute",
    "structor",
    "--repo-url", fixtureRoot,
    "--workspace", dryRunWorkspace,
    "--dry-run",
  ], repoRoot);
  if (!dryRun.stdout.includes("Network reads") || !dryRun.stdout.includes("Local filesystem writes")) {
    throw new Error("dry-run output did not distinguish network reads from local filesystem writes.");
  }
  assertMissing(dryRunWorkspace, "dry-run workspace");

  const reuseWorkspace = path.join(tempRoot, "reuse-workspace");
  const reuseSourceRoot = path.join(reuseWorkspace, "structor");
  await mkdir(reuseWorkspace, { recursive: true });
  await copySourceFixture(reuseSourceRoot);
  await writeFile(path.join(reuseSourceRoot, "AGENTS.md"), "existing reuse entrypoint\n");
  const reuse = run(nodeCommand, [
    "bin/structor.mjs",
    "contribute",
    "structor",
    "--workspace", reuseWorkspace,
    "--yes",
  ], repoRoot);
  if (!reuse.stdout.includes("Structor contributor workspace ready")) {
    throw new Error("reuse run did not report a ready contributor workspace.");
  }
  await assertFileIncludes(path.join(reuseSourceRoot, "AGENTS.md"), "existing reuse entrypoint", "reused checkout entrypoint skip");
  assertExists(path.join(reuseWorkspace, "structor-self/scripts/check-workspace.mjs"), "reused checkout self-harness");

  const cloneWorkspace = path.join(tempRoot, "clone-workspace");
  run(nodeCommand, [
    "bin/structor.mjs",
    "contribute",
    "structor",
    "--repo-url", fixtureRoot,
    "--workspace", cloneWorkspace,
    "--yes",
  ], repoRoot);
  assertExists(path.join(cloneWorkspace, "structor/package.json"), "local fixture source clone");
  assertExists(path.join(cloneWorkspace, "structor-self/scripts/check-workspace.mjs"), "local fixture generated self-harness");
}

async function smokePackagedCli() {
  const packRoot = path.join(tempRoot, "pack");
  const npmCache = path.join(tempRoot, "npm-cache");
  await mkdir(packRoot, { recursive: true });
  const pack = run("npm", ["pack", "--pack-destination", packRoot, "--cache", npmCache, "--json"], repoRoot);
  const [packed] = JSON.parse(pack.stdout);
  const packedFiles = new Set(packed.files.map((file) => file.path));
  for (const requiredPath of [
    "bin/structor.mjs",
    "contrib/self-harness/harness.config.json",
    "scripts/setup-contributor.mjs",
    "scripts/smoke-contributor.mjs",
    "template/AGENTS.md.tpl",
  ]) {
    if (!packedFiles.has(requiredPath)) {
      throw new Error(`packed artifact is missing ${requiredPath}`);
    }
  }

  const tarballPath = path.join(packRoot, packed.filename);
  const packagedDryRunWorkspace = path.join(tempRoot, "packaged-dry-run");
  const packagedDryRun = run("npm", [
    "exec",
    "--cache", npmCache,
    "--yes",
    "--package", tarballPath,
    "--",
    "structor",
    "contribute",
    "structor",
    "--dry-run",
    "--workspace", packagedDryRunWorkspace,
  ], repoRoot);
  if (!packagedDryRun.stdout.includes("Contributor workspace preview")) {
    throw new Error("packaged CLI dry-run did not render the contributor preview.");
  }
  assertMissing(packagedDryRunWorkspace, "packaged CLI dry-run workspace");
}

let shouldCleanup = false;
try {
  await phase("manual self-harness generation", smokeManualContributorSetup);
  await phase("contribute command local workspace behavior", smokeContributeCommand);
  await phase("package contents and packaged CLI dry-run", smokePackagedCli);
  shouldCleanup = true;
  console.log("[contributor-smoke] passed");
} catch (error) {
  console.error(`Temporary smoke workspace preserved at ${tempRoot}`);
  throw error;
} finally {
  if (shouldCleanup) await rm(tempRoot, { recursive: true, force: true });
}
