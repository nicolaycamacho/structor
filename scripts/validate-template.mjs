#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const command of [["npm", ["run", "check:ci"]], ["npm", ["run", "check:smoke"]]]) {
  execFileSync(command[0], command[1], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

console.log("Template validation passed.");
