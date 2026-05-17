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

async function collectTemplateFiles() {
  const basePath = path.join(repoRoot, "template");
  const files = [];

  async function walk(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentPath, entry.name);
      const relative = path.relative(basePath, absolute).replaceAll(path.sep, "/");
      if (entry.isDirectory()) {
        if (relative === "consumer") continue;
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

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content);
  console.log(`${(await exists(targetPath)) ? "wrote" : "created"} ${targetPath}`);
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

    for (const fileName of ["AGENTS.md", "CLAUDE.md"]) {
      const sourcePath = path.join(repoRoot, "template", "consumer", `${fileName}.tpl`);
      const targetPath = path.join(consumerRoot, fileName);
      const content = render(await readFile(sourcePath, "utf8"), values);

      if (options.dryRun) {
        console.log(`would create consumer entrypoint ${targetPath}`);
        continue;
      }
      if ((await exists(targetPath)) && !options.force) {
        console.log(`skipped existing consumer entrypoint ${targetPath}`);
        continue;
      }

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

  const outputRoot = path.resolve(path.dirname(configPath), options.output ?? config.output.path);
  const values = {
    PROJECT_NAME: config.project.name,
    PROJECT_SLUG: config.project.slug,
    HARNESS_REPO_NAME: config.project.harnessRepoName,
    CONSUMER_REPOS_LIST: consumerList(config.consumers),
    PRIMARY_CONSUMER_NAME: config.consumers[0].name,
  };

  for (const sourceRelative of await collectTemplateFiles()) {
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
