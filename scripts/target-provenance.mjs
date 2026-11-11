import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  extractHarnessReferences,
  resolveHarnessReferenceRoot,
  resolveHarnessReferenceTarget,
  validateHarnessReferences,
} from "./harness-routing.mjs";

const execFileAsync = promisify(execFile);

async function readGit(root, args) {
  const { stdout } = await execFileAsync("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "-C", root, ...args], {
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" },
    timeout: 10000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout.trim();
}

async function physicalPath(filePath) {
  return realpath(filePath).catch(() => null);
}

function withinRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function fingerprint(filePath, allowedRoot) {
  const root = await physicalPath(allowedRoot);
  const resolved = await physicalPath(filePath);
  if (!resolved || !root) return { path: filePath, physicalPath: resolved, sha256: null, status: "unavailable" };
  if (!withinRoot(root, resolved)) return { path: filePath, physicalPath: resolved, sha256: null, status: "unsafe" };
  try {
    if (!(await stat(resolved)).isFile()) throw new Error("Not a regular file.");
    const content = await readFile(filePath);
    return { path: filePath, physicalPath: resolved, sha256: createHash("sha256").update(content).digest("hex"), status: "available" };
  } catch {
    return { path: filePath, physicalPath: resolved, sha256: null, status: "unavailable" };
  }
}

function unavailableGit() {
  return { root: null, revision: null, branch: null, detached: null, upstream: null, upstreamRevision: null, relationship: "unavailable", ahead: null, behind: null, dirty: null, dirtyUnavailableReason: null, shallow: null, unavailableReason: "Git checkout evidence is unavailable." };
}

async function gitEvidence(root) {
  const evidence = unavailableGit();
  if (!root) return evidence;
  try {
    evidence.root = await physicalPath(await readGit(root, ["rev-parse", "--show-toplevel"]));
    // A non-Git project nested inside another repository must not inherit its evidence.
    if (evidence.root !== root) return unavailableGit();
    evidence.branch = await readGit(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]).catch(() => null);
    evidence.detached = evidence.branch === null;
    // Status can run clean/process filters, including those in submodules.
    // Keep partial Git evidence rather than executing checkout-defined code.
    evidence.dirtyUnavailableReason = "Dirty-state safety evidence is unavailable.";
    const configNames = (await readGit(root, ["config", "--null", "--list", "--name-only"])).split("\0");
    const indexEntries = await readGit(root, ["ls-files", "--stage"]);
    if (configNames.some((name) => /^filter\.[\s\S]*\.(clean|process)$/i.test(name))) {
      evidence.dirtyUnavailableReason = "Configured Git filters may mutate files; dirty state was not inspected.";
    } else if (/^160000 /m.test(indexEntries)) {
      evidence.dirtyUnavailableReason = "Submodule status may execute nested filters; dirty state was not inspected.";
    } else {
      evidence.dirty = (await readGit(root, ["status", "--porcelain=v1", "--untracked-files=all"])) !== "";
      evidence.dirtyUnavailableReason = null;
    }
    evidence.unavailableReason = "HEAD commit is unavailable.";
    evidence.revision = await readGit(root, ["rev-parse", "--verify", "HEAD^{commit}"]);
    evidence.shallow = (await readGit(root, ["rev-parse", "--is-shallow-repository"])) === "true";
    evidence.unavailableReason = evidence.detached ? "HEAD is detached; upstream evidence is unavailable." : "Configured upstream evidence is unavailable.";
    evidence.upstream = await readGit(root, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
    evidence.upstreamRevision = await readGit(root, ["rev-parse", "--verify", "@{upstream}^{commit}"]);
    evidence.unavailableReason = evidence.shallow ? "Git history is shallow; ancestry evidence is unavailable." : "Git ancestry evidence is unavailable.";
    if (evidence.shallow) return evidence;
    const counts = await readGit(root, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]);
    [evidence.ahead, evidence.behind] = counts.split(/\s+/).map(Number);
    evidence.relationship = evidence.ahead > 0 && evidence.behind > 0 ? "diverged"
      : evidence.ahead > 0 ? "ahead" : evidence.behind > 0 ? "behind" : "equal";
    evidence.unavailableReason = null;
  } catch {
    // Partial evidence (e.g. detached HEAD or no upstream) remains inspectable.
  }
  return evidence;
}

// Shared by Doctor and generated target checks. This module performs reads only.
export async function inspectTargetProvenance({ targetPath, harnessRoot, harnessRepoName, models, entrypoints, requireGitFreshness = false }) {
  const requestedPath = path.resolve(targetPath);
  const targetRoot = await physicalPath(requestedPath);
  const expectedRoot = await physicalPath(harnessRoot) ?? path.resolve(harnessRoot);
  const issues = [];
  const pointerFiles = [];
  const sourceRoots = new Set();
  const references = [];
  const guidancePaths = new Set();
  const isHarness = targetRoot === expectedRoot;
  if (!targetRoot || !(await stat(targetRoot)).isDirectory()) issues.push("Target checkout directory is unavailable.");

  for (const entrypoint of entrypoints) {
    const pointerPath = path.join(targetRoot ?? requestedPath, entrypoint.path);
    const file = await fingerprint(pointerPath, targetRoot ?? requestedPath);
    pointerFiles.push(file);
    if (file.status !== "available") {
      issues.push(`${entrypoint.path} fingerprint is ${file.status}.`);
      continue;
    }
    if (isHarness) continue;
    const pointerContent = await readFile(pointerPath, "utf8");
    const resolution = { basePath: targetRoot, harnessRepoName };
    const routingIssues = await validateHarnessReferences({ pointerPath: entrypoint.path, pointerContent, expectedHarnessRoot: expectedRoot, models, ...resolution });
    issues.push(...routingIssues.map((issue) => issue.message));
    for (const reference of extractHarnessReferences(pointerContent, harnessRepoName)) {
      const root = resolveHarnessReferenceRoot({ reference, ...resolution });
      const target = resolveHarnessReferenceTarget({ reference, ...resolution });
      const physicalRoot = await physicalPath(root);
      references.push({ pointerPath, reference, declaredRoot: root, root: physicalRoot, target, physicalTarget: await physicalPath(target) });
      if (physicalRoot) sourceRoots.add(physicalRoot);
      guidancePaths.add(target);
    }
  }
  if (isHarness) sourceRoots.add(targetRoot);
  const roots = [...sourceRoots].sort();
  const actualRoot = roots.length === 1 ? roots[0] : null;
  if (!actualRoot) issues.push("A single harness source root could not be resolved.");
  if (actualRoot) {
    for (const relativePath of ["ai/AGENTS.md", "ai/HUB.md", "ai/context.md"]) guidancePaths.add(path.join(actualRoot, relativePath));
  }
  const guidance = [];
  for (const filePath of [...guidancePaths].sort()) {
    const file = await fingerprint(filePath, expectedRoot);
    guidance.push(file);
    if (file.status !== "available") issues.push(`Guidance fingerprint is ${file.status}: ${filePath}`);
  }
  const targetGit = await gitEvidence(targetRoot);
  const harnessGit = await gitEvidence(actualRoot);
  const ready = [targetGit, harnessGit].every((git) => ["equal", "ahead"].includes(git.relationship) && git.dirty === false);
  if (requireGitFreshness) {
    for (const [label, git] of [["Target", targetGit], ["Harness", harnessGit]]) {
      if (!["equal", "ahead"].includes(git.relationship)) issues.push(`Git freshness gate: ${label} upstream relationship is ${git.relationship}; clean equal/ahead cached evidence is required.`);
      if (git.dirty !== false) issues.push(`Git freshness gate: ${label} dirty state is ${git.dirty ?? "unavailable"}.`);
    }
  }
  return {
    target: { requestedPath, root: targetRoot, git: targetGit },
    harness: { expectedRoot, root: actualRoot, roots, references, git: harnessGit },
    entrypoints: pointerFiles,
    guidance,
    freshness: { required: requireGitFreshness, refs: "cached", live: "unavailable", ready },
    issues,
    valid: issues.length === 0,
  };
}

export function formatTargetProvenance(report) {
  const lines = [
    `Target root: ${report.target.root ?? "unavailable"}`,
    `Harness root: ${report.harness.root ?? "unavailable"} (expected ${report.harness.expectedRoot})`,
    "Git upstream refs are cached; live freshness is unavailable. No fetch was performed.",
    `Cached Git freshness gate: ${report.freshness.required ? "required" : "optional"}; ready=${report.freshness.ready}`,
  ];
  if (report.harness.roots.length > 1) lines.push(`Referenced harness roots: ${report.harness.roots.join(", ")}`);
  for (const [label, source] of [["Target", report.target], ["Harness", report.harness]]) {
    const git = source.git;
    lines.push(`${label} Git: root=${git.root ?? "unavailable"} revision=${git.revision ?? "unavailable"} branch=${git.branch ?? (git.detached ? "detached" : "unavailable")} upstream=${git.upstream ?? "unavailable"} upstream-revision=${git.upstreamRevision ?? "unavailable"} relationship=${git.relationship} ahead=${git.ahead ?? "unavailable"} behind=${git.behind ?? "unavailable"} dirty=${git.dirty ?? "unavailable"}`);
    if (git.unavailableReason) lines.push(`${label} Git uncertainty: ${git.unavailableReason}`);
    if (git.dirtyUnavailableReason) lines.push(`${label} Git dirty-state uncertainty: ${git.dirtyUnavailableReason}`);
  }
  for (const file of [...report.entrypoints, ...report.guidance]) lines.push(`${file.path}: sha256=${file.sha256 ?? file.status} physical=${file.physicalPath ?? "unavailable"}`);
  for (const issue of report.issues) lines.push(`- ${issue}`);
  return lines.join("\n");
}
