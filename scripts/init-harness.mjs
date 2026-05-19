#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exists, validateConfigShape } from "./lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = {
    config: "harness.config.json",
    output: null,
    dryRun: false,
    force: false,
    installConsumerEntrypoints: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--config") options.config = argv[++index];
    else if (arg === "--output") options.output = argv[++index];
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--install-consumer-entrypoints") options.installConsumerEntrypoints = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function render(content, values) {
  return content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    if (!(key in values)) {
      throw new Error(`No value provided for template placeholder {{${key}}}`);
    }
    return values[key];
  });
}

function consumerList(consumers) {
  return consumers.map((consumer) => `- ${consumer.name}: ${consumer.purpose}`).join("\n");
}

function validationList(validation) {
  const entries = Object.entries(validation ?? {});
  if (entries.length === 0) return "- No local validation commands documented yet.";
  return entries.map(([name, command]) => `- ${name}: \`${command}\``).join("\n");
}

function consumerNames(consumers) {
  return JSON.stringify(consumers.map((consumer) => consumer.name));
}

function consumerConfig(consumers, configDir, outputRoot) {
  const workspaceRoot = path.dirname(outputRoot);
  const normalizedConsumers = consumers.map((consumer) => {
    const consumerRoot = path.resolve(configDir, consumer.path);
    return {
      ...consumer,
      workspacePath: path.relative(workspaceRoot, consumerRoot).replaceAll(path.sep, "/") || ".",
    };
  });
  return JSON.stringify(normalizedConsumers, null, 2);
}

function booleanLiteral(value) {
  return value ? "true" : "false";
}

function shouldRenderTemplate(sourceRelative, config) {
  if (sourceRelative.startsWith("consumer/")) return false;
  if (!config.models.anthropic && sourceRelative.startsWith(".claude/")) return false;
  if (!config.models.openai && sourceRelative === "workspace/AGENTS.md.tpl") return false;
  if (!config.models.anthropic && sourceRelative.startsWith("workspace/CLAUDE.md")) return false;
  if (!config.models.anthropic && sourceRelative.startsWith("workspace/.claude/")) return false;
  if (!config.models.openai && sourceRelative === "AGENTS.md.tpl") return false;
  if (!config.models.anthropic && sourceRelative === "CLAUDE.md.tpl") return false;
  if (!config.models.openai && sourceRelative.startsWith("ai/model-overlays/openai/")) return false;
  if (!config.models.anthropic && sourceRelative.startsWith("ai/model-overlays/anthropic/")) return false;
  return true;
}

async function collectTemplateFiles() {
  const basePath = path.join(repoRoot, "template");
  const files = [];

  async function walk(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentPath, entry.name);
      const relative = path.relative(basePath, absolute).replaceAll(path.sep, "/");
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile() && entry.name.endsWith(".tpl")) {
        files.push(relative);
      }
    }
  }

  await walk(basePath);
  return files.sort();
}

async function writeRenderedFile(sourceRelative, targetRoot, values, options) {
  const sourcePath = path.join(repoRoot, "template", sourceRelative);
  const targetRelative = sourceRelative.replace(/\.tpl$/, "");
  const targetPath = path.join(targetRoot, targetRelative);
  const content = render(await readFile(sourcePath, "utf8"), values);

  if (options.dryRun) {
    console.log(`would create ${targetPath}`);
    return;
  }

  if ((await exists(targetPath)) && !options.force) {
    console.log(`skipped existing ${targetPath}`);
    return;
  }

  const existed = await exists(targetPath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content);
  console.log(`${existed ? "wrote" : "created"} ${targetPath}`);
}

async function installConsumerEntrypoints(config, harnessRoot, options) {
  for (const consumer of config.consumers) {
    const consumerRoot = path.resolve(path.dirname(path.resolve(options.config)), consumer.path);
    if (!(await exists(consumerRoot))) {
      throw new Error(`Consumer repo path does not exist: ${consumerRoot}`);
    }

    const harnessRelativePath = path.relative(consumerRoot, harnessRoot).replaceAll(path.sep, "/") || ".";
    const values = {
      PROJECT_NAME: config.project.name,
      CONSUMER_NAME: consumer.name,
      CONSUMER_PURPOSE: consumer.purpose,
      CONSUMER_VALIDATION_LIST: validationList(consumer.validation),
      HARNESS_RELATIVE_PATH: harnessRelativePath,
    };

    const entrypoints = [];
    if (config.models.openai) entrypoints.push(["AGENTS.md", "AGENTS.md.tpl"]);
    if (config.models.anthropic) {
      entrypoints.push(["CLAUDE.md", "CLAUDE.md.tpl"]);
      entrypoints.push([path.join(".claude", "CLAUDE.md"), path.join(".claude", "CLAUDE.md.tpl")]);
    }

    for (const [targetRelative, sourceRelative] of entrypoints) {
      const sourcePath = path.join(repoRoot, "template", "consumer", sourceRelative);
      const targetPath = path.join(consumerRoot, targetRelative);
      const content = render(await readFile(sourcePath, "utf8"), values);

      if (options.dryRun) {
        console.log(`would create consumer entrypoint ${targetPath}`);
        continue;
      }
      if ((await exists(targetPath)) && !options.force) {
        console.log(`skipped existing consumer entrypoint ${targetPath}`);
        continue;
      }

      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, content);
      console.log(`wrote consumer entrypoint ${targetPath}`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const configPath = path.resolve(options.config);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const errors = validateConfigShape(config, options.config);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const configDir = path.dirname(configPath);
  const outputRoot = path.resolve(configDir, options.output ?? config.output.path);
  const values = {
    PROJECT_NAME: config.project.name,
    PROJECT_SLUG: config.project.slug,
    HARNESS_REPO_NAME: config.project.harnessRepoName,
    CONSUMER_REPOS_LIST: consumerList(config.consumers),
    CONSUMER_REPO_NAMES_JSON: consumerNames(config.consumers),
    CONSUMER_CONFIG_JSON: consumerConfig(config.consumers, configDir, outputRoot),
    PRIMARY_CONSUMER_NAME: config.consumers[0].name,
    MODEL_OPENAI_ENABLED: booleanLiteral(config.models.openai),
    MODEL_ANTHROPIC_ENABLED: booleanLiteral(config.models.anthropic),
  };

  for (const sourceRelative of await collectTemplateFiles()) {
    if (!shouldRenderTemplate(sourceRelative, config)) continue;
    await writeRenderedFile(sourceRelative, outputRoot, values, options);
  }

  if (options.installConsumerEntrypoints) {
    await installConsumerEntrypoints(config, outputRoot, { ...options, config: configPath });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
