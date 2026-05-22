#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { failIfErrors, repoRoot } from "./lib.mjs";

const relativePath = "template/ai/templates/task-brief-template.md.tpl";
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

failIfErrors("Task template check", errors);
