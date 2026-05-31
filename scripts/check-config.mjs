#!/usr/bin/env node

import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  collectFiles,
  ConfigResolutionError,
  failIfErrors,
  readJson,
  repoRoot,
  resolveHarnessConfig,
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

function resolutionErrors(error) {
  if (error instanceof ConfigResolutionError) return error.errors;
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").filter(Boolean);
}

for (const configPath of configFiles) {
  const label = checkingExamples ? configPath : path.relative(process.cwd(), configPath);
  const config = checkingExamples
    ? await readJson(configPath)
    : JSON.parse(await readFile(configPath, "utf8"));

  if (checkingExamples && path.isAbsolute(config.output?.path ?? "")) {
    errors.push(`${label}: output.path must be relative for examples.`);
  }

  try {
    await resolveHarnessConfig(config, {
      label,
      configPath: checkingExamples ? path.join(repoRoot, configPath) : configPath,
      allowAbsoluteOutput,
      requireExistingConsumers,
    });
  } catch (error) {
    errors.push(...resolutionErrors(error));
  }

  if (checkingExamples && Array.isArray(config.consumers)) {
    for (const consumer of config.consumers) {
      if (typeof consumer?.path !== "string") continue;
      if (checkingExamples && path.isAbsolute(consumer.path)) {
        errors.push(`${label}: consumer path for ${consumer.name} must be relative in checked-in examples.`);
      }
    }
  }
}

if (repoRoot.endsWith("structor") === false) {
  errors.push("repository folder should be named structor.");
}

failIfErrors("Config check", errors);
