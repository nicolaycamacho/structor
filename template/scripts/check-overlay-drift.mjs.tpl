#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const models = {
  openai: {{MODEL_OPENAI_ENABLED}},
  anthropic: {{MODEL_ANTHROPIC_ENABLED}},
};

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

const errors = [];
const canonical = await read("ai/AGENTS.md");
if (!canonical.includes("model-neutral")) {
  errors.push("ai/AGENTS.md must keep shared guidance model-neutral.");
}

if (models.openai) {
  const openai = await read("ai/model-overlays/openai/AGENTS.md");
  if (!/OpenAI|Codex/i.test(openai)) {
    errors.push("ai/model-overlays/openai/AGENTS.md must identify the OpenAI/Codex surface.");
  }
  if (!openai.includes("../AGENTS.md") && !openai.includes("../../AGENTS.md")) {
    errors.push("ai/model-overlays/openai/AGENTS.md must route back to canonical ai/* guidance.");
  }
}

if (models.anthropic) {
  const claude = await read("ai/model-overlays/anthropic/CLAUDE.md");
  if (!/Anthropic|Claude/i.test(claude)) {
    errors.push("ai/model-overlays/anthropic/CLAUDE.md must identify the Anthropic/Claude surface.");
  }
  if (!claude.includes("../AGENTS.md") && !claude.includes("../../CLAUDE.md")) {
    errors.push("ai/model-overlays/anthropic/CLAUDE.md must route back to canonical ai/* guidance.");
  }
}

if (errors.length > 0) {
  console.error("Overlay drift check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Overlay drift check passed.");
