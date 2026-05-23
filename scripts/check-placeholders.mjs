#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { collectFiles, failIfErrors, repoRoot } from "./lib.mjs";

const errors = [];
const activeFiles = await collectFiles(".", (file) => {
  if (file.startsWith(".git/")) return false;
  if (file.startsWith("template/")) return false;
  return [".md", ".json", ".mjs"].some((suffix) => file.endsWith(suffix));
});

const defaultForbiddenProjectTermsEnvVar = "HARNESS_FORBIDDEN_PROJECT_TERMS";
const forbiddenProjectTermsModeEnvVar = "HARNESS_FORBIDDEN_PROJECT_TERMS_MODE";
const forbiddenProjectTermsModeOverride = "override";
const termListSeparator = ",";
const defaultForbiddenProjectTerms = [
  "AI Front Desk",
  "Flowdesk",
  "ai-front-desk-api",
  "ai-front-desk-platform",
];

const configuredForbiddenProjectTerms = (process.env[defaultForbiddenProjectTermsEnvVar] ?? "")
  .split(termListSeparator)
  .map((term) => term.trim())
  .filter(Boolean);

const forbiddenProjectTermValues = [
  ...(process.env[forbiddenProjectTermsModeEnvVar] === forbiddenProjectTermsModeOverride ? [] : defaultForbiddenProjectTerms),
  ...configuredForbiddenProjectTerms,
];

const forbiddenProjectTerms = [...new Set(forbiddenProjectTermValues)]
  .map((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i"));

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

for (const relativePath of activeFiles) {
  const content = await readFile(path.join(repoRoot, relativePath), "utf8");
  if (/\{\{[A-Z0-9_]+\}\}/.test(content)) {
    errors.push(`${relativePath} contains an unresolved template placeholder.`);
  }
  if (relativePath !== "scripts/check-placeholders.mjs" && /TODO|TBD|fixme/i.test(content)) {
    errors.push(`${relativePath} contains TODO/TBD/fixme placeholder text.`);
  }
  if (relativePath === "scripts/check-placeholders.mjs") continue;
  for (const pattern of forbiddenProjectTerms) {
    if (pattern.test(content)) {
      errors.push(`${relativePath} contains project-specific source content.`);
      break;
    }
  }
}

failIfErrors("Placeholder check", errors);
