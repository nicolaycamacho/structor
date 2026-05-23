#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { failIfErrors, repoRoot } from "./lib.mjs";

const contractsDirectory = "template/ai/contracts";
const contractsReadmePath = `${contractsDirectory}/README.md.tpl`;
const contractTemplateSuffix = ".contract.json.tpl";
const docTemplateSuffix = ".md.tpl";
const requiredFields = ["id", "name", "version", "owners", "affectedRepos", "requiredFiles"];
const semverPattern = /^\d+\.\d+\.\d+$/;
const placeholderStart = "{".repeat(2);
const harnessRepoPlaceholder = `${placeholderStart}HARNESS_REPO_NAME}}`;
const consumerReposPlaceholder = `${placeholderStart}CONSUMER_REPO_NAMES_JSON}}`;

function renderTemplate(content) {
  return content
    .replaceAll(harnessRepoPlaceholder, "template-harness")
    .replaceAll(consumerReposPlaceholder, JSON.stringify(["consumer-app"]));
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

const docFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(docTemplateSuffix) && entry.name !== "README.md.tpl")
  .map((entry) => entry.name);
for (const docName of docFiles) {
  const linkedName = docName.replace(docTemplateSuffix, ".md");
  if (!readme.includes(linkedName)) {
    errors.push(`${contractsDirectory}/${docName} is not linked from ${contractsReadmePath}.`);
  }
}

const contractFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(contractTemplateSuffix));
for (const entry of contractFiles) {
  const relativePath = `${contractsDirectory}/${entry.name}`;
  const content = await readFile(path.join(repoRoot, relativePath), "utf8");
  if (content.includes(placeholderStart)) {
    const rendered = renderTemplate(content);
    try {
      const manifest = JSON.parse(rendered);
      validateManifest(manifest, relativePath, errors);
    } catch (error) {
      errors.push(`${relativePath} must render to valid JSON before generation.`);
      continue;
    }
  } else {
    try {
      const manifest = JSON.parse(content);
      validateManifest(manifest, relativePath, errors);
    } catch {
      errors.push(`${relativePath} must be valid JSON.`);
    }
  }

  const docPath = `${relativePath.replace(contractTemplateSuffix, docTemplateSuffix)}`;
  if (!(await readFile(path.join(repoRoot, docPath), "utf8").catch(() => null))) {
    errors.push(`${relativePath} must have a sibling ${docPath}.`);
  }
}

failIfErrors("Contract manifest check", errors);
