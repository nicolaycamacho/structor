#!/usr/bin/env node

import { access, readFile, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plansDir = "ai/plans/active";
const headingRules = ["Status", "Goal", "Next Step", "Validation Plan"];
const runtimeTokens = ["app-server.jsonl", "run-status.json", "events.jsonl", ".agent-runs", ".agent-workspaces", "scripts/orchestrator/"];
const readmePath = "ai/plans/README.md";
const rulesHeading = "## Rules";
const techDebtPath = "ai/plans/tech-debt.md";
const openItemsHeading = "## Open Items";

function absolutePath(relativePath) {
  return path.join(repoRoot, relativePath);
}

async function pathExists(relativePath) {
  try {
    await access(absolutePath(relativePath), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readText(relativePath) {
  return readFile(absolutePath(relativePath), "utf8");
}

async function listedPlanFiles(relativeDir) {
  if (!(await pathExists(relativeDir))) return [];
  const entries = await readdir(absolutePath(relativeDir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .filter((entry) => entry.name.endsWith(".md"))
    .map((entry) => `${relativeDir}/${entry.name}`)
    .sort();
}

function sectionBody(content, heading) {
  const match = content.match(new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$)`, "m"));
  return match?.[1] ?? "";
}

function hasMeaningfulText(markdownFragment) {
  return markdownFragment.replace(/[-*\\s:]/g, "").trim().length > 0;
}

const errors = [];
for (const relativePath of await listedPlanFiles(plansDir)) {
  const content = await readText(relativePath);
  for (const heading of headingRules) {
    if (!hasMeaningfulText(sectionBody(content, heading))) {
      errors.push(`${relativePath} has no ${heading} content.`);
    }
  }
  for (const token of runtimeTokens) {
    if (content.includes(token)) errors.push(`${relativePath} references runtime state token '${token}'.`);
  }
}

const readme = await readText(readmePath);
const rulesRegex = new RegExp(`^${rulesHeading}\\s*$`, "m");
if (!rulesRegex.test(readme)) {
  errors.push("ai/plans/README.md must include a Rules section.");
}

const techDebt = await readText(techDebtPath);
const openItemsRegex = new RegExp(`^${openItemsHeading}\\s*$`, "m");
if (!openItemsRegex.test(techDebt)) {
  errors.push("ai/plans/tech-debt.md must include Open Items.");
}

if (errors.length > 0) {
  console.error("Plan check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Plan check passed.");
