#!/usr/bin/env node

import path from "node:path";
import { exists, failIfErrors, repoRoot } from "./lib.mjs";

const requiredFiles = [
  "template/AGENTS.md.tpl",
  "template/CLAUDE.md.tpl",
  "template/.claude/CLAUDE.md.tpl",
  "template/.claude/settings.json.tpl",
  "template/README.md.tpl",
  "template/ai/AGENTS.md.tpl",
  "template/ai/HUB.md.tpl",
  "template/ai/context.md.tpl",
  "template/ai/HARNESS.md.tpl",
  "template/ai/HARNESS-ENGINEERING.md.tpl",
  "template/ai/QUALITY.md.tpl",
  "template/ai/DECISIONS.md.tpl",
  "template/ai/PRODUCT-SUMMARY.md.tpl",
  "template/ai/PRODUCT.md.tpl",
  "template/ai/ARCHITECTURE.md.tpl",
  "template/ai/DESIGN.md.tpl",
  "template/ai/WORKFLOW.md.tpl",
  "template/ai/RUNNER-SAFETY.md.tpl",
  "template/ai/RUNNER-READINESS.md.tpl",
  "template/ai/AGENT-GARBAGE-COLLECTION.md.tpl",
  "template/ai/model-overlays/openai/AGENTS.md.tpl",
  "template/ai/model-overlays/anthropic/CLAUDE.md.tpl",
  "template/consumer/AGENTS.md.tpl",
  "template/consumer/CLAUDE.md.tpl",
  "template/consumer/.claude/CLAUDE.md.tpl",
  "template/workspace/AGENTS.md.tpl",
  "template/workspace/CLAUDE.md.tpl",
  "template/workspace/.claude/CLAUDE.md.tpl",
  "template/workspace/.claude/settings.json.tpl",
  "template/ai/contracts/README.md.tpl",
  "template/ai/contracts/repo-boundaries.md.tpl",
  "template/ai/contracts/app-legibility.md.tpl",
  "template/ai/contracts/api-boundary.md.tpl",
  "template/ai/contracts/security-boundary.md.tpl",
  "template/ai/templates/README.md.tpl",
  "template/ai/templates/task-brief-template.md.tpl",
  "template/ai/specs/README.md.tpl",
  "template/ai/skills/README.md.tpl",
  "template/ai/skills/review-architecture.md.tpl",
  "template/ai/skills/review-security.md.tpl",
  "template/ai/skills/review-contract-drift.md.tpl",
  "template/ai/skills/review-governance-drift.md.tpl",
  "template/ai/plans/README.md.tpl",
  "template/ai/plans/tech-debt.md.tpl",
  "template/scripts/validate-governance.mjs.tpl",
  "template/scripts/check-template-governance.mjs.tpl",
  "template/scripts/bootstrap-workspace.mjs.tpl",
  "template/scripts/check-workspace.mjs.tpl"
];

const errors = [];
for (const relativePath of requiredFiles) {
  if (!(await exists(path.join(repoRoot, relativePath)))) {
    errors.push(`missing ${relativePath}`);
  }
}

failIfErrors("Template file check", errors);
