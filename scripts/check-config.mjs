#!/usr/bin/env node

import path from "node:path";
import { readFile } from "node:fs/promises";
import { collectFiles, exists, failIfErrors, readJson, repoRoot, validateConfigShape } from "./lib.mjs";

const errors = [];
const args = process.argv.slice(2);
const configArgIndex = args.indexOf("--config");
const requireExistingConsumers = args.includes("--require-existing-consumers");
const checkingExamples = configArgIndex === -1;
const configFiles = checkingExamples
  ? ["harness.config.example.json", ...(await collectFiles("examples", (file) => file.endsWith("harness.config.json")))]
  : [path.resolve(args[configArgIndex + 1])];

for (const configPath of configFiles) {
  const label = checkingExamples ? configPath : path.relative(process.cwd(), configPath);
  const config = checkingExamples
    ? await readJson(configPath)
    : JSON.parse(await readFile(configPath, "utf8"));
  errors.push(...validateConfigShape(config, label));

  if (checkingExamples && path.isAbsolute(config.output?.path ?? "")) {
    errors.push(`${label}: output.path must be relative for examples.`);
  }

  for (const consumer of config.consumers ?? []) {
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

if (repoRoot.endsWith("ai-engineering-harness-template") === false) {
  errors.push("repository folder should be named ai-engineering-harness-template.");
}

failIfErrors("Config check", errors);
