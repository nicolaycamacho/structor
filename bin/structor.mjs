#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { access, mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertSafeWriteTarget,
  hasConsumerRepositorySignal,
  resolveHarnessConfig,
  validateConfigShape,
} from "../scripts/lib.mjs";
import { validateHarnessReferences } from "../scripts/harness-routing.mjs";
import { formatTargetProvenance, inspectTargetProvenance } from "../scripts/target-provenance.mjs";
import { markdownCodeSpan, markdownText } from "../scripts/rendered-config.mjs";
import {
  consumerEntrypointsForSettings,
  expandedHarnessProfile,
  requiredHarnessRepoFilesForWorkspaceCheck,
  requiredWorkspaceFilesForWorkspaceCheck,
  workspaceEntrypointsForSettings,
} from "../scripts/generated-harness-contract.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatorPath = path.join(packageRoot, "scripts/init-harness.mjs");
const agentNativePath = path.join(packageRoot, "scripts/agent-native-cli.mjs");
const configFileName = "harness.config.json";
const structorRepoUrlDefault = "https://github.com/nicolaycamacho/structor.git";
const populateSectionStart = "<!-- structor:populate:start -->";
const populateSectionEnd = "<!-- structor:populate:end -->";
const reset = "\x1b[0m";
const styles = {
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

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
    else if (arg === "--force") options.force = true;
    else if (arg === "--dry-run" && (command === "contribute" || command === "populate")) options.dryRun = true;
    else if (arg === "--workspace") options.workspace = rest[++index];
    else if (arg === "--repo-url" && command === "contribute") options.repoUrl = rest[++index];
    else if (arg === "--config") options.config = rest[++index];
    else if (arg === "--target" && command === "doctor") {
      const target = rest[++index];
      if (!target || target.startsWith("--")) throw new Error("--target requires a checkout path.");
      options.target = target;
    }
    else if (arg === "--json" && command === "doctor") options.json = true;
    else if (arg === "--require-git-freshness" && command === "doctor") options.requireGitFreshness = true;
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

function assertKnownOptionKeys(command, options, allowedKeys) {
  const unknownOptions = Object.keys(options)
    .filter((key) => key !== "_" && !allowedKeys.includes(key))
    .map((key) => `--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
  if (unknownOptions.length === 0) return;

  const noun = unknownOptions.length === 1 ? "argument" : "arguments";
  throw new Error(`Unknown ${noun} for structor ${command}: ${unknownOptions.join(", ")}`);
}

function printHelp() {
  console.log(`Structor\n\nUsage:\n  structor agent <plan|hash|apply> [agent-native options]\n  structor generate --config <path> [generator options]\n  structor populate [--workspace <path>] [--config <path>] [--dry-run] [--yes]\n  structor contribute structor [--workspace <path>] [--repo-url <url-or-path>] [--yes] [--dry-run] [--force]\n  structor doctor [--workspace <path>] [--config <path>] [--target <path>] [--json] [--require-git-freshness]\n\nCommands:\n  agent                Produce or apply the immutable Agent-Native Setup contract.\n  generate             Render a generated harness from an existing config.\n  populate             Preview and apply deterministic local starter-guidance updates.\n  contribute structor  Create or refresh a local Structor contributor workspace.\n  doctor               Diagnose local Structor workspace drift without repairing files.\n`);
}

function passthroughGenerate(args) {
  const result = spawnSync(process.execPath, [generatorPath, ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

function passthroughAgentNative(args) {
  const result = spawnSync(process.execPath, [agentNativePath, ...args], {
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

async function consumerPopulateEvidence(consumer) {
  const packageJson = await maybeReadJson(path.join(consumer.root, "package.json"));
  const validation = Object.entries(consumer.config.validation ?? {})
    .filter(([, command]) => typeof command === "string" && command.trim() !== "")
    .map(([name, command]) => `${name}: ${command}`);
  const preservedRoot = path.join(consumer.root, ".structor", "preserved-guidance");
  const preservedGuidance = (await isDirectory(preservedRoot))
    ? (await readdir(preservedRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => `.structor/preserved-guidance/${entry.name}`)
      .sort()
    : [];

  return {
    ...consumer,
    packageName: typeof packageJson?.name === "string" ? packageJson.name : null,
    packageDescription: typeof packageJson?.description === "string" ? packageJson.description : null,
    validation,
    preservedGuidance,
  };
}

export function renderPopulateContextEvidence(consumers) {
  const consumerLines = consumers.flatMap((consumer) => [
    `- ${markdownCodeSpan(consumer.config.name)} at ${markdownCodeSpan(consumer.config.path)}.`,
    ...(consumer.packageName ? [`  - Package: ${markdownCodeSpan(consumer.packageName)}.`] : []),
    ...(consumer.packageDescription ? [`  - Description: ${markdownText(consumer.packageDescription)}.`] : []),
    ...(consumer.validation.length > 0
      ? [`  - Configured validation: ${consumer.validation.map(markdownCodeSpan).join(", ")}.`]
      : ["  - Configured validation: none recorded in the harness config."]),
    ...(consumer.preservedGuidance.length > 0
      ? [`  - Preserved guidance detected: ${consumer.preservedGuidance.map(markdownCodeSpan).join(", ")}.`]
      : []),
  ]);
  return `## Local Consumer Evidence

${consumerLines.join("\n")}

## Review Required

- Confirm product, architecture, contracts, and workflow claims before relying on them.
- Review preserved guidance as source material; do not copy it into canonical policy blindly.
- Keep model overlays and consumer entrypoints thin.
`;
}

export function renderPopulateReposEvidence(consumers) {
  const consumerLines = consumers.flatMap((consumer) => [
    `- ${markdownCodeSpan(consumer.config.name)}: ${markdownText(consumer.config.purpose)}`,
    `  - Path: ${markdownCodeSpan(consumer.config.path)}`,
    ...(consumer.validation.length > 0
      ? [`  - Validation declared in config: ${consumer.validation.map(markdownCodeSpan).join(", ")}`]
      : ["  - Validation declared in config: none"]),
  ]);
  return `## Local Consumer Evidence

${consumerLines.join("\n")}

Review this evidence before relying on it as durable policy.
`;
}

function withPopulateSection(existingContent, evidence) {
  const section = `${populateSectionStart}\n${evidence}${populateSectionEnd}`;
  const startIndex = existingContent.indexOf(populateSectionStart);
  const endIndex = existingContent.indexOf(populateSectionEnd);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return { action: "appended population section", content: `${existingContent.trimEnd()}\n\n${section}\n` };
  }
  return {
    action: "will update existing populated section",
    content: `${existingContent.slice(0, startIndex)}${section}${existingContent.slice(endIndex + populateSectionEnd.length)}`,
  };
}

async function populate(options) {
  const workspaceRoot = path.resolve(options.workspace ?? process.cwd());
  const configPath = await discoverWorkspaceConfigPath(workspaceRoot, options.config);
  if (!(await exists(configPath))) {
    throw new Error(`Structor setup is incomplete: no harness config found at ${configPath}. Complete agent setup using the README prompt or pass --config.`);
  }
  const config = await readJson(configPath);
  const resolvedConfig = await resolveHarnessConfig(config, {
    label: configPath,
    configPath,
    outputPath: config.output.path,
    requireExistingConsumers: true,
  });
  if (!(await isDirectory(resolvedConfig.outputRoot))) {
    throw new Error(`Structor setup is incomplete: generated harness directory is missing at ${resolvedConfig.outputRoot}. Complete agent setup using the README prompt.`);
  }

  const consumers = await Promise.all(resolvedConfig.consumers.map(consumerPopulateEvidence));
  const plannedFiles = [
    { relativePath: "ai/context.md", evidence: renderPopulateContextEvidence(consumers) },
    ...(resolvedConfig.plan.profile === expandedHarnessProfile
      ? [{ relativePath: "ai/workspace/REPOS.md", evidence: renderPopulateReposEvidence(consumers) }]
      : []),
  ];
  for (const file of plannedFiles) {
    file.targetPath = path.join(resolvedConfig.outputRoot, file.relativePath);
    file.previousContent = await readIfExists(file.targetPath);
    if (file.previousContent === null) {
      throw new Error(`Structor setup is incomplete: required canonical file is missing: ${file.targetPath}. Complete agent setup using the README prompt.`);
    }
    const update = withPopulateSection(file.previousContent, file.evidence);
    file.action = update.content === file.previousContent ? "unchanged" : update.action;
    file.content = update.content;
  }

  section("Structor populate preview");
  console.log(`Config: ${configPath}`);
  console.log(`Generated harness: ${resolvedConfig.outputRoot}`);
  for (const file of plannedFiles) console.log(`  - ${file.action} ${file.relativePath}`);
  section("Review required");
  warn("Review required: populated files are personalized starter guidance, not verified project truth.");
  note("No LLMs, APIs, networks, package installs, commits, or external services are used.");
  note("setup_complete remains true; guidance_ready remains false until human review.");
  if (plannedFiles.some((file) => file.action === "will update existing populated section")) {
    warn("Existing populated sections will be replaced; surrounding canonical content is preserved.");
  }
  if (options.dryRun) {
    note("Dry run only. No files were written.");
    return;
  }
  if (!options.yes && !process.stdin.isTTY) {
    throw new Error("Structor populate requires --yes when stdin is not interactive.");
  }
  if (!options.yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      if (!(await askYesNo(rl, "Write these canonical generated-harness updates?", false))) {
        warn("Stopped before writing canonical guidance files.");
        return;
      }
    } finally {
      rl.close();
    }
  }
  for (const file of plannedFiles) {
    if (file.action === "unchanged") continue;
    await assertSafeWriteTarget({
      targetPath: file.targetPath,
      rootPath: resolvedConfig.outputRoot,
      label: `Populate target ${file.relativePath}`,
    });
    await writeFile(file.targetPath, file.content);
    console.log(`wrote ${file.targetPath}`);
  }
  success("Structor populate completed. Review the generated guidance before treating it as ready.");
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
      issues.push(...referenceIssues.map((issue) => issue.message));
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
    issues.push(...referenceIssues.map((issue) => issue.message));
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
  if (options.target) {
    const config = await readJson(configPath);
    const errors = await validateConfigShape(config, configPath);
    if (errors.length > 0) throw new Error(errors.join("\n"));
    const resolved = await resolveHarnessConfig(config, { configPath, label: configPath, outputPath: config.output.path });
    const report = await inspectTargetProvenance({
      targetPath: options.target,
      harnessRoot: resolved.outputRoot,
      harnessRepoName: config.project.harnessRepoName,
      models: config.models,
      entrypoints: consumerEntrypointsForSettings({ profile: config.profile, models: config.models, clientSupport: resolved.support }),
      requireGitFreshness: options.requireGitFreshness,
    });
    console.log(options.json ? JSON.stringify(report, null, 2) : formatTargetProvenance(report));
    process.exitCode = report.valid ? 0 : 1;
    return;
  }
  if (options.json || options.requireGitFreshness) throw new Error("--json and --require-git-freshness require --target <path>.");
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
    const settings = { profile: config.profile, models: config.models, clientSupport: support };
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
      const provenance = await inspectTargetProvenance({
        targetPath: consumerRoot,
        harnessRoot: outputRoot,
        harnessRepoName,
        models: config.models,
        entrypoints: consumerRoutingEntrypoints,
      });
      printDoctorCheck(results, provenance.valid ? "OK" : "FAIL", `source provenance: ${consumer.config.name}`, formatTargetProvenance(provenance));
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
  if (command === "agent") {
    passthroughAgentNative(rawArgs);
    return;
  }
  if (command === "init") {
    throw new Error("structor init has been removed. Use the recommended agent prompt in README.md: https://github.com/nicolaycamacho/structor#install");
  }
  if (command === "generate") {
    passthroughGenerate(rawArgs);
    return;
  }
  if (command === "populate") {
    assertNoUnknownCommandFlags(command, options);
    assertKnownOptionKeys(command, options, ["workspace", "config", "yes", "dryRun"]);
    await populate(options);
    return;
  }
  if (command === "contribute") {
    const [target] = options._;
    if (target !== "structor") {
      throw new Error("Unknown contribute target. Supported target: structor");
    }
    assertKnownOptionKeys(command, options, ["workspace", "repoUrl", "yes", "dryRun", "force"]);
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
