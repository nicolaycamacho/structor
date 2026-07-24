#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { failIfErrors, repoRoot } from "./lib.mjs";

const schemasDirectory = "schemas";
const activeSchemas = new Set([
  "approval-receipt.schema.json",
  "contract-manifest.schema.json",
  "execution-result.schema.json",
  "harness-config.schema.json",
  "installation-plan.schema.json",
  "setup-evidence-manifest.schema.json",
]);

const entries = await readdir(path.join(repoRoot, schemasDirectory), { withFileTypes: true });
const errors = [];

for (const entry of entries) {
  if (!entry.isFile() || !entry.name.endsWith(".schema.json")) continue;

  const relativePath = `${schemasDirectory}/${entry.name}`;
  if (!activeSchemas.has(entry.name)) {
    errors.push(`${relativePath} is not an active Structor schema contract.`);
  }

  const content = await readFile(path.join(repoRoot, relativePath), "utf8");
  if (content.includes("example.com")) {
    errors.push(`${relativePath} must not use placeholder example.com identifiers.`);
  }

  try {
    JSON.parse(content);
  } catch {
    errors.push(`${relativePath} must be valid JSON.`);
  }
}

for (const schemaName of activeSchemas) {
  if (!entries.some((entry) => entry.isFile() && entry.name === schemaName)) {
    errors.push(`${schemasDirectory}/${schemaName} is missing.`);
  }
}

failIfErrors("Schema check", errors);
