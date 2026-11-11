#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveGuidanceTarget, validateGuidanceGraph } from "./lib/harness-routing.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = "ai/knowledge-manifest.json";
const ignoredAiDocDirectories = new Set(["model-overlays", "templates", "contracts", "skills", "specs", "plans"]);
const archiveOrGeneratedPattern = /archive|archived|historical|generated/i;

function fromRoot(relativePath) {
  return path.join(repoRoot, relativePath);
}

function toRepoRelative(absolutePath) {
  return path.relative(repoRoot, absolutePath).replaceAll(path.sep, "/");
}

async function readText(relativePath) {
  const safePath = await resolveGuidanceTarget({ harnessRoot: repoRoot, reference: relativePath });
  return readFile(fromRoot(safePath), "utf8");
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

const models = { openai: {{MODEL_OPENAI_ENABLED}}, anthropic: {{MODEL_ANTHROPIC_ENABLED}} };
const errors = [];
const manifest = JSON.parse(await readText(manifestPath));
const { issues, edges } = await validateGuidanceGraph({ harnessRoot: repoRoot, models, profile: {{HARNESS_PROFILE_JSON}}, manifest });
errors.push(...issues);
const docs = manifest.canonicalDocs ?? [];
const listed = new Set(docs.map((doc) => doc.path));

for (const doc of docs) {
  try {
    await resolveGuidanceTarget({ harnessRoot: repoRoot, reference: doc.path });
  } catch (error) {
    errors.push(`${doc.path}: ${error.message}`);
    continue;
  }
  if (doc.status === "active" && !doc.purpose?.trim()) {
    errors.push(`${doc.path} is active but has no purpose.`);
  }
  for (const linkedFrom of doc.linkedFrom ?? []) {
    if (!edges.get(linkedFrom)?.has(doc.path)) {
      errors.push(`${doc.path} is not linked by an exact declared reference from ${linkedFrom}.`);
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

console.log("Knowledge manifest check passed (static guidance reachability only; not proof of model behavior).");
