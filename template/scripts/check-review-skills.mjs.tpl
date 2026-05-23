#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsReadmePath = "ai/skills/README.md";
const skillsDir = "ai/skills";
const skillFileExtension = ".md";
const requiredSections = [
  "Purpose",
  "When to Use",
  "Required Inputs",
  "Blocking Findings",
  "Non-Blocking Observations",
  "Output Format",
  "Escalation Rules",
  "Validation Or Evidence",
];

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function hasHeading(content, heading) {
  return new RegExp(`^## ${heading}\\s*$`, "m").test(content);
}

const errors = [];
const readme = await read(skillsReadmePath);
const entries = await readdir(path.join(repoRoot, skillsDir), { withFileTypes: true });
for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(skillFileExtension) && item.name !== "README.md")) {
  const relativePath = `ai/skills/${entry.name}`;
  const content = await read(relativePath);
  if (!readme.includes(entry.name)) errors.push(`${relativePath} is not linked from ai/skills/README.md.`);
  for (const section of requiredSections) {
    if (!hasHeading(content, section)) errors.push(`${relativePath} is missing section '${section}'.`);
  }
}

if (errors.length > 0) {
  console.error("Review skill check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Review skill check passed.");
