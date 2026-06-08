#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { access, mkdir, readdir, readFile, realpath, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertSafeConsumerPath,
  hasConsumerRepositorySignal,
  resolveHarnessConfig,
  validateConfigShape,
} from "../scripts/lib.mjs";
import {
  collectConsumerRootGuidanceConflicts,
  filesystemTimestamp,
  generateHarness,
  installConsumerEntrypoints,
  render,
} from "../scripts/init-harness.mjs";
import {
  consumerEntrypointValues,
  harnessTemplateValues,
} from "../scripts/rendered-config.mjs";
import {
  consumerEntrypointsForSettings,
  requiredHarnessRepoFilesForWorkspaceCheck,
  requiredWorkspaceFilesForWorkspaceCheck,
  workspaceEntrypointsForSettings,
} from "../scripts/generated-harness-contract.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatorPath = path.join(packageRoot, "scripts/init-harness.mjs");
const configFileName = "harness.config.json";
const structorRepoUrlDefault = "https://github.com/nicolaycamacho/structor.git";
const reset = "\x1b[0m";
const styles = {
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

const repoSignals = [
  ".git",
  "package.json",
  "pyproject.toml",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "Gemfile",
  "composer.json",
];

async function readPackageMetadata() {
  return await readJson(path.join(packageRoot, "package.json"));
}

function color(style, value) {
  return `${styles[style]}${value}${reset}`;
}

function section(title) {
  console.log(`\n${color("cyan", color("bold", title))}`);
}

function note(message) {
  console.log(color("dim", message));
}

function success(message) {
  console.log(color("green", message));
}

function check(message) {
  console.log(`${color("green", "✓")} ${message}`);
}

function warn(message) {
  console.log(color("yellow", message));
}

function fail(message) {
  console.error(color("red", message));
}

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function maybeReadJson(filePath) {
  if (!(await exists(filePath))) return null;
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
}

export function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "project";
}

export function relativeFrom(basePath, targetPath) {
  const relative = path.relative(basePath, targetPath).replaceAll(path.sep, "/");
  return relative === "" ? "." : relative.startsWith(".") ? relative : `./${relative}`;
}

export function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const options = { _: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith("--")) {
      options._.push(arg);
      continue;
    }
    if (arg === "--yes" || arg === "-y") options.yes = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--install-consumer-entrypoints") options.installConsumerEntrypoints = true;
    else if (arg === "--preserve-existing-guidance") options.preserveExistingGuidance = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--workspace") options.workspace = rest[++index];
    else if (arg === "--repo-url") options.repoUrl = rest[++index];
    else if (arg === "--config") options.config = rest[++index];
    else options._.push(arg);
  }
  return { command, options, rawArgs: rest };
}

function assertNoUnknownCommandFlags(command, options) {
  const unknownFlags = options._.filter((arg) => arg.startsWith("--"));
  if (unknownFlags.length === 0) return;

  const noun = unknownFlags.length === 1 ? "argument" : "arguments";
  throw new Error(`Unknown ${noun} for structor ${command}: ${unknownFlags.join(", ")}`);
}

function printHelp() {
  console.log(`Structor\n\nUsage:\n  structor init [--workspace <path>] [--config <path>] [--yes] [--preserve-existing-guidance]\n  structor generate --config <path> [generator options]\n  structor contribute structor [--workspace <path>] [--repo-url <url-or-path>] [--yes] [--dry-run] [--force]\n  structor doctor [--workspace <path>] [--config <path>]\n\nCommands:\n  init                 Guided local setup for a Structor workspace.\n  generate             Render a generated harness from an existing config.\n  contribute structor  Create or refresh a local Structor contributor workspace.\n  doctor               Diagnose local Structor workspace drift without repairing files.\n`);
}

function runGenerator(args, cwd = process.cwd()) {
  const result = spawnSync(process.execPath, [generatorPath, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result;
}

function printCommandOutput(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function passthroughGenerate(args) {
  const result = spawnSync(process.execPath, [generatorPath, ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

async function createPrompt() {
  if (process.stdin.isTTY) {
    return readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const lines = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
  return {
    async question(query) {
      process.stdout.write(query);
      return lines.length > 0 ? lines.shift() : "";
    },
    close() {},
  };
}

async function askLine(rl, question, defaultValue = "") {
  const suffix = defaultValue ? ` ${color("dim", `[${defaultValue}]`)}` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || defaultValue;
}

async function askYesNo(rl, question, defaultValue = true) {
  const suffix = defaultValue ? "Y/n" : "y/N";
  while (true) {
    const answer = (await rl.question(`${question} ${color("dim", `[${suffix}]`)} `)).trim().toLowerCase();
    if (!answer) return defaultValue;
    if (["y", "yes"].includes(answer)) return true;
    if (["n", "no"].includes(answer)) return false;
    warn("Please answer yes or no.");
  }
}

async function askStaticChoice(rl, question, choices, defaultIndex = 0) {
  console.log(question);
  choices.forEach((choice, index) => {
    const isDefault = index === defaultIndex;
    const marker = isDefault ? color("green", "›") : " ";
    const label = isDefault ? color("bold", choice.label) : choice.label;
    console.log(`  ${marker} ${index + 1}. ${label}${choice.note ? color("dim", ` - ${choice.note}`) : ""}`);
  });
  while (true) {
    const answer = (await rl.question(`Select ${color("dim", `[${defaultIndex + 1}]`)}: `)).trim();
    const index = answer ? Number.parseInt(answer, 10) - 1 : defaultIndex;
    if (Number.isInteger(index) && choices[index]) return choices[index].value;
    warn("Please select a listed number.");
  }
}

async function isDirectory(filePath) {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

async function isEmptyDirectory(filePath) {
  try {
    return (await readdir(filePath)).length === 0;
  } catch {
    return false;
  }
}

async function isUsableStructorCheckout(repoRoot) {
  if (!(await isDirectory(repoRoot))) return false;
  const packageJson = await maybeReadJson(path.join(repoRoot, "package.json"));
  return (
    packageJson?.name === "@structor-dev/cli" &&
    await exists(path.join(repoRoot, "bin/structor.mjs")) &&
    await exists(path.join(repoRoot, "scripts/setup-contributor.mjs")) &&
    await exists(path.join(repoRoot, "contrib/self-harness/harness.config.json"))
  );
}

export function contributorWorkspacePlan(options = {}, cwd = process.cwd()) {
  const workspaceRoot = path.resolve(cwd, options.workspace ?? ".");
  const sourceRoot = path.join(workspaceRoot, "structor");
  const selfHarnessRoot = path.join(workspaceRoot, "structor-self");
  return {
    workspaceRoot,
    sourceRoot,
    selfHarnessRoot,
    repoUrl: options.repoUrl ?? structorRepoUrlDefault,
  };
}

function runCommand(command, args, cwd, stdio = "inherit") {
  const result = spawnSync(command, args, {
    cwd,
    stdio,
    encoding: stdio === "pipe" ? "utf8" : undefined,
  });
  if (result.error) throw result.error;
  return result;
}

function commandText(command, args) {
  return [command, ...args].join(" ");
}

export function shouldExcludeCandidate(name) {
  return (
    name.startsWith(".") ||
    name === "node_modules" ||
    name === "structor" ||
    name.endsWith("-structor") ||
    name.endsWith("-harness") ||
    name.endsWith("-engineering-harness")
  );
}

async function collectSignals(candidateRoot) {
  const signals = [];
  for (const signal of repoSignals) {
    if (await exists(path.join(candidateRoot, signal))) signals.push(signal);
  }
  return signals;
}

async function detectConsumerRepos(workspaceRoot) {
  const entries = await readdir(workspaceRoot, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || shouldExcludeCandidate(entry.name)) continue;
    const absolutePath = path.join(workspaceRoot, entry.name);
    const signals = await collectSignals(absolutePath);
    if (signals.length === 0) continue;
    candidates.push({
      name: slugify(entry.name),
      path: absolutePath,
      folderName: entry.name,
      signals,
    });
  }
  return candidates.sort((a, b) => a.folderName.localeCompare(b.folderName));
}

async function detectPackageManager(repoRoot) {
  if (await exists(path.join(repoRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (await exists(path.join(repoRoot, "yarn.lock"))) return "yarn";
  if (await exists(path.join(repoRoot, "package-lock.json"))) return "npm";
  if (await exists(path.join(repoRoot, "package.json"))) return "npm";
  return null;
}

export function packageCommand(packageManager, scriptName) {
  if (packageManager === "yarn") return `yarn ${scriptName}`;
  if (scriptName === "test") return `${packageManager} test`;
  return `${packageManager} run ${scriptName}`;
}

async function inferValidation(repoRoot) {
  const validation = {};
  const packageJson = await maybeReadJson(path.join(repoRoot, "package.json"));
  if (packageJson) {
    const packageManager = await detectPackageManager(repoRoot);
    if (packageManager === "pnpm") validation.install = "pnpm install";
    else if (packageManager === "yarn") validation.install = "yarn install";
    else validation.install = "npm install";
    const scripts = packageJson.scripts ?? {};
    for (const scriptName of ["lint", "test", "build"]) {
      if (scripts[scriptName]) validation[scriptName] = packageCommand(packageManager, scriptName);
    }
  }
  if (await exists(path.join(repoRoot, "go.mod"))) {
    validation.test ??= "go test ./...";
  }
  if (await exists(path.join(repoRoot, "Cargo.toml"))) {
    validation.test ??= "cargo test";
    validation.build ??= "cargo build";
  }
  if (await exists(path.join(repoRoot, "pyproject.toml"))) {
    const hasPytest =
      await exists(path.join(repoRoot, "pytest.ini")) ||
      await exists(path.join(repoRoot, "tests")) ||
      (await readFile(path.join(repoRoot, "pyproject.toml"), "utf8")).includes("pytest");
    if (hasPytest) validation.test ??= "python -m pytest";
  }
  return validation;
}

export function compactValidation(validation) {
  return Object.fromEntries(Object.entries(validation).filter(([, value]) => value.trim() !== ""));
}

function inferredPurpose(candidate) {
  return candidate.manual ? "Application repository" : "Detected consumer repository";
}

async function consumerFromCandidate(workspaceRoot, candidate) {
  return {
    name: slugify(candidate.name),
    path: relativeFrom(workspaceRoot, candidate.path),
    purpose: inferredPurpose(candidate),
    validation: compactValidation(await inferValidation(candidate.path)),
  };
}

function printValidationSummary(validation) {
  for (const key of ["install", "lint", "test", "build"]) {
    if (validation[key]) check(`${key}: ${validation[key]}`);
    else if (key === "test") console.log(`  ${key}: ${color("yellow", "not found")}`);
    else console.log(`  ${key}: ${color("dim", "not found")}`);
  }
  console.log(`  health: ${color("dim", "not configured")}`);
}

function printConsumerDetectionSummary(candidates) {
  for (const candidate of candidates) {
    console.log(`  - ${color("bold", candidate.folderName)} ${color("dim", relativeFrom(path.dirname(candidate.path), candidate.path))}`);
    if (candidate.signals?.length > 0) note(`    signals: ${candidate.signals.join(", ")}`);
  }
}

async function collectInferredConsumers(workspaceRoot, selectedCandidates) {
  const consumers = [];
  for (const candidate of selectedCandidates) {
    section(`Consumer: ${candidate.folderName}`);
    const consumer = await consumerFromCandidate(workspaceRoot, candidate);
    console.log(`Name: ${consumer.name}`);
    console.log(`Path: ${color("dim", consumer.path)}`);
    console.log(`Purpose: ${consumer.purpose}`);
    printValidationSummary(consumer.validation);
    consumers.push(consumer);
  }
  return consumers;
}

async function promptManualConsumers(rl, workspaceRoot, outputPath = "./project-structor") {
  const consumers = [];
  while (consumers.length === 0 || await askYesNo(rl, "Add another consumer repo?", false)) {
    section(`Consumer ${consumers.length + 1}`);
    const repoPath = await askLine(rl, "Path to consumer repo, relative to workspace", "./app");
    const absolutePath = path.resolve(workspaceRoot, repoPath);
    try {
      assertSafeConsumerPath({
        consumerName: slugify(path.basename(absolutePath)),
        consumerPath: repoPath,
        workspaceRoot,
        outputRoot: path.resolve(workspaceRoot, outputPath),
        repoRoot: packageRoot,
      });
    } catch (error) {
      warn(error instanceof Error ? error.message : String(error));
      continue;
    }
    if (!(await isDirectory(absolutePath))) {
      warn(`Path does not exist yet: ${absolutePath}`);
      if (!(await askYesNo(rl, "Use this path anyway?", false))) continue;
    }
    const folderName = path.basename(absolutePath);
    const consumer = await consumerFromCandidate(workspaceRoot, {
      name: slugify(folderName),
      path: absolutePath,
      folderName,
      signals: await collectSignals(absolutePath),
      manual: true,
    });
    section(`Consumer: ${folderName}`);
    console.log(`Name: ${consumer.name}`);
    console.log(`Path: ${color("dim", consumer.path)}`);
    console.log(`Purpose: ${consumer.purpose}`);
    printValidationSummary(consumer.validation);
    consumers.push(consumer);
  }
  return consumers;
}

async function promptConsumerRepos(rl, workspaceRoot, startingConfig) {
  if (startingConfig?.consumers?.length > 0 && await askYesNo(rl, "Use configured consumer repos?", true)) {
    return startingConfig.consumers;
  }

  const candidates = await detectConsumerRepos(workspaceRoot);
  if (candidates.length === 1) {
    section("Detected consumer repo");
    printConsumerDetectionSummary(candidates);
    if (await askYesNo(rl, "Use this repo?", true)) {
      return await collectInferredConsumers(workspaceRoot, candidates);
    }
    return await promptManualConsumers(rl, workspaceRoot);
  }

  if (candidates.length > 1) {
    section("Detected consumer repos");
    printConsumerDetectionSummary(candidates);
    if (await askYesNo(rl, "Continue with these repositories?", true)) {
      return await collectInferredConsumers(workspaceRoot, candidates);
    }
    return await promptManualConsumers(rl, workspaceRoot);
  }

  warn("No obvious sibling consumer repos found.");
  return await promptManualConsumers(rl, workspaceRoot);
}

function titleizeSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Project";
}

function projectInferenceBase(workspaceRoot, consumers) {
  if (consumers.length === 1) return consumers[0].name;
  return slugify(path.basename(workspaceRoot));
}

function inferProjectConfig(workspaceRoot, consumers, startingConfig) {
  if (startingConfig?.project?.name && startingConfig?.project?.slug) {
    return {
      name: startingConfig.project.name,
      slug: startingConfig.project.slug,
    };
  }
  const slug = slugify(projectInferenceBase(workspaceRoot, consumers));
  return {
    name: titleizeSlug(slug),
    slug,
  };
}

function projectSlugFromHarnessRepoName(harnessRepoName) {
  return slugify(harnessRepoName.replace(/-structor$/, ""));
}

function normalizeWorkspaceRelativePath(rawPath) {
  const normalized = rawPath.trim().replaceAll(path.sep, "/").replace(/\/+$/, "");
  if (!normalized) return "./project-structor";
  if (path.isAbsolute(normalized) || normalized.startsWith("./") || normalized.startsWith("../")) return normalized;
  return `./${normalized}`;
}

function printConfigSummary(config, configPath) {
  section("Config summary");
  console.log(`Config: ${configPath}`);
  console.log(`Project: ${config.project.name} (${config.project.slug})`);
  console.log(`Generated repo: ${config.output.path}`);
  console.log(`Models: ${config.models.openai ? "Codex" : ""}${config.models.openai && config.models.anthropic ? " + " : ""}${config.models.anthropic ? "Claude" : ""}`);
  console.log("Consumer repos:");
  for (const consumer of config.consumers) {
    console.log(`  - ${consumer.name}: ${consumer.path} (${consumer.purpose})`);
  }
}

function warnIfOutputIsNotWorkspaceChild(workspaceRoot, outputPath) {
  const outputRoot = path.resolve(workspaceRoot, outputPath);
  if (path.dirname(outputRoot) !== path.resolve(workspaceRoot)) {
    warn("Generated Structor repo path is not a direct child of the workspace. The sibling layout is recommended.");
  }
}

async function loadExistingConfig(configPath) {
  if (!(await exists(configPath))) return null;
  try {
    return await readJson(configPath);
  } catch (error) {
    throw new Error(`Could not read existing config ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function discoverWorkspaceConfigPath(workspaceRoot, explicitConfigPath = null) {
  if (explicitConfigPath) return path.resolve(workspaceRoot, explicitConfigPath);

  const workspaceConfigPath = path.join(workspaceRoot, configFileName);
  const matches = [];
  const skipDirectoryNames = new Set([".git", "node_modules"]);

  async function visitDirectory(directoryPath, depth = 0) {
    if (depth > 4) return;

    const candidatePath = path.join(directoryPath, configFileName);
    const candidate = await maybeReadJson(candidatePath);
    const resolvedWorkspaceRoot = candidate?.workspace?.root
      ? path.resolve(path.dirname(candidatePath), candidate.workspace.root)
      : null;
    if (resolvedWorkspaceRoot === workspaceRoot) {
      matches.push(candidatePath);
    }

    const entries = await readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || skipDirectoryNames.has(entry.name)) continue;
      await visitDirectory(path.join(directoryPath, entry.name), depth + 1);
    }
  }

  await visitDirectory(workspaceRoot);
  return matches.length === 1 ? matches[0] : workspaceConfigPath;
}

async function writeConfig(configPath, config) {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function configContent(config) {
  return `${JSON.stringify(config, null, 2)}\n`;
}

function durableConfigPathFor(workspaceRoot, outputPath) {
  return path.join(path.resolve(workspaceRoot, outputPath), configFileName);
}

function initConfigWithWorkspaceRoot(config, workspaceRoot) {
  const configPath = durableConfigPathFor(workspaceRoot, config.output.path);
  return {
    workspace: {
      root: relativeFrom(path.dirname(configPath), workspaceRoot),
    },
    ...config,
  };
}

function initCompletionCommands(harnessRoot) {
  return [
    commandText(process.execPath, ["scripts/validate-governance.mjs"]),
    commandText(process.execPath, ["scripts/check-workspace.mjs"]),
    `Config: ${path.join(harnessRoot, configFileName)}`,
  ];
}

export function nextValidationCommands(config) {
  const commands = [
    `cd ${config.output.path}`,
    "node scripts/validate-governance.mjs",
    "node scripts/bootstrap-workspace.mjs --dry-run",
    "node scripts/bootstrap-workspace.mjs",
    "node scripts/check-workspace.mjs",
  ];
  return commands;
}

function cleanHarnessReference(rawReference) {
  return rawReference.trim().replace(/^[`'"]+/, "").replace(/[`'",;:.)\]}]+$/, "");
}

function extractHarnessReferences(content, harnessRepoName) {
  const escapedName = harnessRepoName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp("(?:\\.\\.?/|/)[^`'\"\\s)<\\]}]*(?:" + escapedName + ")[^`'\"\\s)<\\]}]*", "g");
  return [...new Set((content.match(pattern) ?? []).map(cleanHarnessReference).filter(Boolean))];
}

function resolveHarnessReferenceTarget({ reference: rawReference, basePath, harnessRepoName }) {
  const reference = cleanHarnessReference(rawReference);
  const absoluteReference = path.isAbsolute(reference) ? path.resolve(reference) : path.resolve(basePath, reference);
  const parts = absoluteReference.split(path.sep);
  if (parts.lastIndexOf(harnessRepoName) === -1) return null;
  return absoluteReference;
}

function resolveHarnessReferenceRoot({ reference: rawReference, basePath, harnessRepoName }) {
  const target = resolveHarnessReferenceTarget({ reference: rawReference, basePath, harnessRepoName });
  if (!target) return null;
  const parts = target.split(path.sep);
  const index = parts.lastIndexOf(harnessRepoName);
  return parts.slice(0, index + 1).join(path.sep) || path.sep;
}

async function isFileTarget(targetPath) {
  try {
    return (await stat(targetPath)).isFile();
  } catch {
    return false;
  }
}

async function canonicalExistingPath(targetPath) {
  try {
    return await realpath(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

function isWithinRoot(root, candidate) {
  if (candidate === root) return true;
  return candidate.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

async function validateHarnessReferences({
  pointerPath,
  pointerContent,
  basePath,
  expectedHarnessRoot,
  harnessRepoName,
  models,
  requireHarnessReference = true,
}) {
  const references = extractHarnessReferences(pointerContent, harnessRepoName);
  if (references.length === 0) {
    return requireHarnessReference
      ? [`${pointerPath} does not contain a resolvable ${harnessRepoName} path.`]
      : [];
  }

  const issues = [];
  for (const reference of references) {
    const target = resolveHarnessReferenceTarget({ reference, basePath, harnessRepoName });
    const referenceRoot = resolveHarnessReferenceRoot({ reference, basePath, harnessRepoName });
    if (!target || !referenceRoot) {
      issues.push(`${pointerPath} does not contain a resolvable ${harnessRepoName} path.`);
      continue;
    }
    const canonicalReferenceRoot = await canonicalExistingPath(referenceRoot);
    const canonicalExpectedHarnessRoot = await canonicalExistingPath(expectedHarnessRoot);
    if (canonicalReferenceRoot !== canonicalExpectedHarnessRoot) {
      issues.push(`${pointerPath} points at ${referenceRoot} instead of ${expectedHarnessRoot}.`);
      continue;
    }

    const relativeTarget = path.relative(referenceRoot, target).replaceAll(path.sep, "/");
    if (!models.openai && relativeTarget === "AGENTS.md") {
      issues.push(`${pointerPath} must not reference ${relativeTarget} when OpenAI support is disabled.`);
    } else if (!models.anthropic && relativeTarget === "CLAUDE.md") {
      issues.push(`${pointerPath} must not reference ${relativeTarget} when Anthropic support is disabled.`);
    } else if (relativeTarget === "" || !(await isFileTarget(target))) {
      issues.push(`${pointerPath} references missing generated-harness file ${relativeTarget || "."}.`);
    } else {
      // The lexical reference root can match while the target file resolves,
      // via a symlink, to policy outside the harness. Require the canonical
      // (realpath-resolved) target to stay under the canonical harness root.
      const canonicalTarget = await canonicalExistingPath(target);
      if (!isWithinRoot(canonicalExpectedHarnessRoot, canonicalTarget)) {
        issues.push(`${pointerPath} resolves to ${canonicalTarget} outside the generated harness ${canonicalExpectedHarnessRoot}.`);
      }
    }
  }
  return issues;
}

async function readIfExists(filePath) {
  if (!(await exists(filePath))) return null;
  return readFile(filePath, "utf8");
}

async function collectEntrypointRoutingIssues({
  label,
  basePath,
  entrypoints,
  expectedHarnessRoot,
  harnessRepoName,
  models,
}) {
  const issues = [];
  for (const entrypoint of entrypoints) {
    const pointerPath = path.join(basePath, entrypoint.path);
    const pointerContent = await readIfExists(pointerPath);
    if (pointerContent === null) {
      issues.push(`${label}:${entrypoint.path} missing.`);
      continue;
    }
    if (entrypoint.routing === "claude-memory") {
      if (!pointerContent.includes("../CLAUDE.md")) {
        issues.push(`${label}:${entrypoint.path} must route through ../CLAUDE.md.`);
      }
      const referenceIssues = await validateHarnessReferences({
        pointerPath: `${label}:${entrypoint.path}`,
        pointerContent,
        basePath,
        expectedHarnessRoot,
        harnessRepoName,
        models,
        requireHarnessReference: false,
      });
      issues.push(...referenceIssues);
      continue;
    }
    const referenceIssues = await validateHarnessReferences({
      pointerPath: `${label}:${entrypoint.path}`,
      pointerContent,
      basePath,
      expectedHarnessRoot,
      harnessRepoName,
      models,
    });
    issues.push(...referenceIssues);
  }
  return issues;
}

function printDoctorCheck(results, status, label, detail = "") {
  results.push({ status, label, detail });
  const renderedStatus =
    status === "OK" ? color("green", "OK") :
    status === "WARN" ? color("yellow", "WARN") :
    color("red", "FAIL");
  console.log(`${renderedStatus} ${label}${detail ? ` - ${detail}` : ""}`);
}

async function doctor(options) {
  const results = [];
  const workspaceRoot = path.resolve(options.workspace ?? process.cwd());
  const configPath = await discoverWorkspaceConfigPath(workspaceRoot, options.config);
  section("Structor doctor");
  note("Diagnosis only. No files will be repaired or written.");

  let config = null;
  if (await exists(configPath)) {
    printDoctorCheck(results, "OK", "config file exists", configPath);
    try {
      config = await readJson(configPath);
      printDoctorCheck(results, "OK", "config file parses");
    } catch (error) {
      printDoctorCheck(results, "FAIL", "config file parses", error instanceof Error ? error.message : String(error));
    }
  } else {
    printDoctorCheck(results, "FAIL", "config file exists", configPath);
  }

  let resolvedConfig = null;
  if (config) {
    const shapeErrors = await validateConfigShape(config, configPath);
    if (shapeErrors.length === 0) {
      printDoctorCheck(results, "OK", "config shape is valid");
    } else {
      for (const error of shapeErrors) printDoctorCheck(results, "FAIL", "config shape is valid", error);
    }

    if (shapeErrors.length === 0) {
      try {
        resolvedConfig = await resolveHarnessConfig(config, {
          label: configPath,
          configPath,
          outputPath: config.output.path,
        });
        printDoctorCheck(results, "OK", "output root is safe", resolvedConfig.outputRoot);
      } catch (error) {
        printDoctorCheck(results, "FAIL", "output root is safe", error instanceof Error ? error.message : String(error));
      }
    }
  }

  if (resolvedConfig) {
    const { outputRoot, workspaceRoot: resolvedWorkspaceRoot, consumers, support } = resolvedConfig;
    const settings = { models: config.models, clientSupport: support };
    const harnessRepoName = config.project.harnessRepoName;
    const repoRequiredFiles = requiredHarnessRepoFilesForWorkspaceCheck(settings);
    const workspaceRequiredFiles = requiredWorkspaceFilesForWorkspaceCheck(settings);
    const workspaceRoutingEntrypoints = workspaceEntrypointsForSettings(settings).filter(
      (entrypoint) => entrypoint.routing !== "presence",
    );
    const consumerRoutingEntrypoints = consumerEntrypointsForSettings(settings);

    if (path.basename(outputRoot) === harnessRepoName) {
      printDoctorCheck(results, "OK", "generated harness folder name matches config", harnessRepoName);
    } else {
      printDoctorCheck(results, "FAIL", "generated harness folder name matches config", `expected ${harnessRepoName}, found ${path.basename(outputRoot)}`);
    }

    if (await isDirectory(outputRoot)) {
      printDoctorCheck(results, "OK", "generated harness output directory exists", outputRoot);
    } else {
      printDoctorCheck(results, "FAIL", "generated harness output directory exists", outputRoot);
    }

    const missingRepoFiles = [];
    for (const relativePath of repoRequiredFiles) {
      if (!(await exists(path.join(outputRoot, relativePath)))) missingRepoFiles.push(relativePath);
    }
    if (missingRepoFiles.length === 0) {
      printDoctorCheck(results, "OK", "generated harness required files exist");
    } else {
      for (const relativePath of missingRepoFiles) {
        printDoctorCheck(results, "FAIL", "generated harness required file exists", relativePath);
      }
    }

    const missingWorkspaceFiles = [];
    for (const relativePath of workspaceRequiredFiles) {
      if (!(await exists(path.join(resolvedWorkspaceRoot, relativePath)))) missingWorkspaceFiles.push(relativePath);
    }
    if (missingWorkspaceFiles.length === 0) {
      printDoctorCheck(results, "OK", "workspace entrypoint files exist");
    } else {
      for (const relativePath of missingWorkspaceFiles) {
        printDoctorCheck(results, "FAIL", "workspace entrypoint file exists", relativePath);
      }
    }

    const workspaceRoutingIssues = await collectEntrypointRoutingIssues({
      label: "workspace",
      basePath: resolvedWorkspaceRoot,
      entrypoints: workspaceRoutingEntrypoints,
      expectedHarnessRoot: outputRoot,
      harnessRepoName,
      models: config.models,
    });
    if (workspaceRoutingIssues.length === 0) {
      printDoctorCheck(results, "OK", "workspace pointer files route to generated harness");
    } else {
      for (const issue of workspaceRoutingIssues) printDoctorCheck(results, "FAIL", "workspace pointer file routes to generated harness", issue);
    }

    for (const consumer of consumers) {
      const consumerRoot = consumer.root;
      if (await isDirectory(consumerRoot)) {
        if (await hasConsumerRepositorySignal(consumerRoot)) {
          printDoctorCheck(results, "OK", `consumer repo exists: ${consumer.config.name}`, consumerRoot);
        } else {
          printDoctorCheck(results, "FAIL", `consumer repo exists: ${consumer.config.name}`, `missing repository signal at ${consumerRoot}`);
        }
      } else {
        printDoctorCheck(results, "FAIL", `consumer repo exists: ${consumer.config.name}`, consumerRoot);
        continue;
      }

      if (Object.values(consumer.config.validation ?? {}).some((value) => typeof value === "string" && value.trim() !== "")) {
        printDoctorCheck(results, "OK", `consumer validation command documented: ${consumer.config.name}`);
      } else {
        printDoctorCheck(results, "WARN", `consumer validation command documented: ${consumer.config.name}`, "no validation commands configured");
      }

      const consumerRoutingIssues = await collectEntrypointRoutingIssues({
        label: `consumer:${consumer.config.name}`,
        basePath: consumerRoot,
        entrypoints: consumerRoutingEntrypoints,
        expectedHarnessRoot: outputRoot,
        harnessRepoName,
        models: config.models,
      });
      if (consumerRoutingIssues.length === 0) {
        printDoctorCheck(results, "OK", `consumer pointer files route to generated harness: ${consumer.config.name}`);
      } else {
        for (const issue of consumerRoutingIssues) {
          printDoctorCheck(results, "FAIL", `consumer pointer file routes to generated harness: ${consumer.config.name}`, issue);
        }
      }
    }

    const manifestPath = path.join(outputRoot, ".structor/manifest.json");
    if (await exists(manifestPath)) {
      try {
        await readJson(manifestPath);
        printDoctorCheck(results, "OK", "manifest is present and parses", manifestPath);
      } catch (error) {
        printDoctorCheck(results, "WARN", "manifest is present but does not parse", error instanceof Error ? error.message : String(error));
      }
    } else {
      printDoctorCheck(results, "WARN", "manifest is present", "optional in doctor v1");
    }
  }

  const failures = results.filter((result) => result.status === "FAIL").length;
  const warnings = results.filter((result) => result.status === "WARN").length;
  if (failures > 0) {
    fail(`Structor doctor found ${failures} failure(s) and ${warnings} warning(s).`);
    process.exit(1);
  }
  success(`Structor doctor passed with ${warnings} warning(s).`);
}

function printNextSteps(config) {
  section("Next validation commands");
  note("Run these from the workspace after generation to prove harness policy and workspace routing are healthy.");
  for (const command of nextValidationCommands(config)) {
    console.log(`  ${command}`);
  }
}

function printSetupTransactionPreview(config, configPath) {
  const settings = {
    models: config.models,
    clientSupport: {
      codexHooks: config.clientSupport?.codex?.hooks ?? config.models.openai,
      claudeRules: config.clientSupport?.claude?.rules ?? false,
      claudeHooks: false,
      claudeSkills: false,
    },
  };

  section("Setup transaction preview");
  console.log(`Durable config: ${configPath}`);
  console.log(`Generated harness: ${config.output.path}`);
  console.log("Consumer entrypoints:");
  for (const consumer of config.consumers) {
    for (const entrypoint of consumerEntrypointsForSettings(settings)) {
      console.log(`  - ${consumer.path}/${entrypoint.path}`);
    }
  }
  console.log("Workspace entrypoints:");
  for (const entrypoint of workspaceEntrypointsForSettings(settings)) {
    console.log(`  - ${entrypoint.path}`);
  }
  console.log("Completion gates:");
  console.log("  - node scripts/validate-governance.mjs");
  console.log("  - node scripts/check-workspace.mjs");
}

function groupedGuidanceConflicts(conflicts) {
  const groups = new Map();
  for (const conflict of conflicts) {
    const current = groups.get(conflict.consumer) ?? {
      consumer: conflict.consumer,
      consumerPath: conflict.consumerPath,
      consumerRoot: conflict.consumerRoot,
      files: [],
    };
    current.files.push(conflict);
    groups.set(conflict.consumer, current);
  }
  return [...groups.values()];
}

function preservedGuidancePlan(conflicts, timestamp) {
  return Object.fromEntries(groupedGuidanceConflicts(conflicts).map((group) => [
    group.consumer,
    {
      directory: `.structor/preserved-guidance/${timestamp}`,
      files: group.files.map((file) => `.structor/preserved-guidance/${timestamp}/${file.path}`),
    },
  ]));
}

async function confirmPreserveExistingGuidance(rl, conflicts, timestamp, options) {
  if (conflicts.length === 0) return true;
  if (options.preserveExistingGuidance) return true;
  if (options.yes) {
    throw new Error(
      `Existing root guidance files require explicit preservation consent:\n${conflicts.map((conflict) => `- ${conflict.targetPath}`).join("\n")}\nRe-run without --yes to choose interactively, or pass --yes --preserve-existing-guidance.`,
    );
  }

  section("Existing root guidance files were found");
  for (const conflict of conflicts) console.log(`  ${conflict.targetPath}`);
  console.log("Structor needs to replace root guidance entrypoints so agents route through the generated harness.");
  console.log("Structor will preserve your existing files as consumer-local source material before generating new root entrypoints.");
  console.log("Preserved guidance will be stored at:");
  for (const group of groupedGuidanceConflicts(conflicts)) {
    console.log(`  ${path.join(group.consumerRoot, ".structor", "preserved-guidance", timestamp)}/`);
  }
  const choice = await askStaticChoice(rl, "Continue?", [
    { label: "Preserve existing guidance and generate Structor entrypoints", value: "preserve" },
    { label: "Abort", value: "abort" },
  ], 0);
  if (choice !== "preserve") {
    warn("Stopped before generation.");
    return false;
  }
  return true;
}

function printInitReadinessSummary({ generated, harnessRoot, preservedGuidanceByConsumer }) {
  success("Structor setup complete.");
  console.log("setup_complete: true");
  console.log("guidance_ready: false");

  section("Generated root entrypoints");
  for (const entrypoint of generated.consumerEntrypoints.filter((item) => item.path === "AGENTS.md" || item.path === "CLAUDE.md")) {
    console.log(`  ${path.join(generated.resolvedConfig.workspaceRoot, entrypoint.consumerPath, entrypoint.path)}`);
  }

  const preservedFiles = Object.entries(preservedGuidanceByConsumer)
    .flatMap(([consumerName, preserved]) => {
      const consumer = generated.resolvedConfig.consumers.find((item) => item.config.name === consumerName);
      const consumerRoot = consumer?.confirmedRoot ?? consumer?.root;
      return consumerRoot ? preserved.files.map((file) => path.join(consumerRoot, file)) : [];
    });
  if (preservedFiles.length > 0) {
    section("Preserved existing guidance");
    for (const filePath of preservedFiles) console.log(`  ${filePath}`);
  }

  section("Generated harness");
  console.log(`  ${harnessRoot}/`);

  section("Next step");
  console.log(color("red", color("bold", "IMPORTANT")));
  console.log("Populate the generated harness before using it for real project work.");
  console.log(`  Open ${path.join(harnessRoot, "ai/tasks/populate-generated-harness.md")}`);
  console.log(`  Use the prompt at ${path.join(harnessRoot, "ai/templates/populate-generated-harness-prompt.md")}`);
  console.log("  Run it locally with Codex or Claude using a frontier model such as GPT-5.5 or Opus 4.8.");
  console.log("  Manually verify generated content, navigation, references, and commands before treating the harness as guidance-ready.");
}

async function runGeneratedNodeScript({ harnessRoot, relativeScriptPath, args = [], failureLabel }) {
  const result = spawnSync(process.execPath, [relativeScriptPath, ...args], {
    cwd: harnessRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  printCommandOutput(result);
  if (result.status !== 0) {
    throw new Error(failureLabel);
  }
}

function assertGeneratedScriptsReady(generatedFiles, scriptPaths) {
  const filesByPath = new Map(generatedFiles.map((file) => [file.targetRelative, file]));
  const notReady = [];
  for (const scriptPath of scriptPaths) {
    const file = filesByPath.get(scriptPath);
    if (!file || file.action === "skipped" || !file.rendered) {
      notReady.push(scriptPath);
    }
  }

  if (notReady.length > 0) {
    throw new Error(
      `Generated setup scripts were not refreshed or verified:\n${notReady.map((item) => `- ${item}`).join("\n")}\nInspect the existing files and re-run with --force if they should be replaced.`,
    );
  }
}

async function assertNoEntrypointConflicts({ config, resolvedConfig, harnessRoot, force }) {
  if (force) return;

  const settings = { models: config.models, clientSupport: resolvedConfig.support };
  const conflicts = [];
  const templateWorkspaceRoot = config.workspace?.root
    ? path.resolve(harnessRoot, config.workspace.root)
    : path.dirname(harnessRoot);
  const harnessValues = harnessTemplateValues(
    config,
    resolvedConfig.support,
    resolvedConfig.consumers,
    harnessRoot,
    templateWorkspaceRoot,
  );

  for (const entrypoint of workspaceEntrypointsForSettings(settings)) {
    const targetPath = path.join(resolvedConfig.workspaceRoot, entrypoint.path);
    if (!(await exists(targetPath))) continue;

    const templatePath = path.join(packageRoot, "template", entrypoint.template);
    const [actual, template] = await Promise.all([
      readFile(targetPath, "utf8"),
      readFile(templatePath, "utf8"),
    ]);
    const expected = render(template, harnessValues);
    if (actual !== expected) {
      conflicts.push(`workspace:${entrypoint.path}`);
    }
  }

  for (const resolvedConsumer of resolvedConfig.consumers) {
    const consumer = resolvedConsumer.config;
    const consumerRoot = resolvedConsumer.confirmedRoot ?? resolvedConsumer.root;
    const harnessRelativePath = path.relative(consumerRoot, harnessRoot).replaceAll(path.sep, "/") || ".";
    const values = consumerEntrypointValues(config, consumer, harnessRelativePath);

    for (const entrypoint of consumerEntrypointsForSettings(settings)) {
      if (entrypoint.path === "AGENTS.md" || entrypoint.path === "CLAUDE.md") continue;
      const targetPath = path.join(consumerRoot, entrypoint.path);
      if (!(await exists(targetPath))) continue;

      const templatePath = path.join(packageRoot, "template", entrypoint.template);
      const [actual, template] = await Promise.all([
        readFile(targetPath, "utf8"),
        readFile(templatePath, "utf8"),
      ]);
      const expected = render(template, values);
      if (actual !== expected) {
        conflicts.push(`consumer:${consumer.name}:${entrypoint.path}`);
      }
    }
  }

  if (conflicts.length > 0) {
    throw new Error(
      `Entrypoint conflicts detected before bootstrap:\n${conflicts.map((item) => `- ${item}`).join("\n")}\nRe-run with --force to overwrite known Structor pointer surfaces.`,
    );
  }
}

async function removeEmptyParents(startPath, stopPath) {
  let current = path.dirname(startPath);
  const resolvedStop = path.resolve(stopPath);
  while (current.startsWith(resolvedStop) && current !== resolvedStop) {
    try {
      await rmdir(current);
    } catch (error) {
      if (error?.code === "ENOTEMPTY" || error?.code === "ENOENT") return;
      throw error;
    }
    current = path.dirname(current);
  }
}

async function cleanupFailedInit({
  harnessRoot,
  harnessRootExisted,
  workspaceRoot,
  workspaceCreatedPaths,
  consumerCreatedPaths,
  consumerRestores,
  consumerPreservationDirs,
  harnessCreatedPaths,
}) {
  for (const restore of consumerRestores) {
    await writeFile(restore.targetPath, restore.content);
  }

  for (const preservePath of consumerPreservationDirs) {
    await rm(preservePath, { recursive: true, force: true });
    await removeEmptyParents(preservePath, workspaceRoot);
  }

  for (const targetPath of [...workspaceCreatedPaths, ...consumerCreatedPaths]) {
    await rm(targetPath, { force: true });
    await removeEmptyParents(targetPath, workspaceRoot);
  }

  if (!harnessRootExisted) {
    await rm(harnessRoot, { recursive: true, force: true });
    return;
  }

  for (const targetPath of harnessCreatedPaths) {
    await rm(targetPath, { force: true });
    await removeEmptyParents(targetPath, harnessRoot);
  }
}

async function printContributorPlan(plan, options, sourceReady) {
  section(options.dryRun ? "Contributor workspace preview" : "Contributor workspace");
  console.log(`Workspace: ${plan.workspaceRoot}`);
  console.log(`Structor source: ${plan.sourceRoot}`);
  console.log(`Structor self-harness: ${plan.selfHarnessRoot}`);
  console.log(`Repo URL: ${plan.repoUrl}`);
  console.log(`Source checkout: ${sourceReady ? "reuse existing local checkout" : "clone required"}`);

  section("Network reads");
  if (sourceReady) {
    console.log("  - none; existing local Structor checkout will be reused");
  } else {
    console.log(`  - ${commandText("git", ["clone", plan.repoUrl, plan.sourceRoot])}`);
  }

  section("Local filesystem writes");
  if (!sourceReady) console.log(`  - create or use workspace folder ${plan.workspaceRoot}`);
  if (!sourceReady) console.log(`  - create Structor checkout ${plan.sourceRoot}`);
  console.log(`  - generate or refresh self-harness ${plan.selfHarnessRoot}`);
  console.log("  - install missing source repo agent entrypoint pointers");
  if (options.force) {
    console.log("  - overwrite existing source repo agent entrypoint pointers because --force was provided");
  } else {
    console.log("  - skip existing source repo agent entrypoint pointers unless --force is provided");
  }

  section("Validation");
  console.log(`  - ${commandText(process.execPath, ["scripts/setup-contributor.mjs", ...(options.dryRun ? ["--dry-run"] : []), ...(options.force ? ["--force"] : [])])}`);
  console.log(`  - ${commandText(process.execPath, ["scripts/validate-governance.mjs"])} in ${plan.selfHarnessRoot}`);
  console.log(`  - ${commandText(process.execPath, ["scripts/check-workspace.mjs"])} in ${plan.selfHarnessRoot}`);
  console.log(`  - deferred source validation: cd ${plan.sourceRoot} && npm run validate`);
}

async function confirmContributorRun(options, plan, sourceReady) {
  if (options.yes || options.dryRun) return true;
  const rl = await createPrompt();
  try {
    await printContributorPlan(plan, options, sourceReady);
    return await askYesNo(rl, "Continue with local writes and any required clone read?", false);
  } finally {
    rl.close();
  }
}

async function ensureStructorCheckout(plan, options) {
  const sourceReady = await isUsableStructorCheckout(plan.sourceRoot);
  if (sourceReady) return { sourceReady: true, cloned: false };

  if (await exists(plan.sourceRoot) && !(await isEmptyDirectory(plan.sourceRoot))) {
    throw new Error(
      `Existing ${plan.sourceRoot} is not a usable Structor checkout. Move it, choose a different --workspace, or provide a workspace with a valid structor checkout.`,
    );
  }

  if (options.dryRun) return { sourceReady: false, cloned: false };

  await mkdir(plan.workspaceRoot, { recursive: true });
  section("Clone Structor source");
  note("Network read only: this clones source code and does not authenticate, fork, push, open PRs, or mutate remotes.");
  const clone = runCommand("git", ["clone", plan.repoUrl, plan.sourceRoot], process.cwd());
  if (clone.status !== 0) throw new Error(`Clone failed: ${commandText("git", ["clone", plan.repoUrl, plan.sourceRoot])}`);
  if (!(await isUsableStructorCheckout(plan.sourceRoot))) {
    throw new Error(`Clone completed but ${plan.sourceRoot} is not a usable Structor checkout.`);
  }
  return { sourceReady: false, cloned: true };
}

function runContributorValidation(plan) {
  section("Validate self-harness");
  const validationCommands = [
    [process.execPath, ["scripts/validate-governance.mjs"]],
    [process.execPath, ["scripts/check-workspace.mjs"]],
  ];
  for (const [command, args] of validationCommands) {
    console.log(`$ ${commandText(command, args)}`);
    const result = runCommand(command, args, plan.selfHarnessRoot);
    if (result.status !== 0) {
      throw new Error(`Validation failed in ${plan.selfHarnessRoot}: ${commandText(command, args)}`);
    }
  }
}

function printContributorSummary(plan, setupArgs, validationRan) {
  section("Structor contributor workspace ready");
  console.log(`Workspace: ${plan.workspaceRoot}`);
  console.log(`Structor source: ${plan.sourceRoot}`);
  console.log(`Structor self-harness: ${plan.selfHarnessRoot}`);
  console.log(`Contributor setup: ${commandText(process.execPath, setupArgs)}`);
  console.log(`Validation: ${validationRan ? "passed" : "preview only; no validation commands were run"}`);

  section("Next agent prompt");
  console.log(`Work in ${plan.sourceRoot} using the sibling self-harness at ${plan.selfHarnessRoot}. Read AGENTS.md, ai/HUB.md, and the relevant issue, then make the smallest Structor change with validation evidence.`);
}

async function contributeStructor(options) {
  if (options._.length !== 1) {
    throw new Error("Usage: structor contribute structor [--workspace <path>] [--repo-url <url-or-path>] [--yes] [--dry-run] [--force]");
  }
  const plan = contributorWorkspacePlan(options);
  const sourceReady = await isUsableStructorCheckout(plan.sourceRoot);
  if (!(await confirmContributorRun(options, plan, sourceReady))) {
    warn("Stopped before cloning, generating, or writing local files.");
    return;
  }

  if (options.dryRun) {
    await printContributorPlan(plan, options, sourceReady);
    return;
  }

  await ensureStructorCheckout(plan, options);

  section("Generate Structor self-harness");
  const setupArgs = ["scripts/setup-contributor.mjs"];
  if (options.force) setupArgs.push("--force");
  const setup = runCommand(process.execPath, setupArgs, plan.sourceRoot);
  if (setup.status !== 0) throw new Error(`Contributor setup failed: ${commandText(process.execPath, setupArgs)}`);

  runContributorValidation(plan);
  printContributorSummary(plan, setupArgs, true);
}

async function init(options) {
  const rl = await createPrompt();
  try {
    console.log(color("bold", "Structor init"));
    note("Local-only, deterministic setup. No network calls, no remote services, and no writes without confirmation.");

    const workspaceDefault = options.workspace ? path.resolve(options.workspace) : process.cwd();
    const workspaceRoot = path.resolve(await askLine(rl, "Workspace folder", workspaceDefault));
    const legacyConfigPath = await discoverWorkspaceConfigPath(workspaceRoot, options.config);
    const existingConfig = await loadExistingConfig(legacyConfigPath);
    let startingConfig = null;
    if (existingConfig) {
      printConfigSummary(existingConfig, legacyConfigPath);
      if (await askYesNo(rl, "Use this existing config as the starting point?", true)) {
        startingConfig = existingConfig;
      } else {
        warn("Continuing will replace the config draft only after confirmation.");
      }
    }

    section("Consumer repos");
    note("For best results, run Structor from the workspace folder that contains your consumer repos as siblings.");
    const consumers = await promptConsumerRepos(rl, workspaceRoot, startingConfig);

    const inferredProject = inferProjectConfig(workspaceRoot, consumers, startingConfig);
    section("Project");
    console.log(`Project: ${inferredProject.name} (${inferredProject.slug})`);
    const defaultHarnessDirectory = startingConfig?.output?.path ?? `./${startingConfig?.project?.harnessRepoName ?? `${inferredProject.slug}-structor`}`;
    const outputPath = normalizeWorkspaceRelativePath(await askLine(rl, "Harness directory", defaultHarnessDirectory));
    const harnessRepoName = path.basename(outputPath);
    if (!harnessRepoName.endsWith("-structor")) {
      warn("Harness directory basename does not end with -structor. This is allowed, but the suffix is recommended.");
    }
    const hasExistingProjectIdentity = startingConfig?.project?.name && startingConfig?.project?.slug;
    const projectSlug = hasExistingProjectIdentity
      ? startingConfig.project.slug
      : projectSlugFromHarnessRepoName(harnessRepoName);
    const projectName = hasExistingProjectIdentity
      ? startingConfig.project.name
      : titleizeSlug(projectSlug);

    section("Agent clients");
    const defaultModelIndex =
      startingConfig?.models?.openai && !startingConfig?.models?.anthropic ? 1 :
      !startingConfig?.models?.openai && startingConfig?.models?.anthropic ? 2 :
      0;
    const modelChoice = await askStaticChoice(rl, "Agent client support", [
      { label: "Codex and Claude", value: "both" },
      { label: "Codex only", value: "openai" },
      { label: "Claude only", value: "anthropic" },
    ], defaultModelIndex);

    section("Customization");
    note("Starter only creates generic harness content. It does not infer real contracts or coding conventions.");
    note("Light Scan and Deep Scan are planned future opt-in Consumer Repo Scan modes.");

    const config = {
      project: {
        name: projectName,
        slug: projectSlug,
        harnessRepoName,
      },
      output: {
        path: outputPath,
      },
      models: {
        openai: modelChoice === "both" || modelChoice === "openai",
        anthropic: modelChoice === "both" || modelChoice === "anthropic",
      },
      clientSupport: {
        codex: {
          hooks: modelChoice === "both" || modelChoice === "openai",
        },
        claude: {
          rules: false,
          hooks: false,
          skills: false,
        },
      },
      consumers,
    };

    const initConfig = initConfigWithWorkspaceRoot(config, workspaceRoot);
    const configPath = durableConfigPathFor(workspaceRoot, initConfig.output.path);
    printConfigSummary(initConfig, configPath);
    warnIfOutputIsNotWorkspaceChild(workspaceRoot, config.output.path);
    note("harness.config.json will be persisted inside the generated harness so init can finish with a fully bootstrapped workspace.");
    printSetupTransactionPreview(initConfig, configPath);
    const canContinue = existingConfig
      ? await askYesNo(rl, "Replace the generated harness config with this setup?", false)
      : await askYesNo(rl, "Continue with this setup?", true);
    if (!canContinue) {
      warn("Stopped before generation.");
      return;
    }

    section("Dry-run preview");
    note("The initializer dry-run renders the generated harness plan before any files are written.");
    const renderedConfig = configContent(initConfig);
    const dryRunGenerated = await generateHarness(initConfig, {
      configPath,
      configContent: renderedConfig,
      requireExistingConsumers: true,
      dryRun: true,
    });
    const rootGuidanceConflicts = await collectConsumerRootGuidanceConflicts(dryRunGenerated.resolvedConfig);
    const preservationTimestamp = filesystemTimestamp();
    const preservedGuidanceByConsumer = preservedGuidancePlan(rootGuidanceConflicts, preservationTimestamp);

    const apply = options.yes || await askYesNo(rl, "Generate harness now?", true);
    if (!apply) {
      warn("Stopped after dry-run preview.");
      return;
    }
    if (!(await confirmPreserveExistingGuidance(rl, rootGuidanceConflicts, preservationTimestamp, options))) {
      return;
    }

    section("Generate");
    const harnessRoot = path.dirname(configPath);
    const harnessRootExisted = await exists(harnessRoot);
    const workspaceCreatedPaths = [];
    const consumerCreatedPaths = [];
    const consumerRestores = [];
    const consumerPreservationDirs = [];
    const harnessCreatedPaths = [];

    try {
      await assertNoEntrypointConflicts({
        config: initConfig,
        resolvedConfig: dryRunGenerated.resolvedConfig,
        harnessRoot,
        force: options.force,
      });

      const generated = await generateHarness(initConfig, {
        configPath,
        configContent: renderedConfig,
        requireExistingConsumers: true,
        force: options.force,
        dryRun: false,
        preservedGuidanceByConsumer,
      });
      harnessCreatedPaths.push(
        ...generated.generatedFiles
          .filter((file) => file.action === "created")
          .map((file) => file.targetPath),
      );
      if (generated.manifestFile?.action === "created") {
        harnessCreatedPaths.push(generated.manifestFile.targetPath);
      }
      assertGeneratedScriptsReady(generated.generatedFiles, [
        "scripts/bootstrap-workspace.mjs",
        "scripts/validate-governance.mjs",
        "scripts/check-workspace.mjs",
      ]);

      const durableConfigExisted = await exists(configPath);
      await writeConfig(configPath, initConfig);
      success(`${durableConfigExisted ? "Updated" : "Wrote"} ${configPath}`);
      if (!durableConfigExisted) harnessCreatedPaths.push(configPath);

      const consumerEntrypoints = await installConsumerEntrypoints(generated.resolvedConfig, {
        dryRun: false,
        force: options.force,
        preserveExistingGuidance: rootGuidanceConflicts.length > 0,
        preservationTimestamp,
        preservedGuidanceByConsumer,
      });
      generated.consumerEntrypoints = consumerEntrypoints;
      consumerCreatedPaths.push(
        ...consumerEntrypoints
          .filter((entrypoint) => entrypoint.action === "created")
          .map((entrypoint) => path.join(generated.resolvedConfig.workspaceRoot, entrypoint.consumerPath, entrypoint.path)),
      );
      consumerRestores.push(
        ...consumerEntrypoints
          .filter((entrypoint) => entrypoint.action === "wrote" && typeof entrypoint.previousContent === "string")
          .map((entrypoint) => ({
            targetPath: entrypoint.targetPath ?? path.join(generated.resolvedConfig.workspaceRoot, entrypoint.consumerPath, entrypoint.path),
            content: entrypoint.previousContent,
          })),
      );
      consumerPreservationDirs.push(
        ...new Set(consumerEntrypoints
          .filter((entrypoint) => entrypoint.preservedGuidanceDirectory)
          .map((entrypoint) => path.join(
            generated.resolvedConfig.workspaceRoot,
            entrypoint.consumerPath,
            entrypoint.preservedGuidanceDirectory,
          ))),
      );

      const settings = { models: initConfig.models, clientSupport: generated.resolvedConfig.support };
      for (const entrypoint of workspaceEntrypointsForSettings(settings)) {
        const targetPath = path.join(generated.resolvedConfig.workspaceRoot, entrypoint.path);
        if (!(await exists(targetPath))) workspaceCreatedPaths.push(targetPath);
      }

      section("Workspace bootstrap");
      await runGeneratedNodeScript({
        harnessRoot,
        relativeScriptPath: "scripts/bootstrap-workspace.mjs",
        args: options.force ? ["--force"] : [],
        failureLabel: "Workspace bootstrap failed.",
      });

      section("Completion gates");
      await runGeneratedNodeScript({
        harnessRoot,
        relativeScriptPath: "scripts/validate-governance.mjs",
        failureLabel: "Generated governance validation failed.",
      });
      await runGeneratedNodeScript({
        harnessRoot,
        relativeScriptPath: "scripts/check-workspace.mjs",
        failureLabel: "Workspace completion check failed.",
      });
    } catch (error) {
      await cleanupFailedInit({
        harnessRoot,
        harnessRootExisted,
        workspaceRoot,
        workspaceCreatedPaths,
        consumerCreatedPaths,
        consumerRestores,
        consumerPreservationDirs,
        harnessCreatedPaths,
      });
      throw error;
    }

    const finalGenerated = {
      resolvedConfig: dryRunGenerated.resolvedConfig,
      consumerEntrypoints: consumerEntrypointsForSettings({
        models: initConfig.models,
        clientSupport: dryRunGenerated.resolvedConfig.support,
      }).flatMap((entrypoint) => initConfig.consumers.map((consumer) => ({
        consumer: consumer.name,
        consumerPath: consumer.path,
        path: entrypoint.path,
      }))),
    };
    printInitReadinessSummary({ generated: finalGenerated, harnessRoot, preservedGuidanceByConsumer });
    section("Setup ready");
    note("No post-success bootstrap steps are required.");
    for (const command of initCompletionCommands(harnessRoot)) {
      console.log(`  ${command}`);
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const { command, options, rawArgs } = parseArgs(process.argv.slice(2));
  if (command === "--version" || command === "-v" || options.version) {
    const metadata = await readPackageMetadata();
    console.log(metadata.version);
    return;
  }
  if (options.help || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  if (command === "init") {
    assertNoUnknownCommandFlags(command, options);
    await init(options);
    return;
  }
  if (command === "generate") {
    passthroughGenerate(rawArgs);
    return;
  }
  if (command === "contribute") {
    const [target] = options._;
    if (target !== "structor") {
      throw new Error("Unknown contribute target. Supported target: structor");
    }
    await contributeStructor(options);
    return;
  }
  if (command === "doctor") {
    assertNoUnknownCommandFlags(command, options);
    await doctor(options);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

async function isDirectCliInvocation() {
  if (!process.argv[1]) return false;

  const invokedPath = await realpath(process.argv[1]).catch(() => path.resolve(process.argv[1]));
  const modulePath = await realpath(fileURLToPath(import.meta.url)).catch(() => fileURLToPath(import.meta.url));
  return pathToFileURL(invokedPath).href === pathToFileURL(modulePath).href;
}

if (await isDirectCliInvocation()) {
  main().catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
