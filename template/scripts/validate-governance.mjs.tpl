#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

execFileSync(process.execPath, [path.join(repoRoot, "scripts/check-template-governance.mjs")], {
  cwd: repoRoot,
  stdio: "inherit",
});

console.log("Governance validation passed.");
