#!/usr/bin/env node

import { access, readFile, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = "ai/knowledge-manifest.json";

async function exists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function markdownFiles(baseRelativePath) {
  const files = [];
  async function walk(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentPath, entry.name);
      const relative = path.relative(repoRoot, absolute).replaceAll(path.sep, "/");
      if (entry.isDirectory()) {
        if (["model-overlays", "templates", "contracts", "skills", "specs", "plans"].includes(entry.name)) continue;
        await walk(absolute);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(relative);
      }
    }
  }
  await walk(path.join(repoRoot, baseRelativePath));
  return files.sort();
}

const errors = [];
const manifest = JSON.parse(await read(manifestPath));
const docs = manifest.canonicalDocs ?? [];
const listed = new Set(docs.map((doc) => doc.path));

for (const doc of docs) {
  if (!(await exists(doc.path))) {
    errors.push(`${doc.path} is listed in ${manifestPath} but does not exist.`);
    continue;
  }
  if (doc.status === "active" && !doc.purpose?.trim()) {
    errors.push(`${doc.path} is active but has no purpose.`);
  }
  for (const linkedFrom of doc.linkedFrom ?? []) {
    if (!(await exists(linkedFrom))) {
      errors.push(`${doc.path} expects a routing link from ${linkedFrom}, but it does not exist.`);
      continue;
    }
    const source = await read(linkedFrom);
    if (!source.includes(doc.path) && !source.includes(path.basename(doc.path))) {
      errors.push(`${doc.path} is not linked from ${linkedFrom}.`);
    }
  }
}

for (const relativePath of await markdownFiles("ai")) {
  if (!listed.has(relativePath) && !/archive|archived|historical|generated/i.test((await read(relativePath)).slice(0, 400))) {
    errors.push(`${relativePath} is an active ai/*.md doc but is not listed in ${manifestPath}.`);
  }
}

if (errors.length > 0) {
  console.error("Knowledge manifest check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Knowledge manifest check passed.");
