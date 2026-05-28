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

// Structor ships with no hardcoded project terms. Consumers can opt into this
// leak check with a comma-separated HARNESS_FORBIDDEN_PROJECT_TERMS value.
const forbiddenProjectTermsEnvVar = "HARNESS_FORBIDDEN_PROJECT_TERMS";
const termListSeparator = ",";

const configuredForbiddenProjectTerms = (process.env[forbiddenProjectTermsEnvVar] ?? "")
  .split(termListSeparator)
  .map((term) => term.trim())
  .filter(Boolean);

const forbiddenProjectTerms = [...new Set(configuredForbiddenProjectTerms)]
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
      errors.push(`${relativePath} contains a configured forbidden project term.`);
      break;
    }
  }
}

failIfErrors("Placeholder check", errors);
