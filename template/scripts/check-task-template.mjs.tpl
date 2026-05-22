#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relativePath = "ai/templates/task-brief-template.md";
const content = await readFile(path.join(repoRoot, relativePath), "utf8");

const requiredSections = [
  "## Summary",
  "## Context",
  "## Goals",
  "## Non-Goals",
  "## Scope",
  "## Path Contract",
  "## Requirements",
  "## Bootstrap Requirements",
  "## Proposed Approach",
  "## Agent Execution Protocol",
  "## Success Criteria",
  "## Validation",
  "## Validation Evidence Required",
  "## Risk and Autonomy",
  "## Review Routing",
  "## Dependencies",
  "## Rollback / Recovery",
  "## Open Questions",
  "## Notes for the Agent",
];

const requiredFrontmatter = [
  "id:",
  "status:",
  "risk:",
  "autonomy:",
  "model_policy:",
  "model:",
  "repos:",
  "allowed_paths:",
  "forbidden_paths:",
  "requires_human_approval:",
];

const errors = [];
for (const token of [...requiredSections, ...requiredFrontmatter]) {
  if (!content.includes(token)) errors.push(`${relativePath} is missing ${token}`);
}

const modelLine = content.split("\n").find((line) => line.startsWith("model:"));
if (modelLine && /\b(?:gpt-|claude|opus|sonnet|haiku)/i.test(modelLine)) {
  errors.push(`${relativePath} must use a runtime-neutral model selector, not a concrete provider model.`);
}

if (errors.length > 0) {
  console.error("Task template check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Task template check passed.");
