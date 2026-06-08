#!/usr/bin/env node

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
const preserveExistingGuidanceArg = "--preserve-existing-guidance";
const allowAbsoluteOutputArg = "--allow-absolute-output";
const allowTemplateRepoConsumerArg = "--allow-template-repo-consumer";
const rootGuidanceEntrypoints = new Set(["AGENTS.md", "CLAUDE.md"]);

export function parseArgs(argv) {
  const options = {
    config: configFileDefault,
    output: null,
    dryRun: false,
    force: false,
    installConsumerEntrypoints: false,
    preserveExistingGuidance: false,
    allowAbsoluteOutput: false,
    allowTemplateRepoConsumer: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === configArg) options.config = argv[++index];
    else if (arg === outputArg) options.output = argv[++index];
    else if (arg === dryRunArg) options.dryRun = true;
    else if (arg === forceArg) options.force = true;
    else if (arg === installConsumerEntrypointsArg) options.installConsumerEntrypoints = true;
    else if (arg === preserveExistingGuidanceArg) options.preserveExistingGuidance = true;
    else if (arg === allowAbsoluteOutputArg) options.allowAbsoluteOutput = true;
    else if (arg === allowTemplateRepoConsumerArg) options.allowTemplateRepoConsumer = true;
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

function relativePath(from, to) {
  return path.relative(from, to).replaceAll(path.sep, "/") || ".";
}

export function filesystemTimestamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "").replaceAll(":", "-");
}

function relativeConsumerPath(rootPath, targetPath) {
  return path.relative(rootPath, targetPath).replaceAll(path.sep, "/");
}

function preservedGuidanceDirectory(timestamp) {
  return `.structor/preserved-guidance/${timestamp}`;
}

function guidanceCandidateDirectories(consumerRoot) {
  return [
    path.join(consumerRoot, ".claude"),
    path.join(consumerRoot, ".ai"),
    path.join(consumerRoot, ".cursor"),
    path.join(consumerRoot, ".codex"),
  ];
}

async function collectAdditionalGuidanceCandidates(consumerRoot) {
  const candidates = [];

  async function visit(currentPath, depth = 0) {
    if (depth > 3 || !(await exists(currentPath))) return;
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath, depth + 1);
      } else if (entry.isFile() && /\.(md|mdx|txt)$/i.test(entry.name)) {
        candidates.push(relativeConsumerPath(consumerRoot, absolutePath));
      }
    }
  }

  for (const directory of guidanceCandidateDirectories(consumerRoot)) {
    await visit(directory);
  }
  return candidates.sort();
}

async function writePreservedGuidanceReadme(preserveRoot) {
  await writeFile(path.join(preserveRoot, "README.md"), `# Preserved Guidance

Structor found existing root guidance files before generating Structor root
entrypoints.

These files were preserved as local source material. Structor did not delete,
upload, merge, analyze, or reinterpret them.

Use the generated guidance migration task in the Structor harness to review this
material and migrate still-relevant repo-specific knowledge into canonical
harness docs.

Do not blindly copy this guidance. Verify paths, commands, architecture claims,
and workflow rules against the current consumer repo.
`);
}

async function preserveConsumerRootGuidance({
  consumer,
  consumerRoot,
  conflicts,
  timestamp,
}) {
  const preserveRelative = preservedGuidanceDirectory(timestamp);
  const preserveRoot = path.join(consumerRoot, preserveRelative);
  await assertSafeWriteTarget({
    targetPath: path.join(preserveRoot, "manifest.json"),
    rootPath: consumerRoot,
    label: "Preserved guidance manifest",
  });
  await mkdir(preserveRoot, { recursive: true });

  const preservedFiles = [];
  for (const conflict of conflicts) {
    const preservedPath = path.join(preserveRoot, conflict.path);
    await assertSafeWriteTarget({
      targetPath: preservedPath,
      rootPath: consumerRoot,
      label: `Preserved guidance ${conflict.path}`,
    });
    await copyFile(conflict.targetPath, preservedPath);
    preservedFiles.push({
      source: conflict.path,
      preservedAs: `${preserveRelative}/${conflict.path}`,
    });
    console.log(`preserved existing guidance ${conflict.targetPath} -> ${preservedPath}`);
  }

  await writePreservedGuidanceReadme(preserveRoot);
  const manifest = {
    createdBy: "structor",
    createdAt: new Date().toISOString(),
    reason: "Existing root guidance files were preserved before Structor generated new root entrypoints.",
    consumer: {
      name: consumer.name,
      path: consumer.path,
    },
    preservedFiles,
    additionalGuidanceCandidates: await collectAdditionalGuidanceCandidates(consumerRoot),
    nextStep: "Run the generated guidance migration task in the Structor harness and migrate useful repo-specific knowledge into canonical harness docs.",
  };
  await writeFile(path.join(preserveRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    consumer: consumer.name,
    directory: preserveRelative,
    files: preservedFiles.map((file) => file.preservedAs),
  };
}

async function packageMetadata() {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  return {
    name: packageJson.name,
    version: packageJson.version,
  };
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

async function collectExistingFiles(basePath) {
  const files = new Set();
  if (!(await exists(basePath))) return files;

  async function walk(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        files.add(absolute);
      }
    }
  }

  await walk(basePath);
  return files;
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
    const action = (await exists(targetPath)) ? (options.force ? "overwrite" : "skip existing") : "create";
    console.log(`would ${action} ${targetPath}`);
    return { action: "dry-run", rendered: false, targetPath, targetRelative };
  }

  if ((await exists(targetPath)) && !options.force) {
    const actual = await readFile(targetPath, "utf8");
    if (actual === content) {
      console.log(`verified existing ${targetPath}`);
      return { action: "verified", rendered: true, targetPath, targetRelative };
    }
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

function preservedGuidancePathsFromEntrypoint(content) {
  return [...new Set(content.match(/\.structor\/preserved-guidance\/[0-9T-]+\/?/g) ?? [])]
    .map((entry) => entry.replace(/\/$/, ""));
}

function renderedConsumerEntrypointMatches({
  actual,
  template,
  config,
  consumer,
  harnessRelativePath,
  preservedGuidancePaths = [],
}) {
  const candidatePaths = [null, ...preservedGuidancePaths];
  return candidatePaths.some((preservedGuidancePath) => {
    const values = consumerEntrypointValues(config, consumer, harnessRelativePath, {
      preservedGuidancePath,
    });
    return actual === render(template, values);
  });
}

function rootGuidanceConflictError(conflicts) {
  return new Error(
    `Existing root guidance files require preservation consent before Structor can replace them:\n${conflicts.map((item) => `- ${item.targetPath}`).join("\n")}\nRe-run interactively and choose preservation, or pass --preserve-existing-guidance with explicit intent.`,
  );
}

export async function collectConsumerRootGuidanceConflicts(resolvedConfig, options = {}) {
  const { config, outputRoot: harnessRoot, support, consumers } = resolvedConfig;
  const entrypoints = consumerEntrypointsForSettings({
    models: config.models,
    clientSupport: support,
  }).filter((entrypoint) => rootGuidanceEntrypoints.has(entrypoint.path));
  const conflicts = [];

  for (const resolvedConsumer of consumers) {
    const consumer = resolvedConsumer.config;
    const consumerRoot = resolvedConsumer.confirmedRoot ?? resolvedConsumer.root;
    const harnessRelativePath = path.relative(consumerRoot, harnessRoot).replaceAll(path.sep, "/") || ".";
    const configuredPreservedPath = options.preservedGuidanceByConsumer?.[consumer.name]?.directory;

    for (const entrypoint of entrypoints) {
      const targetPath = path.join(consumerRoot, entrypoint.path);
      if (!(await exists(targetPath))) continue;

      const sourcePath = path.join(repoRoot, "template", entrypoint.template);
      const [actual, template] = await Promise.all([
        readFile(targetPath, "utf8"),
        readFile(sourcePath, "utf8"),
      ]);
      const preservedGuidancePaths = [
        ...preservedGuidancePathsFromEntrypoint(actual),
        ...(configuredPreservedPath ? [configuredPreservedPath] : []),
      ];
      if (!renderedConsumerEntrypointMatches({
        actual,
        template,
        config,
        consumer,
        harnessRelativePath,
        preservedGuidancePaths,
      })) {
        conflicts.push({
          consumer: consumer.name,
          consumerPath: consumer.path,
          consumerRoot,
          path: entrypoint.path,
          targetPath,
        });
      }
    }
  }

  return conflicts;
}

export async function installConsumerEntrypoints(resolvedConfig, options) {
  const { config, outputRoot: harnessRoot, support, consumers } = resolvedConfig;
  const entrypoints = consumerEntrypointsForSettings({
    models: config.models,
    clientSupport: support,
  });
  const records = [];

  for (const resolvedConsumer of consumers) {
    const consumer = resolvedConsumer.config;
    const consumerRoot = resolvedConsumer.confirmedRoot ?? resolvedConsumer.root;
    const preservedGuidance = options.preservedGuidanceByConsumer?.[consumer.name] ?? null;
    const harnessRelativePath = path.relative(consumerRoot, harnessRoot).replaceAll(path.sep, "/") || ".";
    const values = consumerEntrypointValues(config, consumer, harnessRelativePath, {
      preservedGuidancePath: preservedGuidance?.directory,
    });
    const rootConflicts = [];

    for (const entrypoint of entrypoints.filter((item) => rootGuidanceEntrypoints.has(item.path))) {
      const targetPath = path.join(consumerRoot, entrypoint.path);
      if (!(await exists(targetPath))) continue;
      const sourcePath = path.join(repoRoot, "template", entrypoint.template);
      const [actual, template] = await Promise.all([
        readFile(targetPath, "utf8"),
        readFile(sourcePath, "utf8"),
      ]);
      const preservedGuidancePaths = [
        ...preservedGuidancePathsFromEntrypoint(actual),
        ...(preservedGuidance?.directory ? [preservedGuidance.directory] : []),
      ];
      if (!renderedConsumerEntrypointMatches({
        actual,
        template,
        config,
        consumer,
        harnessRelativePath,
        preservedGuidancePaths,
      })) {
        rootConflicts.push({ path: entrypoint.path, targetPath });
      }
    }

    let preservedRecord = preservedGuidance;
    if (rootConflicts.length > 0) {
      if (options.allowRootGuidanceOverwrite) {
        // Contributor setup refreshes known Structor self-harness pointers and
        // keeps the historical --force boundary instead of preserved-guidance.
      } else if (options.dryRun) {
        for (const conflict of rootConflicts) {
          console.log(`would preserve existing guidance ${conflict.targetPath}`);
        }
      } else if (options.preserveExistingGuidance) {
        for (const conflict of rootConflicts) {
          await assertSafeWriteTarget({
            targetPath: conflict.targetPath,
            rootPath: consumerRoot,
            label: `Consumer entrypoint ${conflict.path}`,
          });
        }
        preservedRecord = await preserveConsumerRootGuidance({
          consumer,
          consumerRoot,
          conflicts: rootConflicts,
          timestamp: options.preservationTimestamp ?? filesystemTimestamp(),
        });
        values.PRESERVED_GUIDANCE_SECTION = consumerEntrypointValues(config, consumer, harnessRelativePath, {
          preservedGuidancePath: preservedRecord.directory,
        }).PRESERVED_GUIDANCE_SECTION;
      } else {
        throw rootGuidanceConflictError(rootConflicts);
      }
    }

    for (const entrypoint of entrypoints) {
      const targetRelative = entrypoint.path;
      const sourcePath = path.join(repoRoot, "template", entrypoint.template);
      const targetPath = path.join(consumerRoot, targetRelative);
      const content = render(await readFile(sourcePath, "utf8"), values);
      const record = {
        consumer: consumer.name,
        consumerPath: consumer.path,
        path: targetRelative,
        rendered: false,
      };

      if (options.dryRun) {
        const action = (await exists(targetPath)) ? (options.force ? "overwrite" : "skip existing") : "create";
        console.log(`would ${action} consumer entrypoint ${targetPath}`);
        records.push({ ...record, action: "dry-run" });
        continue;
      }
      if (await exists(targetPath)) {
        const actual = await readFile(targetPath, "utf8");
        if (actual === content) {
          console.log(`verified existing consumer entrypoint ${targetPath}`);
          records.push({ ...record, action: "verified", rendered: true });
          continue;
        }
      }
      if (
        (await exists(targetPath)) &&
        !options.force &&
        (!rootGuidanceEntrypoints.has(targetRelative) || !options.preserveExistingGuidance)
      ) {
        console.log(`skipped existing consumer entrypoint ${targetPath}`);
        records.push({ ...record, action: "skipped" });
        continue;
      }

      await assertSafeWriteTarget({
        targetPath,
        rootPath: consumerRoot,
        label: `Consumer entrypoint ${targetRelative}`,
      });
      await mkdir(path.dirname(targetPath), { recursive: true });
      const existed = await exists(targetPath);
      const previousContent = existed ? await readFile(targetPath, "utf8") : null;
      await writeFile(targetPath, content);
      console.log(`wrote consumer entrypoint ${targetPath}`);
      records.push({
        ...record,
        action: existed ? "wrote" : "created",
        rendered: true,
        targetPath,
        previousContent,
        preservedGuidanceDirectory: preservedRecord?.directory ?? null,
      });
    }
  }

  return records;
}

async function writeGenerationManifest({
  config,
  configContent,
  configPath,
  consumerEntrypoints,
  generatedFiles,
  outputRoot,
  resolvedConfig,
  support,
}) {
  const manifestPath = path.join(outputRoot, ".structor", "manifest.json");
  const metadata = await packageMetadata();
  const manifest = {
    generatorName: metadata.name,
    generatorVersion: metadata.version,
    generatedAt: new Date().toISOString(),
    config: {
      path: relativePath(resolvedConfig.workspaceRoot, configPath),
      sha256: sha256(configContent),
      project: {
        name: config.project.name,
        slug: config.project.slug,
        harnessRepoName: config.project.harnessRepoName,
      },
      models: {
        openai: Boolean(config.models.openai),
        anthropic: Boolean(config.models.anthropic),
      },
      clientSupport: support,
      consumers: config.consumers.map((consumer) => ({
        name: consumer.name,
        path: consumer.path,
        purpose: consumer.purpose,
      })),
    },
    files: generatedFiles.map((file) => ({
      path: file.targetRelative,
      action: file.action,
      rendered: file.rendered,
    })),
    consumerEntrypoints,
  };

  await assertSafeWriteTarget({
    targetPath: manifestPath,
    rootPath: outputRoot,
    label: "Generation manifest .structor/manifest.json",
  });
  const existed = await exists(manifestPath);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${manifestPath}`);
  return {
    action: existed ? "wrote" : "created",
    rendered: true,
    targetPath: manifestPath,
    targetRelative: path.relative(outputRoot, manifestPath).replaceAll(path.sep, "/"),
  };
}

export async function generateHarness(config, {
  configPath = null,
  configContent = null,
  configDir = configPath ? path.dirname(path.resolve(configPath)) : process.cwd(),
  outputPath = config.output.path,
  dryRun = false,
  force = false,
  installConsumerEntrypoints: shouldInstallConsumerEntrypoints = false,
  requireExistingConsumers = false,
  allowAbsoluteOutput = false,
  allowTemplateRepoConsumer = false,
  preserveExistingGuidance = false,
  preservationTimestamp = null,
  preservedGuidanceByConsumer = {},
} = {}) {
  const manifestConfigContent = configContent
    ?? (configPath ? await readFile(path.resolve(configPath), "utf8") : `${JSON.stringify(config, null, 2)}\n`);
  const resolvedConfig = await resolveHarnessConfig(config, {
    label: configPath ?? "harness config",
    configPath,
    configDir,
    outputPath,
    allowAbsoluteOutput,
    requireExistingConsumers: requireExistingConsumers || shouldInstallConsumerEntrypoints,
    allowTemplateRepoConsumer,
  });
  const { outputRoot, support } = resolvedConfig;
  const resolvedPreservationTimestamp = preservationTimestamp ?? filesystemTimestamp();
  let resolvedPreservedGuidanceByConsumer = preservedGuidanceByConsumer;
  if (shouldInstallConsumerEntrypoints && !preserveExistingGuidance) {
    const conflicts = await collectConsumerRootGuidanceConflicts(resolvedConfig);
    if (conflicts.length > 0) {
      throw rootGuidanceConflictError(conflicts);
    }
  }
  if (
    preserveExistingGuidance &&
    shouldInstallConsumerEntrypoints &&
    Object.keys(resolvedPreservedGuidanceByConsumer).length === 0
  ) {
    const conflicts = await collectConsumerRootGuidanceConflicts(resolvedConfig);
    resolvedPreservedGuidanceByConsumer = Object.fromEntries(
      [...new Set(conflicts.map((conflict) => conflict.consumer))].map((consumerName) => [
        consumerName,
        { directory: preservedGuidanceDirectory(resolvedPreservationTimestamp) },
      ]),
    );
  }
  const templateWorkspaceRoot = config.workspace?.root
    ? path.resolve(configDir, config.workspace.root)
    : path.resolve(configDir);
  const templateOutputRoot = path.resolve(templateWorkspaceRoot, outputPath);
  const values = harnessTemplateValues(config, support, resolvedConfig.consumers, templateOutputRoot, templateWorkspaceRoot, {
    preservedGuidanceByConsumer: resolvedPreservedGuidanceByConsumer,
  });
  values.GENERATED_HARNESS_CONTRACT_MODULE = await readFile(
    path.join(repoRoot, "scripts/generated-harness-contract.mjs"),
    "utf8",
  );

  const templateFiles = await collectTemplateFiles();
  values.GENERATED_SCRIPT_HASHES_JSON = await generatedScriptHashes(templateFiles, config, values);
  const freshRenderScriptTemplates = new Set(freshRenderScriptTemplatesForSettings(config));

  let renderedHtmlViewsScript = false;
  const generatedFiles = [];
  for (const sourceRelative of templateFiles) {
    if (!shouldRenderTemplate(sourceRelative, config)) continue;
    const result = await writeRenderedFile(sourceRelative, outputRoot, values, { dryRun, force });
    generatedFiles.push(result);
    if (freshRenderScriptTemplates.has(sourceRelative) && result.rendered) {
      renderedHtmlViewsScript = true;
    }
  }

  const htmlViewsRoot = path.join(outputRoot, "ai", "views");
  const htmlViewFilesBefore = renderedHtmlViewsScript
    ? await collectExistingFiles(htmlViewsRoot)
    : new Set();
  if (!dryRun && renderedHtmlViewsScript) {
    let htmlViewFilesAfter;
    try {
      execFileSync(process.execPath, [path.join(outputRoot, "scripts/generate-html-views.mjs")], {
        cwd: outputRoot,
        stdio: "inherit",
      });
      htmlViewFilesAfter = await collectExistingFiles(htmlViewsRoot);
    } catch (error) {
      htmlViewFilesAfter = await collectExistingFiles(htmlViewsRoot);
      for (const targetPath of htmlViewFilesAfter) {
        if (!htmlViewFilesBefore.has(targetPath)) {
          await rm(targetPath, { force: true });
        }
      }
      throw error;
    }
    for (const targetPath of htmlViewFilesAfter) {
      if (htmlViewFilesBefore.has(targetPath)) continue;
      generatedFiles.push({
        action: "created",
        rendered: true,
        targetPath,
        targetRelative: path.relative(outputRoot, targetPath).replaceAll(path.sep, "/"),
      });
    }
  } else if (!dryRun) {
    console.log("skipped HTML view generation because scripts/generate-html-views.mjs was not freshly rendered");
  }

  const consumerEntrypoints = shouldInstallConsumerEntrypoints
    ? await installConsumerEntrypoints(resolvedConfig, {
      dryRun,
      force,
      config: configPath,
      preserveExistingGuidance,
      preservationTimestamp: resolvedPreservationTimestamp,
      preservedGuidanceByConsumer: resolvedPreservedGuidanceByConsumer,
    })
    : [];

  const manifestFile = !dryRun
    ? await writeGenerationManifest({
      config,
      configContent: manifestConfigContent,
      configPath,
      consumerEntrypoints,
      generatedFiles,
      outputRoot,
      resolvedConfig,
      support,
    })
    : null;

  return {
    resolvedConfig,
    generatedFiles,
    consumerEntrypoints,
    manifestFile,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const configPath = path.resolve(options.config);
  const configContent = await readFile(configPath, "utf8");
  const config = JSON.parse(configContent);
  await generateHarness(config, {
    configPath,
    configContent,
    outputPath: options.output ?? config.output.path,
    dryRun: options.dryRun,
    force: options.force,
    installConsumerEntrypoints: options.installConsumerEntrypoints,
    preserveExistingGuidance: options.preserveExistingGuidance,
    allowAbsoluteOutput: options.allowAbsoluteOutput,
    allowTemplateRepoConsumer: options.allowTemplateRepoConsumer,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
