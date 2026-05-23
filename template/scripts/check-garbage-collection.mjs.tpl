#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const garbageCollectionPolicyPath = "ai/AGENT-GARBAGE-COLLECTION.md";
const requiredGarbagePhrases = ["archive", "stale", "generated", "validation"];
const content = await readFile(path.join(repoRoot, garbageCollectionPolicyPath), "utf8");
const errors = [];

for (const phrase of requiredGarbagePhrases) {
  if (!content.toLowerCase().includes(phrase)) {
    errors.push(`${garbageCollectionPolicyPath} should mention ${phrase}.`);
  }
}

if (errors.length > 0) {
  console.error("Garbage collection check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Garbage collection check passed.");
