#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inputFile, validateBrief, report } from "./lib/brief-validation.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const issueTemplatePath = "ai/templates/issue-template.md";
const issueFixtureDirectory = "ai/templates/fixtures/issues";
const issueFixtureFileExtension = ".md";
const invalidFixturePrefix = "invalid-";
const canonicalRepos = new Set(["{{HARNESS_REPO_NAME}}", ...{{CONSUMER_REPO_NAMES_JSON}}]);

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function validateIssueFile(file, content, options) {
  return validateBrief(file, content, { ...options, kind: "issue", canonicalRepos });
}

async function fixtureFiles() {
  const dir = path.join(repoRoot, issueFixtureDirectory);
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(issueFixtureFileExtension)).map((entry) => `${issueFixtureDirectory}/${entry.name}`);
}

const errors = [];
try {
  const file = inputFile(process.argv.slice(2));
  if (file) {
    errors.push(...validateIssueFile(file, await readFile(path.resolve(file), "utf8"), { allowPlaceholders: false }));
  } else if ({{HARNESS_PROFILE_JSON}} === "focused") {
    console.log("Issue starter templates are not included in the focused profile; use --file <path>.");
  } else {
    errors.push(...validateIssueFile(issueTemplatePath, await read(issueTemplatePath), { allowPlaceholders: true }));
    for (const fixture of await fixtureFiles()) {
      const fixtureErrors = validateIssueFile(fixture, await read(fixture), { allowPlaceholders: false });
      const shouldFail = path.basename(fixture).startsWith(invalidFixturePrefix);
      if (shouldFail && fixtureErrors.length === 0) errors.push(`${fixture} was expected to fail but passed.`);
      if (!shouldFail && fixtureErrors.length > 0) errors.push(`${fixture} was expected to pass but failed: ${fixtureErrors.join("; ")}`);
    }
  }
} catch (error) {
  errors.push(error.message);
}
report("Issue template check", errors);
