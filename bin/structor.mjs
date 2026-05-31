#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { access, mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
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
  consumerEntrypointsForSettings,
  requiredHarnessRepoFilesForWorkspaceCheck,
  requiredWorkspaceFilesForWorkspaceCheck,
  workspaceEntrypointsForSettings,
} from "../scripts/generated-harness-contract.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatorPath = path.join(packageRoot, "scripts/init-harness.mjs");
const configFileName = "harness.config.json";
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
    else if (arg === "--force") options.force = true;
    else if (arg === "--workspace") options.workspace = rest[++index];
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
  console.log(`Structor\n\nUsage:\n  structor init [--workspace <path>] [--config <path>] [--yes]\n  structor generate --config <path> [generator options]\n  structor doctor [--workspace <path>] [--config <path>]\n\nCommands:\n  init      Guided local setup for a Structor workspace.\n  generate  Render a generated harness from an existing config.\n  doctor    Diagnose local Structor workspace drift without repairing files.\n`);
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

async function askChoice(rl, question, choices, defaultIndex = 0) {
  console.log(question);
  choices.forEach((choice, index) => {
    const marker = index === defaultIndex ? "*" : " ";
    console.log(`  ${marker} ${index + 1}. ${choice.label}${choice.note ? color("dim", ` - ${choice.note}`) : ""}`);
  });
  while (true) {
    const answer = (await rl.question(`Select ${color("dim", `[${defaultIndex + 1}]`)}: `)).trim();
    const index = answer ? Number.parseInt(answer, 10) - 1 : defaultIndex;
    if (Number.isInteger(index) && choices[index]) return choices[index].value;
    warn("Please select a listed number.");
  }
}

async function askMultiSelect(rl, question, choices, defaultIndexes) {
  console.log(question);
  choices.forEach((choice, index) => {
    const marker = defaultIndexes.includes(index) ? "*" : " ";
    console.log(`  ${marker} ${index + 1}. ${choice.label}${choice.note ? color("dim", ` - ${choice.note}`) : ""}`);
  });
  const defaultValue = defaultIndexes.map((index) => index + 1).join(",");
  while (true) {
    const answer = (await rl.question(`Select comma-separated numbers ${color("dim", `[${defaultValue}]`)}: `)).trim();
    const raw = answer || defaultValue;
    const indexes = raw.split(",").map((item) => Number.parseInt(item.trim(), 10) - 1);
    if (indexes.length > 0 && indexes.every((index) => Number.isInteger(index) && choices[index])) {
      return [...new Set(indexes)].map((index) => choices[index].value);
    }
    warn("Please enter one or more listed numbers, for example 1,2.");
  }
}

async function isDirectory(filePath) {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
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

async function collectConsumerDetails(rl, workspaceRoot, selectedCandidates) {
  const consumers = [];
  for (const candidate of selectedCandidates) {
    section(`Consumer: ${candidate.folderName}`);
    const name = await askLine(rl, "Consumer name", candidate.name);
    const purpose = await askLine(rl, "Purpose", "Application repository");
    const suggestions = await inferValidation(candidate.path);
    note("Validation commands are stored in harness.config.json for agents to run later. Leave unknown commands blank.");
    const validation = {};
    for (const key of ["install", "lint", "test", "build", "health"]) {
      validation[key] = await askLine(rl, `${key} command`, suggestions[key] ?? "");
    }
    consumers.push({
      name: slugify(name),
      path: relativeFrom(workspaceRoot, candidate.path),
      purpose,
      validation: compactValidation(validation),
    });
  }
  return consumers;
}

async function promptManualConsumers(rl, workspaceRoot, outputPath) {
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
    const [consumer] = await collectConsumerDetails(rl, workspaceRoot, [{
      name: slugify(folderName),
      path: absolutePath,
      folderName,
      signals: await collectSignals(absolutePath),
    }]);
    consumers.push(consumer);
  }
  return consumers;
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

async function writeConfig(configPath, config) {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
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
  const configPath = path.resolve(workspaceRoot, options.config ?? configFileName);
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

async function init(options) {
  const rl = await createPrompt();
  try {
    console.log(color("bold", "Structor init"));
    note("Local-only, deterministic setup. No network calls, no remote services, and no writes without confirmation.");

    const workspaceDefault = options.workspace ? path.resolve(options.workspace) : process.cwd();
    const workspaceRoot = path.resolve(await askLine(rl, "Workspace folder", workspaceDefault));
    const configPath = path.resolve(workspaceRoot, options.config ?? configFileName);
    const existingConfig = await loadExistingConfig(configPath);
    let startingConfig = null;
    if (existingConfig) {
      printConfigSummary(existingConfig, configPath);
      if (await askYesNo(rl, "Use this existing config as the starting point?", true)) {
        startingConfig = existingConfig;
      } else {
        warn("Continuing will replace the config draft only after confirmation.");
      }
    }

    section("Project");
    const projectName = await askLine(rl, "Project name", startingConfig?.project?.name ?? path.basename(workspaceRoot));
    const projectSlug = slugify(await askLine(rl, "Project slug", startingConfig?.project?.slug ?? slugify(projectName)));
    const harnessRepoName = await askLine(rl, "Generated Structor repo folder", startingConfig?.project?.harnessRepoName ?? `${projectSlug}-structor`);
    const outputPath = await askLine(rl, "Generated Structor repo path", startingConfig?.output?.path ?? `./${harnessRepoName}`);

    section("Agent clients");
    const defaultModelIndex =
      startingConfig?.models?.openai && !startingConfig?.models?.anthropic ? 1 :
      !startingConfig?.models?.openai && startingConfig?.models?.anthropic ? 2 :
      0;
    const modelChoice = await askChoice(rl, "Which agent clients should this harness support?", [
      { label: "Codex and Claude", value: "both" },
      { label: "Codex only", value: "openai" },
      { label: "Claude only", value: "anthropic" },
    ], defaultModelIndex);

    section("Customization");
    await askChoice(rl, "How much should Structor customize from consumer repos?", [
      { label: "Starter only", value: "starter", note: "available now" },
      { label: "Light scan", value: "starter", note: "coming soon" },
      { label: "Deep scan", value: "starter", note: "coming soon" },
    ]);
    note("Starter only creates generic harness content. It does not infer real contracts or coding conventions.");

    section("Consumer repos");
    note("For best results, run Structor from the workspace folder that contains your consumer repos as siblings.");
    let consumers;
    if (startingConfig?.consumers?.length > 0 && await askYesNo(rl, "Use configured consumer repos?", true)) {
      consumers = startingConfig.consumers;
    } else {
      const candidates = await detectConsumerRepos(workspaceRoot);
      if (candidates.length > 0) {
      const selected = await askMultiSelect(
        rl,
        "Found likely consumer repos:",
        candidates.map((candidate) => ({
          label: candidate.folderName,
          value: candidate,
          note: candidate.signals.join(", "),
        })),
        candidates.map((_, index) => index),
      );
      consumers = await collectConsumerDetails(rl, workspaceRoot, selected);
      } else {
      warn("No obvious sibling consumer repos found.");
      consumers = await promptManualConsumers(rl, workspaceRoot, outputPath);
      }
    }

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
          rules: modelChoice === "both" || modelChoice === "anthropic",
          hooks: false,
          skills: false,
        },
      },
      consumers,
    };

    printConfigSummary(config, configPath);
    warnIfOutputIsNotWorkspaceChild(workspaceRoot, config.output.path);
    note("harness.config.json is Structor's project-specific input: project facts, output path, agent clients, consumer repos, and validation commands.");
    const canWriteConfig = existingConfig
      ? await askYesNo(rl, "Replace existing harness.config.json with this config?", false)
      : await askYesNo(rl, "Write harness.config.json?", true);
    if (!canWriteConfig) {
      warn("Stopped before writing config.");
      return;
    }
    await writeConfig(configPath, config);
    success(`Wrote ${configPath}`);

    section("Dry-run preview");
    note("The initializer dry-run renders the plan without writing harness or consumer files.");
    const dryRun = runGenerator(["--config", configPath, "--dry-run"], workspaceRoot);
    printCommandOutput(dryRun);
    if (dryRun.status !== 0) throw new Error("Generator dry-run failed.");

    const apply = options.yes || await askYesNo(rl, "Generate harness now?", false);
    if (!apply) {
      warn("Stopped after dry-run preview.");
      printNextSteps(config);
      return;
    }

    const generateArgs = ["--config", configPath];
    if (options.force) generateArgs.push("--force");
    const installEntrypoints = options.installConsumerEntrypoints || await askYesNo(
      rl,
      "Install consumer entrypoint pointer files? These are thin AGENTS.md/CLAUDE.md files that route agents to the generated Structor repo.",
      true,
    );
    if (installEntrypoints) generateArgs.push("--install-consumer-entrypoints");

    section("Generate");
    const result = runGenerator(generateArgs, workspaceRoot);
    printCommandOutput(result);
    if (result.status !== 0) throw new Error("Generation failed.");
    success("Structor setup complete.");
    printNextSteps(config);
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
  if (command === "doctor") {
    assertNoUnknownCommandFlags(command, options);
    await doctor(options);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
