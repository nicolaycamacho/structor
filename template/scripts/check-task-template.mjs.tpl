#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inputFile, validateBrief, report } from "./lib/brief-validation.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const taskTemplatePath = "ai/templates/task-brief-template.md";
const canonicalRepos = new Set(["{{HARNESS_REPO_NAME}}", ...{{CONSUMER_REPO_NAMES_JSON}}]);
const errors = [];
try {
  const file = inputFile(process.argv.slice(2));
  if (file) {
    errors.push(...validateBrief(file, await readFile(path.resolve(file), "utf8"), { kind: "task", canonicalRepos }));
  } else if ("{{HARNESS_PROFILE}}" === "focused") {
    console.log("Task starter templates are not included in the focused profile; use --file <path>.");
  } else {
    errors.push(...validateBrief(taskTemplatePath, await readFile(path.join(repoRoot, taskTemplatePath), "utf8"), {
      kind: "task", canonicalRepos, allowPlaceholders: true,
    }));
  }
} catch (error) {
  errors.push(error.message);
}
report("Task template check", errors);
