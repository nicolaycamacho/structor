#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  artifactTargetPath,
  consumerEntrypointsForSettings,
  enabledGeneratedArtifacts,
  normalizeHarnessSettings,
  workspaceEntrypointsForSettings,
} from "./generated-harness-contract.mjs";
import {
  collectFiles,
  failIfErrors,
  readJson,
  repoRoot,
} from "./lib.mjs";

const artifactPath = "examples/generated-harness-tree.md";
const writeMode = process.argv.includes("--write");
const exampleConfigs = await collectFiles("examples", (relativePath) => relativePath.endsWith("harness.config.json"));
const expectedVariants = new Map([
  ["openai-only", (config) => config.models.openai && !config.models.anthropic],
  ["anthropic-only", (config) => !config.models.openai && config.models.anthropic],
  ["openai-and-anthropic", (config) => config.models.openai && config.models.anthropic],
]);
const genericNamePattern = /^example-(frontend|api|worker|platform)$/;
const errors = [];
const configs = [];

for (const configPath of exampleConfigs) {
  const config = await readJson(configPath);
  configs.push({ configPath, config });
  assertGenericConfig(configPath, config);
}

for (const [variant, predicate] of expectedVariants) {
  if (!configs.some(({ config }) => predicate(config))) {
    errors.push(`examples must include an ${variant} harness.config.json variant.`);
  }
}

const artifact = renderArtifact(configs);
const artifactAbsolutePath = path.join(repoRoot, artifactPath);

if (writeMode) {
  await writeFile(artifactAbsolutePath, artifact);
} else {
  const current = await readFile(artifactAbsolutePath, "utf8").catch(() => "");
  if (current !== artifact) {
    errors.push(`${artifactPath} is stale. Run node scripts/check-examples.mjs --write.`);
  }
}

failIfErrors("Examples check", errors);

function assertGenericConfig(configPath, config) {
  const names = [
    config.project?.slug,
    config.project?.harnessRepoName?.replace(/-structor$/, ""),
    ...(config.consumers ?? []).flatMap((consumer) => [consumer.name, consumer.path?.replace(/^\.\//, "")]),
  ].filter(Boolean);

  for (const name of names) {
    if (!genericNamePattern.test(name)) {
      errors.push(`${configPath}: ${name} must use a generic example-* name.`);
    }
  }
}

function renderArtifact(items) {
  const sections = items
    .slice()
    .sort(compareConfigs)
    .map(({ configPath, config }) => renderSection(configPath, config));

  return [
    "# Generated Harness Tree Artifact",
    "",
    "This checked-in file is a text artifact for public inspection. It is not a generated harness directory, and no generated harness output is committed here.",
    "",
    "The tree below is derived from the checked-in example configs and `scripts/generated-harness-contract.mjs`. `npm run check:ci` verifies that this artifact stays synchronized with the expected generated file, workspace pointer, and consumer pointer surfaces.",
    "",
    ...sections,
    "",
  ].join("\n");
}

function compareConfigs(left, right) {
  return variantRank(left.config) - variantRank(right.config)
    || left.configPath.localeCompare(right.configPath);
}

function variantRank(config) {
  if (config.models.openai && !config.models.anthropic) return 0;
  if (!config.models.openai && config.models.anthropic) return 1;
  return 2;
}

function renderSection(configPath, config) {
  const settings = normalizeHarnessSettings(config);
  const harnessRepoName = config.project.harnessRepoName;
  const generatedFiles = [
    ".structor/manifest.json",
    ...enabledGeneratedArtifacts(settings).map(artifactTargetPath),
  ].sort();
  const workspaceEntrypoints = workspaceEntrypointsForSettings(settings).sort(compareEntrypoints);
  const consumerEntrypoints = consumerEntrypointsForSettings(settings).sort(compareEntrypoints);
  const lines = [
    `## ${variantLabel(config)}`,
    "",
    `Source config: \`${configPath}\``,
    "",
    "```text",
    "workspace/",
    `  ${harnessRepoName}/`,
  ];

  for (const file of generatedFiles) {
    lines.push(`    ${file}`);
  }

  for (const entrypoint of workspaceEntrypoints) {
    lines.push(`  ${entrypoint.path}  # workspace pointer to ${harnessRepoName}/${entrypoint.source}`);
  }

  for (const consumer of config.consumers) {
    lines.push(`  ${consumer.name}/`);
    for (const entrypoint of consumerEntrypoints) {
      lines.push(`    ${entrypoint.path}  # consumer pointer to ${harnessRepoName}/${entrypoint.source}`);
    }
  }

  lines.push("```", "");
  return lines.join("\n");
}

function compareEntrypoints(left, right) {
  return left.path.localeCompare(right.path);
}

function variantLabel(config) {
  if (config.models.openai && !config.models.anthropic) return "OpenAI-only example";
  if (!config.models.openai && config.models.anthropic) return "Anthropic-only example";
  return "OpenAI and Anthropic example";
}
