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
const maturityLevels = {{CONTRACT_MATURITY_LEVELS_JSON}};

function reportMaturityShape(maturity, label) {
  if (typeof maturity !== "object" || maturity === null || Array.isArray(maturity)) {
    return [`${label} must be an object with level, scope and limitations.`];
  }
  const findings = [];
  if (!maturityLevels.includes(maturity.level)) {
    findings.push(`${label}.level must be one of: ${maturityLevels.join(", ")}.`);
  }
  if (typeof maturity.scope !== "string" || !maturity.scope.trim()) {
    findings.push(`${label}.scope must be a non-empty string describing the bounded claim.`);
  }
  if (!Array.isArray(maturity.limitations) || maturity.limitations.some((item) => typeof item !== "string" || !item.trim())) {
    findings.push(`${label}.limitations must be an array of non-empty strings (use [] when none are recorded).`);
  }
  for (const key of Object.keys(maturity)) {
    if (!["level", "scope", "limitations"].includes(key)) findings.push(`${label}.${key} is not allowed.`);
  }
  return findings;
}

function absolutePath(relativePath) {
  return path.join(repoRoot, relativePath);
}

async function fileExists(relativePath) {
  try {
    await access(absolutePath(relativePath), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function reportContractShape(manifest, label) {
  const findings = [];
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return [`${label} must be a JSON object.`];
  }

  for (const field of requiredFields) {
    if (!Object.hasOwn(manifest, field)) {
      findings.push(`${label} is missing '${field}'.`);
    }
  }
  if (typeof manifest.version === "string" && !semverPattern.test(manifest.version)) {
    findings.push(`${label}.version must use semver-like x.y.z.`);
  }
  for (const field of ["owners", "affectedRepos", "requiredFiles"]) {
    if (!Array.isArray(manifest[field]) || manifest[field].length === 0) {
      findings.push(`${label}.${field} must be a non-empty array.`);
    }
  }
  if (Object.hasOwn(manifest, "maturity")) {
    findings.push(...reportMaturityShape(manifest.maturity, `${label}.maturity`));
  }

  return findings;
}

const errors = [];
const entries = await readdir(absolutePath(contractsDirectory), { withFileTypes: true });
const readme = await readFile(absolutePath(contractsReadmePath), "utf8");

for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(docFileSuffix) && item.name !== "README.md")) {
  if (!readme.includes(entry.name)) {
    errors.push(`${contractsDirectory}/${entry.name} is not linked from ${contractsReadmePath}.`);
  }
}

for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(contractFileSuffix))) {
  const relativePath = `${contractsDirectory}/${entry.name}`;
  try {
    const manifest = JSON.parse(await readFile(absolutePath(relativePath), "utf8"));
    errors.push(...reportContractShape(manifest, relativePath));
    for (const requiredFile of manifest.requiredFiles ?? []) {
      if (!(await fileExists(requiredFile))) {
        errors.push(`${relativePath} requires missing file ${requiredFile}.`);
      }
    }
  } catch {
    errors.push(`${relativePath} must be valid JSON.`);
  }

  const docPath = `${relativePath.replace(contractFileSuffix, docFileSuffix)}`;
  if (!(await fileExists(docPath))) {
    errors.push(`${relativePath} must have a sibling ${docPath}.`);
  }
}

if (errors.length > 0) {
  console.error("Contract manifest check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Contract manifest check passed (shape and required files only; maturity claims are not verified).");
