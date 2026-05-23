#!/usr/bin/env node

import { access, readFile, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractsDirectory = "ai/contracts";
const contractsReadmePath = `${contractsDirectory}/README.md`;
const contractFileSuffix = ".contract.json";
const docFileSuffix = ".md";
const requiredFields = ["id", "name", "version", "owners", "affectedRepos", "requiredFiles"];
const semverPattern = /^\d+\.\d+\.\d+$/;

async function exists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function validateManifest(manifest, label, errors) {
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    errors.push(`${label} must be a JSON object.`);
    return;
  }
  for (const field of requiredFields) {
    if (!Object.hasOwn(manifest, field)) {
      errors.push(`${label} is missing '${field}'.`);
    }
  }
  if (typeof manifest.version === "string" && !semverPattern.test(manifest.version)) {
    errors.push(`${label}.version must use semver-like x.y.z.`);
  }
  for (const field of ["owners", "affectedRepos", "requiredFiles"]) {
    if (!Array.isArray(manifest[field]) || manifest[field].length === 0) {
      errors.push(`${label}.${field} must be a non-empty array.`);
    }
  }
}

const errors = [];
const entries = await readdir(path.join(repoRoot, contractsDirectory), { withFileTypes: true });
const readme = await readFile(path.join(repoRoot, contractsReadmePath), "utf8");

for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(docFileSuffix) && item.name !== "README.md")) {
  if (!readme.includes(entry.name)) {
    errors.push(`${contractsDirectory}/${entry.name} is not linked from ${contractsReadmePath}.`);
  }
}

for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(contractFileSuffix))) {
  const relativePath = `${contractsDirectory}/${entry.name}`;
  try {
    const manifest = JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
    validateManifest(manifest, relativePath, errors);
    for (const requiredFile of manifest.requiredFiles ?? []) {
      if (!(await exists(requiredFile))) {
        errors.push(`${relativePath} requires missing file ${requiredFile}.`);
      }
    }
  } catch {
    errors.push(`${relativePath} must be valid JSON.`);
  }

  const docPath = `${relativePath.replace(contractFileSuffix, docFileSuffix)}`;
  if (!(await exists(docPath))) {
    errors.push(`${relativePath} must have a sibling ${docPath}.`);
  }
}

if (errors.length > 0) {
  console.error("Contract manifest check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Contract manifest check passed.");
