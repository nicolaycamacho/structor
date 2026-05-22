#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = await readFile(path.join(repoRoot, "ai/AGENT-GARBAGE-COLLECTION.md"), "utf8");
const errors = [];

for (const phrase of ["archive", "stale", "generated", "validation"]) {
  if (!content.toLowerCase().includes(phrase)) {
    errors.push(`ai/AGENT-GARBAGE-COLLECTION.md should mention ${phrase}.`);
  }
}

if (errors.length > 0) {
  console.error("Garbage collection check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Garbage collection check passed.");
