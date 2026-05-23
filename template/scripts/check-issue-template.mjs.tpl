#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = "ai/templates/issue-template.md";
const validStatuses = new Set(["Backlog", "Ready for Agent", "Running", "Needs Fix", "Report Ready", "PR Ready", "Human Review", "Blocked", "Done"]);
const validRisk = new Set(["low", "medium", "high"]);
const validAutonomy = new Set(["report_only", "pr_ready", "auto_merge"]);
const validModelPolicy = new Set(["cheap", "standard", "reasoning", "frontier", "review_only"]);
const canonicalRepos = new Set(["{{HARNESS_REPO_NAME}}", ...{{CONSUMER_REPO_NAMES_JSON}}]);
const requiredKeys = ["id", "status", "risk", "autonomy", "model_policy", "repos", "allowed_paths", "forbidden_paths", "requires_human_approval"];
const requiredSections = [
  "Summary",
  "Context",
  "Goals",
  "Non-Goals",
  "Scope",
  "Path Contract",
  "Requirements",
  "Bootstrap Requirements",
  "Proposed Approach",
  "Agent Execution Protocol",
  "Success Criteria",
  "Validation",
  "Validation Evidence Required",
  "Risk and Autonomy",
  "Review Routing",
  "Dependencies",
  "Rollback / Recovery",
  "Open Questions",
  "Notes for the Agent",
];
const placeholderPattern = /<[^>]+>/;
const protectedSurfacePattern = /\b(auth|authentication|authorization|billing|subscription|payment|secret|environment variable|infrastructure|deployment|database migration|production data|tenant|quota|rate limit|shared contract)\b/i;

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function parseScalar(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const result = {};
  let currentKey = null;
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const keyValue = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (keyValue) {
      currentKey = keyValue[1];
      result[currentKey] = keyValue[2] === "" ? [] : parseScalar(keyValue[2]);
      continue;
    }
    const listItem = line.match(/^\s*-\s+(.+)$/);
    if (listItem && currentKey) {
      if (!Array.isArray(result[currentKey])) result[currentKey] = [];
      result[currentKey].push(parseScalar(listItem[1]));
    }
  }
  return result;
}

function hasSection(content, section) {
  return new RegExp(`^## ${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(content);
}

function valuesFor(value) {
  return Array.isArray(value) ? value : [value];
}

function validateIssueFile(relativePath, content, { allowPlaceholders }) {
  const errors = [];
  const frontMatter = parseFrontMatter(content);
  if (!frontMatter) return [`${relativePath} must start with YAML front matter.`];

  for (const key of requiredKeys) {
    if (!(key in frontMatter)) errors.push(`${relativePath} is missing front matter key '${key}'.`);
  }
  if (!allowPlaceholders && placeholderPattern.test(content)) {
    errors.push(`${relativePath} contains placeholder text.`);
  }
  if (!placeholderPattern.test(String(frontMatter.status)) && !validStatuses.has(frontMatter.status)) {
    errors.push(`${relativePath} has invalid status '${frontMatter.status}'.`);
  }
  if (!placeholderPattern.test(String(frontMatter.risk)) && !validRisk.has(frontMatter.risk)) {
    errors.push(`${relativePath} has invalid risk '${frontMatter.risk}'.`);
  }
  if (!placeholderPattern.test(String(frontMatter.autonomy)) && !validAutonomy.has(frontMatter.autonomy)) {
    errors.push(`${relativePath} has invalid autonomy '${frontMatter.autonomy}'.`);
  }
  if (!placeholderPattern.test(String(frontMatter.model_policy)) && !validModelPolicy.has(frontMatter.model_policy)) {
    errors.push(`${relativePath} has invalid model_policy '${frontMatter.model_policy}'.`);
  }
  for (const repo of frontMatter.repos ?? []) {
    if (!placeholderPattern.test(String(repo)) && !canonicalRepos.has(repo)) {
      errors.push(`${relativePath} references non-canonical repo '${repo}'.`);
    }
  }
  for (const key of ["allowed_paths", "forbidden_paths"]) {
    if (!Array.isArray(frontMatter[key]) || frontMatter[key].length === 0) {
      errors.push(`${relativePath} front matter key '${key}' must contain at least one path.`);
    }
  }
  if (frontMatter.risk === "high" && frontMatter.autonomy === "auto_merge") {
    errors.push(`${relativePath} has risk: high with autonomy: auto_merge.`);
  }
  if ("requires_human_approval" in frontMatter && typeof frontMatter.requires_human_approval !== "boolean") {
    errors.push(`${relativePath} requires_human_approval must be boolean.`);
  }
  for (const section of requiredSections) {
    if (!hasSection(content, section)) errors.push(`${relativePath} is missing required section '${section}'.`);
  }
  if (!/protected surface|protected surfaces/i.test(content)) {
    errors.push(`${relativePath} must mention protected surfaces.`);
  }
  if (!/auto_merge.*future-facing|future-facing.*auto_merge/i.test(content)) {
    errors.push(`${relativePath} must state that auto_merge is future-facing metadata.`);
  }
  if (!allowPlaceholders && !/`[^`]+`/.test(content.match(/^## Validation\s*\n([\s\S]*?)(?=^## |$)/m)?.[1] ?? "")) {
    errors.push(`${relativePath} Validation section must include a concrete command in backticks.`);
  }
  if (!allowPlaceholders && protectedSurfacePattern.test(content) && frontMatter.requires_human_approval !== true) {
    errors.push(`${relativePath} touches protected surfaces but requires_human_approval is not true.`);
  }

  return errors;
}

async function fixtureFiles() {
  const dir = path.join(repoRoot, "ai/templates/fixtures/issues");
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => `ai/templates/fixtures/issues/${entry.name}`);
}

const errors = [];
errors.push(...validateIssueFile(templatePath, await read(templatePath), { allowPlaceholders: true }));
for (const fixture of await fixtureFiles()) {
  const fixtureErrors = validateIssueFile(fixture, await read(fixture), { allowPlaceholders: false });
  const shouldFail = path.basename(fixture).startsWith("invalid-");
  if (shouldFail && fixtureErrors.length === 0) errors.push(`${fixture} was expected to fail but passed.`);
  if (!shouldFail && fixtureErrors.length > 0) errors.push(`${fixture} was expected to pass but failed: ${fixtureErrors.join("; ")}`);
}

if (errors.length > 0) {
  console.error("Issue template check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Issue template check passed.");
