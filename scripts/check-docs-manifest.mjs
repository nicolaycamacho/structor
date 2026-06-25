#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { exists, failIfErrors, isAbsolutePathString, isSameOrInsidePath, pathHasTraversal, repoRoot } from "./lib.mjs";

const errors = [];
const manifestRelativePath = "docs/manifest.json";
const docsRoot = path.join(repoRoot, "docs");
const excludedGuideFiles = new Set([
  "docs/public-launch.md",
]);
const excludedGuidePrefixes = [
  "docs/adr/",
  "docs/issues/",
];
const requiredReadmeLinks = [
  "docs/index.md",
  "docs/guides/quickstart.md",
  "docs/guides/setting-up-a-harness.md",
  "docs/guides/troubleshooting.md",
  "docs/reference/commands.md",
  "docs/reference/contributor-setup.md",
];
const requiredStringFields = ["path", "title", "purpose", "status"];

let manifest = null;
const manifestPath = path.join(repoRoot, manifestRelativePath);

if (!(await exists(manifestPath))) {
  errors.push(`${manifestRelativePath} does not exist.`);
} else {
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    errors.push(`${manifestRelativePath} is not valid JSON: ${error.message}`);
  }
}

if (manifest) {
  const documents = Array.isArray(manifest.documents) ? manifest.documents : null;
  if (!documents) {
    errors.push(`${manifestRelativePath} must contain a documents array.`);
  } else {
    await checkManifestDocuments(documents);
  }
}

await checkReadmeLinks();

failIfErrors("Docs manifest check", errors);

async function checkManifestDocuments(documents) {
  const seenPaths = new Set();
  const manifestPaths = new Set();

  for (const [index, document] of documents.entries()) {
    const label = `documents[${index}]`;
    for (const field of requiredStringFields) {
      if (!hasNonEmptyField(document, field)) {
        errors.push(`${label} is missing required field ${field}.`);
      }
    }

    if (!Array.isArray(document.audience) || document.audience.length === 0) {
      errors.push(`${label} is missing required field audience.`);
    } else if (document.audience.some((value) => typeof value !== "string" || value.trim() === "")) {
      errors.push(`${label}.audience must contain only non-empty strings.`);
    }

    if (typeof document.path !== "string") continue;
    const normalizedPath = normalizeRelativePath(document.path);
    manifestPaths.add(normalizedPath);

    if (seenPaths.has(normalizedPath)) {
      errors.push(`${normalizedPath} is duplicated in ${manifestRelativePath}.`);
    }
    seenPaths.add(normalizedPath);

    if (!normalizedPath.startsWith("docs/")) {
      errors.push(`${normalizedPath} must be under docs/.`);
    }
    if (isUnsafeManifestPath(normalizedPath)) {
      errors.push(`${normalizedPath} must be a relative path inside docs/ without traversal.`);
    }
    if (path.extname(normalizedPath) !== ".md") {
      errors.push(`${normalizedPath} must be a Markdown guide document.`);
    }
    if (isExcludedGuideFile(normalizedPath)) {
      errors.push(`${normalizedPath} must not be listed in ${manifestRelativePath}.`);
    }
    if (!(await exists(path.resolve(repoRoot, normalizedPath)))) {
      errors.push(`${normalizedPath} is listed in ${manifestRelativePath} but does not exist.`);
    }
  }

  const guideFiles = await collectCanonicalGuideMarkdownFiles();
  for (const guideFile of guideFiles) {
    if (!manifestPaths.has(guideFile)) {
      errors.push(`${guideFile} is a canonical guide document but is not listed in ${manifestRelativePath}.`);
    }
  }
}

async function collectCanonicalGuideMarkdownFiles() {
  const files = [];

  async function walk(relativeDirectory) {
    const entries = await readdir(path.join(repoRoot, relativeDirectory), { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        await walk(relativePath);
      } else if (entry.isFile() && path.extname(entry.name) === ".md" && !isExcludedGuideFile(relativePath)) {
        files.push(relativePath);
      }
    }
  }

  await walk("docs");
  return files.sort();
}

function hasNonEmptyField(document, field) {
  return typeof document?.[field] === "string" && document[field].trim() !== "";
}

function isExcludedGuideFile(relativePath) {
  return excludedGuideFiles.has(relativePath) || excludedGuidePrefixes.some((prefix) => relativePath.startsWith(prefix));
}

function isUnsafeManifestPath(relativePath) {
  if (isAbsolutePathString(relativePath)) return true;
  if (pathHasTraversal(relativePath)) return true;
  return !isSameOrInsidePath(path.resolve(repoRoot, relativePath), docsRoot);
}

function normalizeRelativePath(relativePath) {
  return relativePath.replaceAll("\\", "/").replace(/^\.?\//, "");
}

async function checkReadmeLinks() {
  const readme = await readFile(path.join(repoRoot, "README.md"), "utf8");
  for (const requiredLink of requiredReadmeLinks) {
    if (!readme.includes(`](${requiredLink})`)) {
      errors.push(`README.md must link to ${requiredLink}.`);
    }
  }
}
