#!/usr/bin/env node

import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "{{PROJECT_SLUG}}-views-"));

execFileSync(process.execPath, ["scripts/generate-html-views.mjs", "--output", tempRoot], {
  cwd: repoRoot,
  stdio: "pipe",
});

async function htmlFiles(baseDir) {
  const dir = path.join(baseDir, "ai/views");
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".html")).map((entry) => entry.name).sort();
}

const expected = await htmlFiles(tempRoot);
const actual = await htmlFiles(repoRoot);
const errors = [];

for (const name of expected) {
  if (!actual.includes(name)) {
    errors.push(`missing generated view ai/views/${name}`);
    continue;
  }
  const expectedContent = await readFile(path.join(tempRoot, "ai/views", name), "utf8");
  const actualContent = await readFile(path.join(repoRoot, "ai/views", name), "utf8");
  if (expectedContent !== actualContent) {
    errors.push(`stale generated view ai/views/${name}; run node scripts/generate-html-views.mjs`);
  }
}

for (const name of actual) {
  if (!expected.includes(name)) errors.push(`unexpected generated view ai/views/${name}`);
}

if (errors.length > 0) {
  console.error("HTML view check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("HTML view check passed.");
