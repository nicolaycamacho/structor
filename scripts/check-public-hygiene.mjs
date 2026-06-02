#!/usr/bin/env node

import { readdir, readFile, stat } from "node:fs/promises";
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

// Hygiene scanning is deny-list based: every publishable file is scanned for
// secrets unless its extension is known-binary. An allow-list of extensions
// silently skipped extensionless files (e.g. `prod-private-key`) that npm pack
// would still publish, so we invert the check.
const binaryExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".bmp",
  ".tiff",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".zip",
  ".gz",
  ".tgz",
  ".tar",
  ".bz2",
  ".xz",
  ".7z",
  ".rar",
  ".jar",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".wav",
  ".webm",
  ".wasm",
  ".node",
  ".bin",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".class",
]);

// Patterns for high-confidence secret material that must never be published.
const secretPatterns = [
  {
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/,
    description: "a private key block",
  },
  { pattern: /\bsk_live_[A-Za-z0-9]{16,}/, description: "a Stripe live secret key" },
  { pattern: /\brk_live_[A-Za-z0-9]{16,}/, description: "a Stripe live restricted key" },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/, description: "an AWS access key id" },
  { pattern: /\bghp_[A-Za-z0-9]{36}\b/, description: "a GitHub personal access token" },
  { pattern: /\bgithub_pat_[A-Za-z0-9_]{40,}/, description: "a GitHub fine-grained token" },
  { pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/, description: "a Slack token" },
  { pattern: /\bAIza[0-9A-Za-z_-]{35}\b/, description: "a Google API key" },
  { pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, description: "a JWT" },
];

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

const activeFiles = await collectPublishableFiles();
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
  return !binaryExtensions.has(path.extname(relativePath).toLowerCase());
}

// Scan exactly the set of files npm would publish (the package.json `files`
// allow-list plus the always-included package.json), so extensionless secret
// files inside published directories are caught while local-only files such as
// `.git` or `*.local.json` are not falsely flagged.
async function collectPublishableFiles() {
  const pkg = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const entries = new Set(["package.json", ...(Array.isArray(pkg.files) ? pkg.files : [])]);
  const files = new Set();

  async function walk(currentRelativePath) {
    const dirEntries = await readdir(path.join(repoRoot, currentRelativePath), { withFileTypes: true });
    for (const entry of dirEntries) {
      const relativePath = path.posix.join(currentRelativePath, entry.name);
      if (entry.isDirectory()) {
        if (!skippedDirectories.has(entry.name)) await walk(relativePath);
      } else if (entry.isFile() && shouldScanFile(relativePath)) {
        files.add(relativePath);
      }
    }
  }

  for (const entry of entries) {
    const normalized = entry.replace(/\/+$/, "");
    const absolute = path.join(repoRoot, normalized);
    if (!(await exists(absolute))) continue;
    const stats = await stat(absolute);
    if (stats.isDirectory()) {
      await walk(normalized);
    } else if (shouldScanFile(normalized)) {
      files.add(normalized);
    }
  }

  return [...files].sort();
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

  for (const { pattern, description } of secretPatterns) {
    if (pattern.test(content)) {
      errors.push(`${relativePath} contains ${description}.`);
    }
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
