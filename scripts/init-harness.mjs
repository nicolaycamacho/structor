#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertConfirmedConsumerRepository,
  assertSafeConsumerPath,
  assertSafeOutputRoot,
  exists,
  validateConfigShape,
  workspaceRootForConfig,
} from "./lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const configFileDefault = "harness.config.json";
const configArg = "--config";
const outputArg = "--output";
const dryRunArg = "--dry-run";
const forceArg = "--force";
const installConsumerEntrypointsArg = "--install-consumer-entrypoints";
const allowAbsoluteOutputArg = "--allow-absolute-output";

const consumerPathPrefix = "consumer/";
const anthropicPathPrefix = ".claude/";
const codexHookPathPrefix = ".codex/";
const scriptRulesPath = "scripts/check-claude-compatibility.mjs.tpl";
const scriptCodexPath = "scripts/check-codex-hooks.mjs.tpl";
const scriptHtmlViewsPath = "scripts/generate-html-views.mjs.tpl";
const scriptHooksPath = "scripts/hooks/";

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

function consumerConfig(consumers, workspaceRoot, outputRoot) {
  const generatedWorkspaceRoot = path.dirname(outputRoot);
  const normalizedConsumers = consumers.map((consumer) => {
    const consumerRoot = path.resolve(workspaceRoot, consumer.path);
    return {
      ...consumer,
      workspacePath: path.relative(generatedWorkspaceRoot, consumerRoot).replaceAll(path.sep, "/") || ".",
    };
  });
  return JSON.stringify(normalizedConsumers, null, 2);
}

function booleanLiteral(value) {
  return value ? "true" : "false";
}

function javascriptLiteral(value) {
  return JSON.stringify(value);
}

function clientSupport(config) {
  return {
    codexHooks: config.models.openai && (config.clientSupport?.codex?.hooks ?? true),
    claudeRules: config.models.anthropic && (config.clientSupport?.claude?.rules ?? true),
    claudeHooks: config.models.anthropic && (config.clientSupport?.claude?.hooks ?? false),
    claudeSkills: config.models.anthropic && (config.clientSupport?.claude?.skills ?? false),
  };
}

export function shouldRenderTemplate(sourceRelative, config) {
  const support = clientSupport(config);
  const claudePath = "workspace/.claude/";
  const openaiWorkspacePath = "workspace/AGENTS.md.tpl";
  const claudeWorkspacePath = "workspace/CLAUDE.md.tpl";

  if (sourceRelative.startsWith(consumerPathPrefix)) return false;
  if (!config.models.anthropic && sourceRelative.startsWith(anthropicPathPrefix)) return false;
  if (!support.claudeRules && sourceRelative.startsWith(`${anthropicPathPrefix}rules/`)) return false;
  if (!support.claudeHooks && sourceRelative.startsWith(`${anthropicPathPrefix}hooks/`)) return false;
  if (!support.claudeSkills && sourceRelative.startsWith(`${anthropicPathPrefix}skills/`)) return false;
  if (!support.codexHooks && sourceRelative.startsWith(codexHookPathPrefix)) return false;
  if (!support.codexHooks && sourceRelative.startsWith(scriptHooksPath)) return false;
  if (!support.codexHooks && sourceRelative === scriptCodexPath) return false;
  if (!support.codexHooks && sourceRelative === "ai/contracts/codex-hooks.contract.json.tpl") return false;
  if (!config.models.anthropic && sourceRelative === scriptRulesPath) return false;
  if (!config.models.openai && sourceRelative === openaiWorkspacePath) return false;
  if (!config.models.anthropic && sourceRelative === claudeWorkspacePath) return false;
  if (!config.models.anthropic && sourceRelative.startsWith(claudePath)) return false;
  if (!support.claudeRules && sourceRelative.startsWith(`${claudePath}rules/`)) return false;
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
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content);
  console.log(`${existed ? "wrote" : "created"} ${targetPath}`);
  return { action: existed ? "wrote" : "created", rendered: true, targetPath, targetRelative };
}

async function installConsumerEntrypoints(config, harnessRoot, options) {
  const configDir = path.dirname(path.resolve(options.config));
  const workspaceRoot = options.workspaceRoot ?? workspaceRootForConfig(configDir, repoRoot);

  for (const consumer of config.consumers) {
    const consumerRoot = assertSafeConsumerPath({
      consumerName: consumer.name,
      consumerPath: consumer.path,
      workspaceRoot,
      outputRoot: harnessRoot,
      repoRoot,
    });
    await assertConfirmedConsumerRepository({
      consumerName: consumer.name,
      consumerRoot,
      workspaceRoot,
      outputRoot: harnessRoot,
      repoRoot,
    });

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
  const errors = await validateConfigShape(config, options.config);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const configDir = path.dirname(configPath);
  const outputPath = options.output ?? config.output.path;
  const requestedOutputRoot = path.resolve(configDir, outputPath);
  const workspaceRoot = workspaceRootForConfig(configDir, repoRoot);
  const consumerRepos = config.consumers.map((consumer) =>
    assertSafeConsumerPath({
      consumerName: consumer.name,
      consumerPath: consumer.path,
      workspaceRoot,
      repoRoot,
    }),
  );
  const outputRoot = await assertSafeOutputRoot({
    outputPath,
    outputRoot: requestedOutputRoot,
    repoRoot,
    workspaceRoot,
    consumerRepos,
    allowAbsoluteOutput: options.allowAbsoluteOutput,
  });
  for (const consumer of config.consumers) {
    assertSafeConsumerPath({
      consumerName: consumer.name,
      consumerPath: consumer.path,
      workspaceRoot,
      outputRoot,
      repoRoot,
    });
  }
  const support = clientSupport(config);
  const values = {
    PROJECT_NAME: config.project.name,
    PROJECT_NAME_JSON: javascriptLiteral(config.project.name),
    PROJECT_SLUG: config.project.slug,
    HARNESS_REPO_NAME: config.project.harnessRepoName,
    CONSUMER_REPOS_LIST: consumerList(config.consumers),
    CONSUMER_REPO_NAMES_JSON: consumerNames(config.consumers),
    CONSUMER_CONFIG_JSON: consumerConfig(config.consumers, workspaceRoot, outputRoot),
    PRIMARY_CONSUMER_NAME: config.consumers[0].name,
    MODEL_OPENAI_ENABLED: booleanLiteral(config.models.openai),
    MODEL_ANTHROPIC_ENABLED: booleanLiteral(config.models.anthropic),
    CLIENT_CODEX_HOOKS_ENABLED: booleanLiteral(support.codexHooks),
    CLIENT_CLAUDE_RULES_ENABLED: booleanLiteral(support.claudeRules),
    CLIENT_CLAUDE_HOOKS_ENABLED: booleanLiteral(support.claudeHooks),
    CLIENT_CLAUDE_SKILLS_ENABLED: booleanLiteral(support.claudeSkills),
  };

  let renderedHtmlViewsScript = false;
  for (const sourceRelative of await collectTemplateFiles()) {
    if (!shouldRenderTemplate(sourceRelative, config)) continue;
    const result = await writeRenderedFile(sourceRelative, outputRoot, values, options);
    if (sourceRelative === scriptHtmlViewsPath && result.rendered) {
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
    await installConsumerEntrypoints(config, outputRoot, { ...options, config: configPath, workspaceRoot });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
