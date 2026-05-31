#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requiredGeneratedHarnessFilesForGovernance } from "./generated-harness-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const models = {
  openai: {{MODEL_OPENAI_ENABLED}},
  anthropic: {{MODEL_ANTHROPIC_ENABLED}},
};
const clientSupport = {
  codexHooks: {{CLIENT_CODEX_HOOKS_ENABLED}},
  claudeRules: {{CLIENT_CLAUDE_RULES_ENABLED}},
  claudeHooks: {{CLIENT_CLAUDE_HOOKS_ENABLED}},
  claudeSkills: {{CLIENT_CLAUDE_SKILLS_ENABLED}},
};
const requiredFiles = requiredGeneratedHarnessFilesForGovernance({ models, clientSupport });

async function exists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const errors = [];
for (const relativePath of requiredFiles) {
  if (!(await exists(relativePath))) errors.push(`missing ${relativePath}`);
}

for (const relativePath of requiredFiles.filter((item) => item.endsWith(".md"))) {
  const content = await readFile(path.join(repoRoot, relativePath), "utf8");
  if (/\{\{[A-Z0-9_]+\}\}/.test(content)) {
    errors.push(`${relativePath} contains an unresolved template placeholder.`);
  }
}

if (errors.length > 0) {
  console.error("Generated harness governance check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Generated harness governance check passed.");
