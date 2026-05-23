#!/usr/bin/env node

import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  assertSafeOutputRoot,
  collectFiles,
  exists,
  failIfErrors,
  readJson,
  repoRoot,
  validateConfigShape,
} from "./lib.mjs";

const errors = [];
const args = process.argv.slice(2);
const configArgIndex = args.indexOf("--config");
const requireExistingConsumers = args.includes("--require-existing-consumers");
const allowAbsoluteOutput = args.includes("--allow-absolute-output");
const checkingExamples = configArgIndex === -1;
const configFiles = checkingExamples
  ? ["harness.config.example.json", ...(await collectFiles("examples", (file) => file.endsWith("harness.config.json")))]
  : [path.resolve(args[configArgIndex + 1])];

for (const configPath of configFiles) {
  const label = checkingExamples ? configPath : path.relative(process.cwd(), configPath);
  const config = checkingExamples
    ? await readJson(configPath)
    : JSON.parse(await readFile(configPath, "utf8"));
  errors.push(...(await validateConfigShape(config, label)));

  if (checkingExamples && path.isAbsolute(config.output?.path ?? "")) {
    errors.push(`${label}: output.path must be relative for examples.`);
  }
  if (!checkingExamples) {
    const configDir = path.dirname(configPath);
    const outputPath = config.output.path;
    const outputRoot = path.resolve(configDir, outputPath);
    const consumerRepos = Array.isArray(config.consumers)
      ? config.consumers.map((consumer) => path.resolve(configDir, consumer.path))
      : [];
    try {
      assertSafeOutputRoot({
        outputPath,
        outputRoot,
        repoRoot,
        workspaceRoot: configDir,
        consumerRepos,
        allowAbsoluteOutput,
      });
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (Array.isArray(config.consumers)) {
    for (const consumer of config.consumers) {
      if (checkingExamples && path.isAbsolute(consumer.path)) {
        errors.push(`${label}: consumer path for ${consumer.name} must be relative in checked-in examples.`);
      }
      if (requireExistingConsumers) {
        const configDir = checkingExamples ? path.dirname(path.join(repoRoot, configPath)) : path.dirname(configPath);
        const consumerPath = path.resolve(configDir, consumer.path);
        if (!(await exists(consumerPath))) {
          errors.push(`${label}: consumer path for ${consumer.name} does not exist: ${consumerPath}`);
        }
      }
    }
  }
}

if (repoRoot.endsWith("ai-engineering-harness-template") === false) {
  errors.push("repository folder should be named ai-engineering-harness-template.");
}

failIfErrors("Config check", errors);
