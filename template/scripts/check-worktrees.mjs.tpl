#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalRepos,
  exists,
  formatInspection,
  inspectCheckout,
  listGitWorktrees,
} from "./lib/worktree-bootstrap.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(repoRoot, "..");
const includeCanonicalArg = "--include-canonical";
const includeNoWorktreeListArg = "--no-worktree-list";
const strictArg = "--strict";
const canonicalInspectionSource = "canonical";
const worktreeInspectionSource = "worktree";
const noTargetsMessage = "No worktree bootstrap targets selected. Use --include-canonical or allow git worktree discovery.";

const args = new Set(process.argv.slice(2));
const includeCanonical = args.has(includeCanonicalArg);
const includeWorktreeList = !args.has(includeNoWorktreeListArg);
const strict = args.has(strictArg);

const inspections = [];
if (includeCanonical) {
  for (const repoName of canonicalRepos) {
    const inspection = await inspectCheckout({ targetPath: path.join(workspaceRoot, repoName), harnessRoot: repoRoot });
    inspection.source = canonicalInspectionSource;
    inspections.push(inspection);
  }
}

if (includeWorktreeList) {
  for (const repoName of canonicalRepos) {
    const canonicalPath = path.join(workspaceRoot, repoName);
    if (!(await exists(canonicalPath))) continue;
    let records = [];
    try {
      records = await listGitWorktrees(canonicalPath);
    } catch {
      continue;
    }
    for (const record of records) {
      if (includeCanonical && path.resolve(record.path) === path.resolve(canonicalPath)) continue;
      const inspection = await inspectCheckout({ targetPath: record.path, harnessRoot: repoRoot, worktreeRecord: record });
      inspection.source = worktreeInspectionSource;
      inspections.push(inspection);
    }
  }
}

if (inspections.length === 0) {
  console.log(noTargetsMessage);
  process.exit(0);
}

console.log("Worktree bootstrap check:");
for (const inspection of inspections) {
  console.log(`- ${formatInspection(inspection, { harnessRoot: repoRoot }).replaceAll("\n", "\n  ")}`);
}

const blocking = strict ? inspections.filter((inspection) => !inspection.valid) : inspections.filter((inspection) => inspection.source === canonicalInspectionSource && !inspection.valid);
if (blocking.length > 0) {
  console.error(`Worktree bootstrap check found ${blocking.length} blocking issue(s).`);
  process.exit(1);
}
