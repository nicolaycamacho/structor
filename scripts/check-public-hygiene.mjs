#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { exists, failIfErrors, repoRoot } from "./lib.mjs";

const errors = [];

const skippedDirectories = new Set([
  ".git",
  ".cache",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "tmp",
  "temp",
]);

const scannedExtensions = new Set([
  ".cjs",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sh",
  ".tpl",
  ".txt",
  ".yaml",
  ".yml",
]);

const allowedRepositoryUrls = new Set([
  "https://github.com/nicolaycamacho/structor",
  "https://github.com/nicolaycamacho/structor.git",
  "git+https://github.com/nicolaycamacho/structor.git",
]);

const forbiddenProjectTermsEnvVar = "HARNESS_FORBIDDEN_PROJECT_TERMS";
const configuredForbiddenProjectTerms = (process.env[forbiddenProjectTermsEnvVar] ?? "")
  .split(",")
  .map((term) => term.trim())
  .filter(Boolean);

const forbiddenProjectTermPatterns = [...new Set(configuredForbiddenProjectTerms)]
  .map((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i"));

await checkCommittedGeneratedOutput();

const activeFiles = await collectPublicFiles(".");
for (const relativePath of activeFiles) {
  const content = await readFile(path.join(repoRoot, relativePath), "utf8");
  checkContent(relativePath, content);
}

failIfErrors("Public hygiene check", errors);

async function checkCommittedGeneratedOutput() {
  const generatedRoot = path.join(repoRoot, "generated");
  if (await exists(generatedRoot)) {
    errors.push("generated/ exists; generated harness output must not be committed.");
  }

  const entries = await readdir(repoRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (skippedDirectories.has(entry.name)) continue;

    const manifestPath = path.join(repoRoot, entry.name, ".structor", "manifest.json");
    if (await exists(manifestPath)) {
      errors.push(`${entry.name}/ looks like generated harness output and must not be committed.`);
    }
  }
}

function shouldScanFile(relativePath) {
  if (relativePath === "scripts/check-public-hygiene.mjs") {
    return false;
  }
  if (relativePath === "package-lock.json") {
    return false;
  }
  return scannedExtensions.has(path.extname(relativePath));
}

async function collectPublicFiles(baseRelativePath) {
  const files = [];

  async function walk(currentRelativePath) {
    const currentAbsolutePath = path.join(repoRoot, currentRelativePath);
    const entries = await readdir(currentAbsolutePath, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = path.posix.join(currentRelativePath, entry.name).replace(/^\.\//, "");
      if (entry.isDirectory()) {
        if (!skippedDirectories.has(entry.name)) {
          await walk(relativePath);
        }
      } else if (entry.isFile() && shouldScanFile(relativePath)) {
        files.push(relativePath);
      }
    }
  }

  await walk(baseRelativePath);
  return files.sort();
}

function checkContent(relativePath, content) {
  const hasPersonalPath =
    /\/Users\/[^/\s]+/.test(content) ||
    /\/home\/[^/\s]+/.test(content) ||
    /[A-Za-z]:\\Users\\[^\\\s]+/.test(content);
  if (hasPersonalPath) {
    errors.push(`${relativePath} contains an obvious local personal path.`);
  }

  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(content)) {
    errors.push(`${relativePath} contains an email address.`);
  }

  for (const repoUrl of findRepositoryUrls(content)) {
    if (allowedRepositoryUrls.has(repoUrl)) continue;
    if (isPrivateLookingRepositoryUrl(repoUrl)) {
      errors.push(`${relativePath} contains a private-looking repository URL: ${repoUrl}`);
    }
  }

  for (const pattern of forbiddenProjectTermPatterns) {
    if (pattern.test(content)) {
      errors.push(`${relativePath} contains a configured forbidden project term.`);
      break;
    }
  }
}

function findRepositoryUrls(content) {
  const urls = new Set();
  const patterns = [
    /\b(?:git\+)?https:\/\/(?:github|gitlab|bitbucket)\.[^\s`'")<>]+\/[^\s`'")<>]+\/[^\s`'")<>]+/gi,
    /\bgit@(?:github|gitlab|bitbucket)\.[^:\s]+:[^\s`'")<>]+\/[^\s`'")<>]+/gi,
    /\bssh:\/\/git@(?:github|gitlab|bitbucket)\.[^\s`'")<>]+\/[^\s`'")<>]+\/[^\s`'")<>]+/gi,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      urls.add(match[0].replace(/[.,;:]+$/, ""));
    }
  }

  return urls;
}

function isPrivateLookingRepositoryUrl(repoUrl) {
  if (/^git@/i.test(repoUrl) || /^ssh:\/\//i.test(repoUrl)) return true;
  if (/\b(internal|private|proprietary|confidential)\b/i.test(repoUrl)) return true;
  if (!isAllowedPublicRepositoryUrl(repoUrl)) {
    return true;
  }
  return false;
}

function isAllowedPublicRepositoryUrl(repoUrl) {
  const normalizedRepoUrl = repoUrl.replace(/^git\+/i, "");
  let url;
  try {
    url = new URL(normalizedRepoUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" || url.hostname !== "github.com") return false;

  const segments = url.pathname.split("/").filter(Boolean);
  const [owner, repo] = segments;
  const normalizedRepo = repo?.replace(/\.git$/i, "");
  return owner === "nicolaycamacho" && normalizedRepo === "structor";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
