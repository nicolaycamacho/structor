#!/usr/bin/env node

import { access, readFile, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = "ai/knowledge-manifest.json";
const ignoredAiDocDirectories = new Set(["model-overlays", "templates", "contracts", "skills", "specs", "plans"]);
const archiveOrGeneratedPattern = /archive|archived|historical|generated/i;

function fromRoot(relativePath) {
  return path.join(repoRoot, relativePath);
}

async function canAccess(relativePath) {
  try {
    await access(fromRoot(relativePath), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function toRepoRelative(absolutePath) {
  return path.relative(repoRoot, absolutePath).replaceAll(path.sep, "/");
}

async function readText(relativePath) {
  return readFile(fromRoot(relativePath), "utf8");
}

async function collectMarkdownFiles(relativeRoot) {
  const discovered = [];
  const queue = [fromRoot(relativeRoot)];

  while (queue.length > 0) {
    const currentPath = queue.shift();
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (ignoredAiDocDirectories.has(entry.name)) continue;
        queue.push(absolute);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        discovered.push(toRepoRelative(absolute));
      }
    }
  }

  return discovered.sort();
}

const errors = [];
const manifest = JSON.parse(await readText(manifestPath));
const docs = manifest.canonicalDocs ?? [];
const listed = new Set(docs.map((doc) => doc.path));

for (const doc of docs) {
  if (!(await canAccess(doc.path))) {
    errors.push(`${doc.path} is listed in ${manifestPath} but does not exist.`);
    continue;
  }
  if (doc.status === "active" && !doc.purpose?.trim()) {
    errors.push(`${doc.path} is active but has no purpose.`);
  }
  for (const linkedFrom of doc.linkedFrom ?? []) {
    if (!(await canAccess(linkedFrom))) {
      errors.push(`${doc.path} expects a routing link from ${linkedFrom}, but it does not exist.`);
      continue;
    }
    const source = await readText(linkedFrom);
    if (!source.includes(doc.path) && !source.includes(path.basename(doc.path))) {
      errors.push(`${doc.path} is not linked from ${linkedFrom}.`);
    }
  }
}

for (const relativePath of await collectMarkdownFiles("ai")) {
  const preamble = (await readText(relativePath)).slice(0, 400);
  if (!listed.has(relativePath) && !archiveOrGeneratedPattern.test(preamble)) {
    errors.push(`${relativePath} is an active ai/*.md doc but is not listed in ${manifestPath}.`);
  }
}

if (errors.length > 0) {
  console.error("Knowledge manifest check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Knowledge manifest check passed.");
