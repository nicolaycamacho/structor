#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { failIfErrors, readJson, repoRoot } from "./lib.mjs";

const errors = [];
const schema = await readJson("schemas/contract-manifest.schema.json");
for (const field of ["id", "name", "version", "owners", "affectedRepos", "requiredFiles"]) {
  if (!schema.required?.includes(field)) {
    errors.push(`contract manifest schema is missing required field ${field}`);
  }
}

const readme = await readFile(path.join(repoRoot, "template/ai/contracts/README.md.tpl"), "utf8");
for (const contract of [
  "repo-boundaries.md",
  "app-legibility.md",
  "api-boundary.md",
  "security-boundary.md",
  "codex-hooks.md",
  "release-flow.md",
  "github-safety.md",
]) {
  if (!readme.includes(contract)) {
    errors.push(`contracts README does not link ${contract}`);
  }
}

failIfErrors("Contract manifest check", errors);
