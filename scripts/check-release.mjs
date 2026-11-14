#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

// Metadata checks also work in source archives; tag checks require a full Git clone.
export async function checkRelease(root, { tag = null } = {}) {
  const errors = [];
  const readJson = async (name) => {
    try {
      return JSON.parse(await readFile(path.join(root, name), "utf8"));
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
      return null;
    }
  };
  const pkg = await readJson("package.json");
  const lock = await readJson("package-lock.json");
  const version = pkg?.version;
  if (typeof version !== "string" || !stableVersion.test(version)) {
    errors.push("package.json must declare a stable X.Y.Z version.");
  }
  if (!lock || lock.version !== version || lock.packages?.[""]?.version !== version) {
    errors.push("package-lock.json root versions must match package.json.");
  }
  try {
    const changelog = await readFile(path.join(root, "CHANGELOG.md"), "utf8");
    const sections = [...changelog.matchAll(/^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
    const entries = sections.filter((entry) => entry[1] === version);
    if (entries.length !== 1 || !entries[0][3].trim()) {
      errors.push(`CHANGELOG.md must contain exactly one nonempty dated entry for ${version}.`);
    }
  } catch (error) {
    errors.push(`CHANGELOG.md: ${error.message}`);
  }
  if (tag !== null) {
    if (typeof tag !== "string" || !tag.startsWith("v") || !stableVersion.test(tag.slice(1))) {
      errors.push("Release tag must have the stable vX.Y.Z form.");
    } else if (tag !== `v${version}`) {
      errors.push(`Tag ${tag} does not match package.json version ${version}.`);
    }
    const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    try {
      if (path.resolve(git("rev-parse", "--show-toplevel")) !== path.resolve(root)) {
        throw new Error("release root must be the Git checkout root");
      }
      if (git("status", "--porcelain", "--untracked-files=all")) {
        errors.push("Release checkout must be clean, including untracked files.");
      }
      // Resolve only an exact tag ref, never a similarly named branch or revision expression.
      const ref = `refs/tags/${tag}`;
      if (git("cat-file", "-t", ref) !== "tag") {
        errors.push(`Release ${tag} must be an annotated tag.`);
      }
      const commit = git("rev-parse", "--verify", `${ref}^{commit}`);
      if (commit !== git("rev-parse", "HEAD")) {
        errors.push(`Checkout HEAD must equal the commit for ${tag}.`);
      }
      git("rev-parse", "--verify", "refs/remotes/origin/main^{commit}");
      try {
        git("merge-base", "--is-ancestor", commit, "refs/remotes/origin/main");
      } catch {
        errors.push(`Release ${tag} must be reachable from origin/main.`);
      }
    } catch (error) {
      errors.push(`Release Git verification failed (fetch tags and origin/main): ${error.stderr?.toString().trim() || error.message}`);
    }
  }
  return { version, tag, errors };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--tag" || !args[1])) {
    throw new Error("Usage: node scripts/check-release.mjs [--tag vX.Y.Z]");
  }
  const tag = args[1] ?? (process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : null);
  if (process.env.GITHUB_REF_TYPE === "tag" && !tag) throw new Error("Tag build is missing GITHUB_REF_NAME.");
  const result = await checkRelease(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), { tag });
  if (result.errors.length) {
    console.error(`Release check failed:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(`Release check passed: ${tag ?? result.version} (${tag ? "annotated tag, main ancestry, clean checkout, metadata" : "version, lockfile, changelog"}).`);
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
