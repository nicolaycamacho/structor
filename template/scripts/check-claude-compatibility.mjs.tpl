#!/usr/bin/env node

import { readFile, readdir, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requiredClaudeCompatibilityFiles } from "./generated-harness-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const claudeRulesEnabled = {{CLIENT_CLAUDE_RULES_ENABLED}};
const claudeHooksEnabled = {{CLIENT_CLAUDE_HOOKS_ENABLED}};
const claudeSkillsEnabled = {{CLIENT_CLAUDE_SKILLS_ENABLED}};
const settings = {
  models: { openai: false, anthropic: true },
  clientSupport: {
    claudeRules: claudeRulesEnabled,
    claudeHooks: claudeHooksEnabled,
    claudeSkills: claudeSkillsEnabled,
  },
};
const requiredFiles = requiredClaudeCompatibilityFiles(settings);

async function exists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await read(relativePath));
}

async function listMarkdownFiles(relativeRoot) {
  const absoluteRoot = path.join(repoRoot, relativeRoot);
  const files = [];
  async function walk(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentPath, entry.name);
      const relative = path.relative(repoRoot, absolute).replaceAll(path.sep, "/");
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(relative);
    }
  }
  if (await exists(relativeRoot)) await walk(absoluteRoot);
  return files;
}

function requireIncludes(content, needle, label, errors) {
  if (!content.includes(needle)) errors.push(`${label} must include '${needle}'.`);
}

const errors = [];
for (const relativePath of requiredFiles) {
  if (!(await exists(relativePath))) errors.push(`${relativePath} is required for Claude Code compatibility.`);
}

if (errors.length === 0) {
  const rootClaude = await read("CLAUDE.md");
  requireIncludes(rootClaude, "Claude Code", "CLAUDE.md", errors);
  requireIncludes(rootClaude, "./ai/AGENTS.md", "CLAUDE.md", errors);
  requireIncludes(rootClaude, "./ai/HUB.md", "CLAUDE.md", errors);
  if (/^\s*1\.\s+`\.\/AGENTS\.md`/m.test(rootClaude)) {
    errors.push("CLAUDE.md must not require Claude Code to start from AGENTS.md.");
  }

  const claudeProject = await read(".claude/CLAUDE.md");
  requireIncludes(claudeProject, "root `CLAUDE.md`", ".claude/CLAUDE.md", errors);

  const settings = await readJson(".claude/settings.json");
  if (!settings.permissions || !Array.isArray(settings.permissions.deny)) {
    errors.push(".claude/settings.json must define permissions.deny.");
  }
  for (const denyPattern of ["Read(./.agent.env)", "Read(./.env)", "Read(./.env.*)"]) {
    if (!settings.permissions?.deny?.includes(denyPattern)) {
      errors.push(`.claude/settings.json permissions.deny must include ${denyPattern}.`);
    }
  }
  if (!claudeHooksEnabled && Object.hasOwn(settings, "hooks")) {
    errors.push(".claude/settings.json must not configure Claude hooks unless clientSupport.claude.hooks is enabled.");
  }

  if (claudeRulesEnabled) {
    const rule = await read(".claude/rules/harness-client-surfaces.md");
    for (const token of ["paths:", "AGENTS.md", "CLAUDE.md", ".claude/**", "ai/model-overlays/**"]) {
      requireIncludes(rule, token, ".claude/rules/harness-client-surfaces.md", errors);
    }
  }

  if (claudeSkillsEnabled) {
    const skillFiles = await listMarkdownFiles(".claude/skills");
    const skillRoots = new Set(skillFiles.map((file) => file.match(/^\.claude\/skills\/([^/]+)\//)?.[1]).filter(Boolean));
    for (const skillName of skillRoots) {
      if (!skillFiles.includes(`.claude/skills/${skillName}/SKILL.md`)) {
        errors.push(`.claude/skills/${skillName}/SKILL.md is required for committed Claude skill directories.`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Claude compatibility check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Claude compatibility check passed.");
console.log("Supported Claude Code surface:");
console.log("- CLAUDE.md");
console.log("- .claude/CLAUDE.md");
console.log("- .claude/settings.json");
if (claudeRulesEnabled) console.log("- .claude/rules/harness-client-surfaces.md");
if (!claudeHooksEnabled) console.log("Deferred Claude Code surface: .claude/hooks/**");
if (!claudeSkillsEnabled) console.log("Deferred Claude Code surface: .claude/skills/**");
