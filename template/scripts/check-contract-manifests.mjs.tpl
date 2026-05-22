#!/usr/bin/env node

import { access, readFile, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFields = ["id", "name", "version", "owners", "affectedRepos", "requiredFiles"];

async function exists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const errors = [];
const entries = await readdir(path.join(repoRoot, "ai/contracts"), { withFileTypes: true });
const readme = await readFile(path.join(repoRoot, "ai/contracts/README.md"), "utf8");

for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(".md") && item.name !== "README.md")) {
  if (!readme.includes(entry.name)) errors.push(`ai/contracts/${entry.name} is not linked from ai/contracts/README.md.`);
}

for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(".contract.json"))) {
  const relativePath = `ai/contracts/${entry.name}`;
  const manifest = JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
  for (const field of requiredFields) {
    if (!(field in manifest)) errors.push(`${relativePath} is missing '${field}'.`);
  }
  for (const requiredFile of manifest.requiredFiles ?? []) {
    if (!(await exists(requiredFile))) errors.push(`${relativePath} requires missing file ${requiredFile}.`);
  }
}

if (errors.length > 0) {
  console.error("Contract manifest check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Contract manifest check passed.");
