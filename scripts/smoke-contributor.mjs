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
// Keep fixture commits and nested CLI Git processes independent of host settings.
const fixtureEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_") && !/^npm_config_/i.test(name))),
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_ATTR_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
};
const fixtureGitConfig = {
  "core.hooksPath": "/dev/null",
  "core.attributesFile": "/dev/null",
  "core.autocrlf": "false",
  "commit.gpgSign": "false",
  "tag.gpgSign": "false",
  "init.templateDir": "",
  "init.defaultBranch": "main",
};
fixtureEnv.GIT_CONFIG_COUNT = String(Object.keys(fixtureGitConfig).length);
Object.entries(fixtureGitConfig).forEach(([key, value], index) => {
  fixtureEnv[`GIT_CONFIG_KEY_${index}`] = key;
  fixtureEnv[`GIT_CONFIG_VALUE_${index}`] = value;
});

function commandText(command, args) {
  return [command, ...args].join(" ");
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: fixtureEnv,
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
    "-c", "user.email=fixture",
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

async function smokePinnedCheckoutCli() {
  const fixtureRoot = path.join(tempRoot, "checkout-fixture-structor");
  const checkoutRoot = path.join(tempRoot, "pinned-checkout");
  await copySourceFixture(fixtureRoot);
  initGitFixture(fixtureRoot);
  const expectedPackage = JSON.parse(await readFile(path.join(fixtureRoot, "package.json"), "utf8"));
  const tag = `v${expectedPackage.version}`;
  run("git", ["-c", "user.email=fixture", "-c", "user.name=Fixture", "tag", "-a", tag, "-m", `Structor ${tag}`], fixtureRoot);
  const expectedCommit = run("git", ["rev-parse", `${tag}^{commit}`], fixtureRoot).stdout.trim();
  run("git", ["clone", "--no-checkout", fixtureRoot, checkoutRoot], tempRoot);
  run("git", ["checkout", "--detach", tag], checkoutRoot);
  const actualCommit = run("git", ["rev-parse", "HEAD"], checkoutRoot).stdout.trim();
  if (actualCommit !== expectedCommit) throw new Error("pinned checkout resolved to the wrong commit.");
  run(nodeCommand, ["scripts/check-release.mjs", "--tag", tag], checkoutRoot);

  const checkoutCli = path.join(checkoutRoot, "bin/structor.mjs");
  const version = run(nodeCommand, [checkoutCli, "--version"], checkoutRoot);
  if (version.stdout.trim() !== expectedPackage.version) {
    throw new Error(`checkout CLI version did not match ${expectedPackage.version}.`);
  }
  const dryRunWorkspace = path.join(tempRoot, "checkout-dry-run");
  const dryRun = run(nodeCommand, [checkoutCli,
    "contribute", "structor", "--repo-url", fixtureRoot,
    "--dry-run", "--workspace", dryRunWorkspace,
  ], checkoutRoot);
  if (!dryRun.stdout.includes("Contributor workspace preview")) {
    throw new Error("checkout CLI dry-run did not render the contributor preview.");
  }
  assertMissing(dryRunWorkspace, "checkout CLI dry-run workspace");

  const generatedWorkspace = path.join(tempRoot, "checkout-generation");
  await mkdir(path.join(generatedWorkspace, "example-app"), { recursive: true });
  await writeFile(path.join(generatedWorkspace, "example-app/package.json"), '{"name":"example-app"}\n');
  const configPath = path.join(generatedWorkspace, "harness.config.json");
  await writeFile(configPath, `${JSON.stringify({
    profile: "focused",
    project: { name: "Example", slug: "example", harnessRepoName: "example-structor" },
    output: { path: "./example-structor" },
    models: { openai: true, anthropic: true },
    consumers: [{ name: "example-app", path: "./example-app", purpose: "Synthetic application", validation: {} }],
  })}\n`);
  run(nodeCommand, [checkoutCli, "generate", "--config", configPath, "--install-consumer-entrypoints"], generatedWorkspace);
  const generatedRoot = path.join(generatedWorkspace, "example-structor");
  run(nodeCommand, ["scripts/bootstrap-workspace.mjs"], generatedRoot);
  run(nodeCommand, ["scripts/validate-governance.mjs"], generatedRoot);
  run(nodeCommand, ["scripts/check-workspace.mjs"], generatedRoot);
}

let shouldCleanup = false;
try {
  await phase("manual self-harness generation", smokeManualContributorSetup);
  await phase("contribute command clone/reuse behavior", smokeContributeCommand);
  await phase("pinned checkout version, release integrity, CLI dry-run and generation", smokePinnedCheckoutCli);
  shouldCleanup = true;
  console.log("[contributor-smoke] passed");
} catch (error) {
  console.error(`Temporary smoke workspace preserved at ${tempRoot}`);
  throw error;
} finally {
  if (shouldCleanup) await rm(tempRoot, { recursive: true, force: true });
}
