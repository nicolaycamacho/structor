#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { failIfErrors, repoRoot } from "./lib.mjs";

const overlayFiles = [
  "template/ai/model-overlays/openai/AGENTS.md.tpl",
  "template/ai/model-overlays/anthropic/CLAUDE.md.tpl",
  "template/consumer/AGENTS.md.tpl",
  "template/consumer/CLAUDE.md.tpl",
  "template/consumer/.claude/CLAUDE.md.tpl",
  "template/.claude/CLAUDE.md.tpl",
];
const errors = [];

for (const relativePath of overlayFiles) {
  const content = await readFile(path.join(repoRoot, relativePath), "utf8");
  if (!/canonical policy belongs|Canonical policy lives|Read the harness first|Read:/i.test(content)) {
    errors.push(`${relativePath} must route to canonical policy.`);
  }
  if (!/thin|short|pointer/i.test(content)) {
    errors.push(`${relativePath} must state that it stays thin or short.`);
  }
  if (content.length > 1200) {
    errors.push(`${relativePath} is too large for a thin pointer file.`);
  }
}

failIfErrors("Model overlay check", errors);
