#!/usr/bin/env node

import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  assertConfirmedConsumerRepository,
  assertSafeConsumerPath,
  assertSafeOutputRoot,
  collectFiles,
  failIfErrors,
  readJson,
  repoRoot,
  validateConfigShape,
  workspaceRootForConfig,
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
    const workspaceRoot = workspaceRootForConfig(configDir, repoRoot);
    const consumerRepos = [];
    if (Array.isArray(config.consumers)) {
      for (const consumer of config.consumers) {
        if (typeof consumer?.path !== "string") continue;
        try {
          consumerRepos.push(assertSafeConsumerPath({
            consumerName: consumer.name,
            consumerPath: consumer.path,
            workspaceRoot,
            repoRoot,
          }));
        } catch (error) {
          errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    try {
      const safeOutputRoot = await assertSafeOutputRoot({
        outputPath,
        outputRoot,
        repoRoot,
        workspaceRoot,
        consumerRepos,
        allowAbsoluteOutput,
      });
      if (Array.isArray(config.consumers)) {
        for (const consumer of config.consumers) {
          if (typeof consumer?.path !== "string") continue;
          assertSafeConsumerPath({
            consumerName: consumer.name,
            consumerPath: consumer.path,
            workspaceRoot,
            outputRoot: safeOutputRoot,
            repoRoot,
          });
        }
      }
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (Array.isArray(config.consumers)) {
    for (const consumer of config.consumers) {
      if (typeof consumer?.path !== "string") continue;
      if (checkingExamples && path.isAbsolute(consumer.path)) {
        errors.push(`${label}: consumer path for ${consumer.name} must be relative in checked-in examples.`);
      }
      if (requireExistingConsumers) {
        const configDir = checkingExamples ? path.dirname(path.join(repoRoot, configPath)) : path.dirname(configPath);
        const workspaceRoot = checkingExamples ? configDir : workspaceRootForConfig(configDir, repoRoot);
        const outputRoot = checkingExamples || !config.output?.path ? null : path.resolve(configDir, config.output.path);
        let consumerRoot;
        try {
          consumerRoot = assertSafeConsumerPath({
            consumerName: consumer.name,
            consumerPath: consumer.path,
            workspaceRoot,
            outputRoot,
            repoRoot,
          });
          await assertConfirmedConsumerRepository({
            consumerName: consumer.name,
            consumerRoot,
            workspaceRoot,
            outputRoot,
            repoRoot,
          });
        } catch (error) {
          errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }
}

if (repoRoot.endsWith("structor") === false) {
  errors.push("repository folder should be named structor.");
}

failIfErrors("Config check", errors);
