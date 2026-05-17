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
  "## Requirements",
  "## Validation",
  "## Validation Evidence Required",
  "## Review Routing",
  "## Rollback / Recovery",
  "## Open Questions",
];
const requiredFrontmatter = [
  "id:",
  "status:",
  "risk:",
  "autonomy:",
  "model_policy:",
  "repos:",
  "allowed_paths:",
  "forbidden_paths:",
  "requires_human_approval:",
];

const errors = [];
for (const token of [...requiredSections, ...requiredFrontmatter]) {
  if (!content.includes(token)) errors.push(`${relativePath} is missing ${token}`);
}

failIfErrors("Task template check", errors);
