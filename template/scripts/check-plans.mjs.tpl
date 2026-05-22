#!/usr/bin/env node

import { access, readFile, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeTokens = ["app-server.jsonl", "run-status.json", "events.jsonl", ".agent-runs", ".agent-workspaces", "scripts/orchestrator/"];

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

async function markdownFiles(relativeDir) {
  if (!(await exists(relativeDir))) return [];
  const entries = await readdir(path.join(repoRoot, relativeDir), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => `${relativeDir}/${entry.name}`);
}

function sectionHasContent(content, heading) {
  const match = content.match(new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$)`, "m"));
  return Boolean(match?.[1]?.replace(/[-*\\s:]/g, "").trim());
}

const errors = [];
for (const relativePath of await markdownFiles("ai/plans/active")) {
  const content = await read(relativePath);
  for (const heading of ["Status", "Goal", "Next Step", "Validation Plan"]) {
    if (!sectionHasContent(content, heading)) errors.push(`${relativePath} has no ${heading} content.`);
  }
  for (const token of runtimeTokens) {
    if (content.includes(token)) errors.push(`${relativePath} references runtime state token '${token}'.`);
  }
}

const readme = await read("ai/plans/README.md");
if (!/^## Rules\s*$/m.test(readme)) {
  errors.push("ai/plans/README.md must include a Rules section.");
}

const techDebt = await read("ai/plans/tech-debt.md");
if (!/^## Open Items\s*$/m.test(techDebt)) {
  errors.push("ai/plans/tech-debt.md must include Open Items.");
}

if (errors.length > 0) {
  console.error("Plan check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Plan check passed.");
