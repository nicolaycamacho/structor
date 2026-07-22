#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { exists, failIfErrors, repoRoot } from "./lib.mjs";

const errors = [];
const mapRelativePath = "REPO_MAP.md";
const manifestRelativePath = ".structor/manifest/repo-map.json";
const requiredMapSections = [
  "## Purpose",
  "## How To Use This Map",
  "## Package Identity",
  "## Repository Topology",
  "## CLI Entrypoints",
  "## Init And Wizard Flow",
  "## Generation Flow",
  "## Template And Generated Harness Contract",
  "## Validation Model",
  "## npm Package Surface",
  "## Contributor And Self-Harness Flow",
  "## Agent Routing Guide",
  "## Synchronization Groups",
  "## Drift Risks",
];

const packageJson = await readJsonFile("package.json", "package.json");
const repoMap = await readTextFile(mapRelativePath, mapRelativePath);
const manifest = await readJsonFile(manifestRelativePath, manifestRelativePath);

if (repoMap !== null) checkRepoMap(repoMap);
if (manifest !== null && packageJson !== null) await checkManifest(manifest, packageJson);

failIfErrors("Repo map check", errors);

async function readTextFile(relativePath, label) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!(await exists(absolutePath))) {
    errors.push(`${label} does not exist.`);
    return null;
  }
  return await readFile(absolutePath, "utf8");
}

async function readJsonFile(relativePath, label) {
  const content = await readTextFile(relativePath, label);
  if (content === null) return null;

  try {
    return JSON.parse(content);
  } catch (error) {
    errors.push(`${label} is not valid JSON: ${error.message}`);
    return null;
  }
}

function checkRepoMap(content) {
  for (const section of requiredMapSections) {
    if (!content.includes(section)) {
      errors.push(`${mapRelativePath} is missing required section ${section}.`);
    }
  }

  for (const requiredText of [manifestRelativePath, "npm run check:repo-map"]) {
    if (!content.includes(requiredText)) {
      errors.push(`${mapRelativePath} must reference ${requiredText}.`);
    }
  }
}

async function checkManifest(repoMapManifest, pkg) {
  if (repoMapManifest.version !== 1) {
    errors.push(`${manifestRelativePath}.version must be 1.`);
  }

  await checkPackage(repoMapManifest.package, pkg);
  checkScripts(repoMapManifest.scripts, pkg.scripts ?? {});
  await checkPathEntries("directories", repoMapManifest.directories, { expectDirectory: true });
  await checkPathEntries("entrypoints", repoMapManifest.entrypoints, { expectDirectory: false });
  await checkNamedPathObject("generation", repoMapManifest.generation);
  await checkNamedPathObject("validation", repoMapManifest.validation);
  checkPublishedFiles(repoMapManifest.publishedFiles, pkg.files ?? []);
  await checkSyncGroups(repoMapManifest.syncGroups);
}

async function checkPackage(packageEntry, pkg) {
  if (!isPlainObject(packageEntry)) {
    errors.push(`${manifestRelativePath}.package must be an object.`);
    return;
  }

  if (packageEntry.name !== pkg.name) {
    errors.push(`${manifestRelativePath}.package.name must match package.json name ${JSON.stringify(pkg.name)}.`);
  }
  if (packageEntry.versionSource !== "package.json") {
    errors.push(`${manifestRelativePath}.package.versionSource must be "package.json".`);
  }

  const binaryPath = pkg.bin?.structor;
  if (packageEntry.binary !== binaryPath) {
    errors.push(`${manifestRelativePath}.package.binary must match package.json bin.structor ${JSON.stringify(binaryPath)}.`);
  }
  if (typeof binaryPath === "string") {
    await checkPathExists(binaryPath, `${manifestRelativePath}.package.binary`, { expectDirectory: false });
  }
}

function checkScripts(scriptEntries, packageScripts) {
  if (!Array.isArray(scriptEntries)) {
    errors.push(`${manifestRelativePath}.scripts must be an array.`);
    return;
  }

  const manifestScripts = new Map();
  for (const [index, entry] of scriptEntries.entries()) {
    const label = `${manifestRelativePath}.scripts[${index}]`;
    if (!isPlainObject(entry)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!hasNonEmptyString(entry.name)) errors.push(`${label}.name must be a non-empty string.`);
    if (!hasNonEmptyString(entry.command)) errors.push(`${label}.command must be a non-empty string.`);
    if (!hasNonEmptyString(entry.purpose)) errors.push(`${label}.purpose must be a non-empty string.`);
    if (!hasNonEmptyString(entry.name)) continue;

    if (manifestScripts.has(entry.name)) {
      errors.push(`${entry.name} is duplicated in ${manifestRelativePath}.scripts.`);
    }
    manifestScripts.set(entry.name, entry);
  }

  for (const [name, command] of Object.entries(packageScripts)) {
    const entry = manifestScripts.get(name);
    if (!entry) {
      errors.push(`package.json script ${name} is missing from ${manifestRelativePath}.scripts.`);
      continue;
    }
    if (entry.command !== command) {
      errors.push(`${manifestRelativePath}.scripts entry ${name} command must match package.json.`);
    }
  }

  for (const name of manifestScripts.keys()) {
    if (!Object.hasOwn(packageScripts, name)) {
      errors.push(`${manifestRelativePath}.scripts entry ${name} is not present in package.json.`);
    }
  }
}

async function checkPathEntries(fieldName, entries, { expectDirectory }) {
  if (!Array.isArray(entries)) {
    errors.push(`${manifestRelativePath}.${fieldName} must be an array.`);
    return;
  }

  const seen = new Set();
  for (const [index, entry] of entries.entries()) {
    const label = `${manifestRelativePath}.${fieldName}[${index}]`;
    if (!isPlainObject(entry)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!hasNonEmptyString(entry.path)) {
      errors.push(`${label}.path must be a non-empty string.`);
      continue;
    }
    if (!hasNonEmptyString(entry.purpose)) {
      errors.push(`${label}.purpose must be a non-empty string.`);
    }
    if (seen.has(entry.path)) {
      errors.push(`${entry.path} is duplicated in ${manifestRelativePath}.${fieldName}.`);
    }
    seen.add(entry.path);
    await checkPathExists(entry.path, label, { expectDirectory });
  }
}

async function checkNamedPathObject(fieldName, entries) {
  if (!isPlainObject(entries)) {
    errors.push(`${manifestRelativePath}.${fieldName} must be an object.`);
    return;
  }

  for (const [key, relativePath] of Object.entries(entries)) {
    const label = `${manifestRelativePath}.${fieldName}.${key}`;
    if (!hasNonEmptyString(relativePath)) {
      errors.push(`${label} must be a non-empty string.`);
      continue;
    }
    await checkPathExists(relativePath, label, {
      expectDirectory: relativePath.endsWith("/") || !path.extname(relativePath),
    });
  }
}

function checkPublishedFiles(publishedFiles, packageFiles) {
  if (!Array.isArray(publishedFiles)) {
    errors.push(`${manifestRelativePath}.publishedFiles must be an array.`);
    return;
  }

  const manifestSet = new Set(publishedFiles);
  const packageSet = new Set(packageFiles);
  for (const entry of publishedFiles) {
    if (!hasNonEmptyString(entry)) {
      errors.push(`${manifestRelativePath}.publishedFiles must contain only non-empty strings.`);
      continue;
    }
    assertPathSafe(entry, `${manifestRelativePath}.publishedFiles entry ${entry}`);
  }

  for (const entry of packageSet) {
    if (!manifestSet.has(entry)) {
      errors.push(`package.json.files entry ${entry} is missing from ${manifestRelativePath}.publishedFiles.`);
    }
  }
  for (const entry of manifestSet) {
    if (!packageSet.has(entry)) {
      errors.push(`${manifestRelativePath}.publishedFiles entry ${entry} is not present in package.json.files.`);
    }
  }
}

async function checkSyncGroups(syncGroups) {
  if (!Array.isArray(syncGroups)) {
    errors.push(`${manifestRelativePath}.syncGroups must be an array.`);
    return;
  }

  const seenNames = new Set();
  for (const [index, group] of syncGroups.entries()) {
    const label = `${manifestRelativePath}.syncGroups[${index}]`;
    if (!isPlainObject(group)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!hasNonEmptyString(group.name)) {
      errors.push(`${label}.name must be a non-empty string.`);
    } else if (seenNames.has(group.name)) {
      errors.push(`${group.name} is duplicated in ${manifestRelativePath}.syncGroups.`);
    } else {
      seenNames.add(group.name);
    }

    if (!Array.isArray(group.paths) || group.paths.length === 0) {
      errors.push(`${label}.paths must be a non-empty array.`);
      continue;
    }
    for (const relativePath of group.paths) {
      if (!hasNonEmptyString(relativePath)) {
        errors.push(`${label}.paths must contain only non-empty strings.`);
        continue;
      }
      await checkPathExists(relativePath, `${label}.paths entry ${relativePath}`, {
        expectDirectory: relativePath.endsWith("/"),
      });
    }
  }
}

async function checkPathExists(relativePath, label, { expectDirectory }) {
  const normalizedPath = normalizeRelativePath(relativePath);
  assertPathSafe(relativePath, label);

  const absolutePath = path.join(repoRoot, normalizedPath);
  if (!(await exists(absolutePath))) {
    errors.push(`${label} points to missing path ${normalizedPath}.`);
    return;
  }

  if (expectDirectory && path.extname(normalizedPath) !== "") {
    errors.push(`${label} is marked as a directory but looks like a file: ${normalizedPath}.`);
  }
}

function assertPathSafe(relativePath, label) {
  const normalizedPath = normalizeRelativePath(relativePath);
  if (path.isAbsolute(relativePath) || normalizedPath.startsWith("../") || normalizedPath.includes("/../")) {
    errors.push(`${label} must be a relative path without traversal.`);
  }
}

function normalizeRelativePath(relativePath) {
  return relativePath.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
}

function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
