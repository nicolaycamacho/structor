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

const forbiddenProjectTerms = [
  /\bAI Front Desk\b/i,
  /\bFlowdesk\b/i,
  /\bai-front-desk-api\b/i,
  /\bai-front-desk-platform\b/i,
];

for (const relativePath of activeFiles) {
  const content = await readFile(path.join(repoRoot, relativePath), "utf8");
  if (/\{\{[A-Z0-9_]+\}\}/.test(content)) {
    errors.push(`${relativePath} contains an unresolved template placeholder.`);
  }
  if (relativePath !== "scripts/check-placeholders.mjs" && /TODO|TBD|fixme/i.test(content)) {
    errors.push(`${relativePath} contains TODO/TBD/fixme placeholder text.`);
  }
  for (const pattern of forbiddenProjectTerms) {
    if (pattern.test(content)) {
      errors.push(`${relativePath} contains project-specific source content.`);
      break;
    }
  }
}

failIfErrors("Placeholder check", errors);
