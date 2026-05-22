#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRepairPlan,
  formatInspection,
  gitMetadataForPath,
  inspectCheckout,
  writeRepairPlan,
} from "./lib/worktree-bootstrap.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const targetArg = args.find((arg) => !arg.startsWith("--"));

if (!targetArg) {
  console.error("Usage: node scripts/bootstrap-codex-worktree.mjs <worktree-path> [--dry-run]");
  process.exit(1);
}

const targetPath = path.resolve(targetArg);
const metadata = await gitMetadataForPath(targetPath);
if (!metadata.gitRoot) {
  console.error(`Refusing to repair ${targetPath}: target is not inside a git checkout.`);
  process.exit(1);
}

const inspection = await inspectCheckout({ targetPath: metadata.gitRoot, harnessRoot: repoRoot });
console.log(formatInspection(inspection, { harnessRoot: repoRoot }));

if (inspection.valid) {
  console.log("Worktree bootstrap is already valid.");
  process.exit(0);
}

const repairPlan = buildRepairPlan({ inspection, harnessRoot: repoRoot });
if (!repairPlan.repairable) {
  console.error(`Refusing to repair ${inspection.targetPath}: ${repairPlan.reason}`);
  process.exit(1);
}

console.log("Files to write:");
for (const write of repairPlan.writes) console.log(`- ${write.targetPath}`);

if (dryRun) {
  console.log("Dry run complete. No files were written.");
} else {
  await writeRepairPlan(repairPlan);
  console.log("Worktree bootstrap repair complete.");
}
