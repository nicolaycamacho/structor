#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertSafeWriteTarget,
  exists,
  resolveHarnessConfig,
} from "./lib.mjs";
import {
  consumerEntrypointsForSettings,
  freshRenderScriptTemplatesForSettings,
  shouldRenderTemplate as shouldRenderContractTemplate,
  trustedGeneratedScriptTemplatesForSettings,
} from "./generated-harness-contract.mjs";
import {
  consumerEntrypointValues,
  harnessTemplateValues,
  renderedGeneratedScriptHashes,
} from "./rendered-config.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const configFileDefault = "harness.config.json";
const configArg = "--config";
const outputArg = "--output";
const dryRunArg = "--dry-run";
const forceArg = "--force";
const installConsumerEntrypointsArg = "--install-consumer-entrypoints";
const allowAbsoluteOutputArg = "--allow-absolute-output";

export function parseArgs(argv) {
  const options = {
    config: configFileDefault,
    output: null,
    dryRun: false,
    force: false,
    installConsumerEntrypoints: false,
    allowAbsoluteOutput: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === configArg) options.config = argv[++index];
    else if (arg === outputArg) options.output = argv[++index];
    else if (arg === dryRunArg) options.dryRun = true;
    else if (arg === forceArg) options.force = true;
    else if (arg === installConsumerEntrypointsArg) options.installConsumerEntrypoints = true;
    else if (arg === allowAbsoluteOutputArg) options.allowAbsoluteOutput = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

export function render(content, values) {
  return content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    if (!(key in values)) {
      throw new Error(`No value provided for template placeholder {{${key}}}`);
    }
    return values[key];
  });
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export function shouldRenderTemplate(sourceRelative, config) {
  return shouldRenderContractTemplate(sourceRelative, config);
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

async function generatedScriptHashes(templateFiles, config, values) {
  const hashes = {};
  const trustedScriptTemplates = new Set(trustedGeneratedScriptTemplatesForSettings(config));

  for (const sourceRelative of templateFiles) {
    if (!trustedScriptTemplates.has(sourceRelative)) continue;

    const sourcePath = path.join(repoRoot, "template", sourceRelative);
    const targetRelative = sourceRelative.replace(/\.tpl$/, "");
    hashes[targetRelative] = sha256(render(await readFile(sourcePath, "utf8"), values));
  }

  return renderedGeneratedScriptHashes(hashes);
}

export async function writeRenderedFile(sourceRelative, targetRoot, values, options, templateRoot = path.join(repoRoot, "template")) {
  const sourcePath = path.join(templateRoot, sourceRelative);
  const targetRelative = sourceRelative.replace(/\.tpl$/, "");
  const targetPath = path.join(targetRoot, targetRelative);
  const content = render(await readFile(sourcePath, "utf8"), values);

  if (options.dryRun) {
    console.log(`would create ${targetPath}`);
    return { action: "dry-run", rendered: false, targetPath, targetRelative };
  }

  if ((await exists(targetPath)) && !options.force) {
    console.log(`skipped existing ${targetPath}`);
    return { action: "skipped", rendered: false, targetPath, targetRelative };
  }

  const existed = await exists(targetPath);
  await assertSafeWriteTarget({
    targetPath,
    rootPath: targetRoot,
    label: `Generated harness file ${targetRelative}`,
  });
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content);
  console.log(`${existed ? "wrote" : "created"} ${targetPath}`);
  return { action: existed ? "wrote" : "created", rendered: true, targetPath, targetRelative };
}

async function installConsumerEntrypoints(resolvedConfig, options) {
  const { config, outputRoot: harnessRoot, support, consumers } = resolvedConfig;
  const entrypoints = consumerEntrypointsForSettings({
    models: config.models,
    clientSupport: support,
  });

  for (const resolvedConsumer of consumers) {
    const consumer = resolvedConsumer.config;
    const consumerRoot = resolvedConsumer.confirmedRoot ?? resolvedConsumer.root;

    const harnessRelativePath = path.relative(consumerRoot, harnessRoot).replaceAll(path.sep, "/") || ".";
    const values = consumerEntrypointValues(config, consumer, harnessRelativePath);

    for (const entrypoint of entrypoints) {
      const targetRelative = entrypoint.path;
      const sourcePath = path.join(repoRoot, "template", entrypoint.template);
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

      await assertSafeWriteTarget({
        targetPath,
        rootPath: consumerRoot,
        label: `Consumer entrypoint ${targetRelative}`,
      });
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
  const outputPath = options.output ?? config.output.path;
  const resolvedConfig = await resolveHarnessConfig(config, {
    label: options.config,
    configPath,
    outputPath,
    allowAbsoluteOutput: options.allowAbsoluteOutput,
    requireExistingConsumers: options.installConsumerEntrypoints,
  });
  const { outputRoot, support } = resolvedConfig;
  const values = harnessTemplateValues(config, support, resolvedConfig.consumers, outputRoot);
  values.GENERATED_HARNESS_CONTRACT_MODULE = await readFile(
    path.join(repoRoot, "scripts/generated-harness-contract.mjs"),
    "utf8",
  );

  const templateFiles = await collectTemplateFiles();
  values.GENERATED_SCRIPT_HASHES_JSON = await generatedScriptHashes(templateFiles, config, values);
  const freshRenderScriptTemplates = new Set(freshRenderScriptTemplatesForSettings(config));

  let renderedHtmlViewsScript = false;
  for (const sourceRelative of templateFiles) {
    if (!shouldRenderTemplate(sourceRelative, config)) continue;
    const result = await writeRenderedFile(sourceRelative, outputRoot, values, options);
    if (freshRenderScriptTemplates.has(sourceRelative) && result.rendered) {
      renderedHtmlViewsScript = true;
    }
  }

  if (!options.dryRun && renderedHtmlViewsScript) {
    execFileSync(process.execPath, [path.join(outputRoot, "scripts/generate-html-views.mjs")], {
      cwd: outputRoot,
      stdio: "inherit",
    });
  } else if (!options.dryRun) {
    console.log("skipped HTML view generation because scripts/generate-html-views.mjs was not freshly rendered");
  }

  if (options.installConsumerEntrypoints) {
    await installConsumerEntrypoints(resolvedConfig, { ...options, config: configPath });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
