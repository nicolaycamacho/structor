#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(repoRoot, "..");
const sourceRoot = path.join(workspaceRoot, "structor");
const workspaceAgentPath = path.join(workspaceRoot, "AGENTS.md");
const requiredHarnessFiles = [
  "AGENTS.md",
  "ai/AGENTS.md",
  "ai/HUB.md",
  "ai/context.md",
  "scripts/validate-governance.mjs",
];

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readIfExists(filePath) {
  if (!(await exists(filePath))) return null;
  return readFile(filePath, "utf8");
}

const errors = [];
if (path.basename(repoRoot) !== "structor-self") {
  errors.push(`repo folder name: expected structor-self, found ${path.basename(repoRoot)}`);
}

for (const relativePath of requiredHarnessFiles) {
  if (!(await exists(path.join(repoRoot, relativePath)))) {
    errors.push(`missing self-harness file ${relativePath}`);
  }
}

if (!(await exists(sourceRoot))) {
  errors.push(`missing Structor source repo at ${sourceRoot}`);
}

const workspaceAgent = await readIfExists(workspaceAgentPath);
if (workspaceAgent === null) {
  errors.push(`missing workspace entrypoint ${workspaceAgentPath}`);
} else if (!workspaceAgent.includes("structor-self")) {
  errors.push(`workspace entrypoint ${workspaceAgentPath} must route to structor-self`);
}

const sourceAgentPath = path.join(sourceRoot, "AGENTS.md");
const sourceAgent = await readIfExists(sourceAgentPath);
if (sourceAgent === null) {
  errors.push(`missing source entrypoint ${sourceAgentPath}`);
} else if (sourceAgent.includes("structor-self")) {
  console.log("Source AGENTS.md routes to structor-self.");
} else {
  console.log("Source AGENTS.md exists and was preserved; run setup with --force after review to replace it.");
}

if (errors.length > 0) {
  console.error("Structor self-harness workspace check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Structor self-harness workspace check passed.");
