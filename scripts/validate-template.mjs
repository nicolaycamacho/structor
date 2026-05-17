#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import { repoRoot } from "./lib.mjs";

const checks = [
  "scripts/check-config.mjs",
  "scripts/check-template-files.mjs",
  "scripts/check-task-template.mjs",
  "scripts/check-contract-manifests.mjs",
  "scripts/check-model-overlays.mjs",
  "scripts/check-placeholders.mjs",
];

for (const check of checks) {
  execFileSync(process.execPath, [path.join(repoRoot, check)], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

console.log("Template validation passed.");
