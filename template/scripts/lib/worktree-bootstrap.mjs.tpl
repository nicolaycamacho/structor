import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const canonicalRepos = ["{{HARNESS_REPO_NAME}}", ...{{CONSUMER_REPO_NAMES_JSON}}];
export const requiredPointerFiles = ["AGENTS.md", "CLAUDE.md"];
export const optionalPointerFiles = [".codex/hooks.json"];

const repairableStates = new Set(["missing", "stale_relative", "wrong_harness_root"]);

export async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function repoNameFromRemote(remoteUrl) {
  if (!remoteUrl) return null;
  const withoutGitSuffix = remoteUrl.trim().replace(/\.git$/, "");
  return withoutGitSuffix.match(/[:/]([^/:]+)$/)?.[1] ?? null;
}

export function canonicalRepoNameFromInput({ targetPath, gitRoot, remoteUrl }) {
  const candidates = [repoNameFromRemote(remoteUrl), gitRoot ? path.basename(gitRoot) : null, targetPath ? path.basename(targetPath) : null].filter(Boolean);
  return candidates.find((candidate) => canonicalRepos.includes(candidate)) ?? null;
}

export async function gitMetadataForPath(targetPath) {
  try {
    const { stdout: gitRootOutput } = await execFileAsync("git", ["-C", targetPath, "rev-parse", "--show-toplevel"]);
    const gitRoot = gitRootOutput.trim();
    let remoteUrl = "";
    try {
      const { stdout } = await execFileAsync("git", ["-C", gitRoot, "remote", "get-url", "origin"]);
      remoteUrl = stdout.trim();
    } catch {
      remoteUrl = "";
    }
    return { gitRoot, remoteUrl };
  } catch {
    return { gitRoot: null, remoteUrl: "" };
  }
}

function cleanReference(rawReference) {
  return rawReference.trim().replace(/^[`'"]+/, "").replace(/[`'",;:.)\]}]+$/, "");
}

export function extractHarnessReferences(content) {
  const escapedName = "{{HARNESS_REPO_NAME}}".replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp("(?:\\.\\.?/|/)[^`'\"\\s)<\\]}]*(?:" + escapedName + ")[^`'\"\\s)<\\]}]*", "g");
  return [...new Set((content.match(pattern) ?? []).map(cleanReference).filter(Boolean))];
}

function harnessRootFromReference(rawReference, targetPath) {
  const reference = cleanReference(rawReference);
  const absoluteReference = path.isAbsolute(reference) ? path.resolve(reference) : path.resolve(targetPath, reference);
  const parts = absoluteReference.split(path.sep);
  const index = parts.lastIndexOf("{{HARNESS_REPO_NAME}}");
  if (index === -1) return null;
  const rootParts = parts.slice(0, index + 1);
  return rootParts.join(path.sep) || path.sep;
}

function referenceMatchesHarnessRoot(rawReference, targetPath, harnessRoot) {
  const referenceRoot = harnessRootFromReference(rawReference, targetPath);
  return referenceRoot !== null && path.resolve(referenceRoot) === path.resolve(harnessRoot);
}

function classifyPointerContent({ relativePath, content, targetPath, harnessRoot }) {
  const references = extractHarnessReferences(content);
  if (references.length === 0) {
    return { kind: "missing", relativePath, message: `${relativePath} does not contain a resolvable {{HARNESS_REPO_NAME}} path.` };
  }
  if (references.some((reference) => referenceMatchesHarnessRoot(reference, targetPath, harnessRoot))) return null;
  if (references.some((reference) => !path.isAbsolute(reference))) {
    return { kind: "stale_relative", relativePath, references, message: `${relativePath} uses relative harness paths that do not resolve to ${harnessRoot}.` };
  }
  return { kind: "wrong_harness_root", relativePath, references, message: `${relativePath} points at a different {{HARNESS_REPO_NAME}} checkout.` };
}

function stateFromIssues(issues) {
  if (issues.some((issue) => issue.kind === "missing")) return "missing";
  if (issues.some((issue) => issue.kind === "stale_relative")) return "stale_relative";
  return "wrong_harness_root";
}

export function classifyWorktreeBootstrap({ targetPath, targetExists = true, harnessRoot, repoName, files, worktreeRecord = {} }) {
  const resolvedTargetPath = targetPath ? path.resolve(targetPath) : "";
  if (worktreeRecord.prunable) {
    return { state: "prunable", valid: false, repairable: false, repoName: repoName ?? "unknown", targetPath: resolvedTargetPath, issues: [{ kind: "prunable", message: worktreeRecord.prunableReason ?? "Git reports this worktree as prunable." }] };
  }
  if (!targetExists) {
    return { state: "missing_path", valid: false, repairable: false, repoName: repoName ?? "unknown", targetPath: resolvedTargetPath, issues: [{ kind: "missing_path", message: "Target path does not exist." }] };
  }
  if (!repoName || !canonicalRepos.includes(repoName)) {
    return { state: "unsupported_repo", valid: false, repairable: false, repoName: repoName ?? "unknown", targetPath: resolvedTargetPath, issues: [{ kind: "unsupported_repo", message: "Target is not a canonical repo for this harness." }] };
  }

  const byPath = new Map(files.map((file) => [file.relativePath, file]));
  const issues = [];
  for (const relativePath of requiredPointerFiles) {
    const file = byPath.get(relativePath);
    if (!file?.exists) {
      issues.push({ kind: "missing", relativePath, required: true, message: `${relativePath} is missing.` });
      continue;
    }
    if (repoName === "{{HARNESS_REPO_NAME}}") continue;
    const issue = classifyPointerContent({ relativePath, content: file.content, targetPath: resolvedTargetPath, harnessRoot });
    if (issue) issues.push({ ...issue, required: true });
  }
  for (const relativePath of optionalPointerFiles) {
    const file = byPath.get(relativePath);
    if (!file?.exists || repoName === "{{HARNESS_REPO_NAME}}") continue;
    const issue = classifyPointerContent({ relativePath, content: file.content, targetPath: resolvedTargetPath, harnessRoot });
    if (issue) issues.push({ ...issue, required: false });
  }
  if (issues.length === 0) {
    return { state: worktreeRecord.detached ? "detached" : "valid", valid: true, repairable: false, repoName, targetPath: resolvedTargetPath, issues: [] };
  }
  const state = stateFromIssues(issues);
  const requiredIssues = issues.filter((issue) => issue.required);
  const optionalIssues = issues.filter((issue) => !issue.required);
  return { state, valid: false, repairable: requiredIssues.length > 0 && optionalIssues.length === 0 && repairableStates.has(state), repoName, targetPath: resolvedTargetPath, issues };
}

export async function readPointerFiles(targetPath) {
  const files = [];
  for (const relativePath of [...requiredPointerFiles, ...optionalPointerFiles]) {
    const filePath = path.join(targetPath, relativePath);
    if (!(await exists(filePath))) {
      files.push({ relativePath, exists: false, content: "" });
    } else {
      files.push({ relativePath, exists: true, content: await readFile(filePath, "utf8") });
    }
  }
  return files;
}

export async function inspectCheckout({ targetPath, harnessRoot, worktreeRecord = {} }) {
  const resolvedTargetPath = path.resolve(targetPath);
  const targetExists = await exists(resolvedTargetPath);
  const metadata = targetExists && !worktreeRecord.prunable ? await gitMetadataForPath(resolvedTargetPath) : { gitRoot: null, remoteUrl: "" };
  const repoName = canonicalRepoNameFromInput({ targetPath: resolvedTargetPath, gitRoot: metadata.gitRoot, remoteUrl: metadata.remoteUrl });
  const files = targetExists && !worktreeRecord.prunable ? await readPointerFiles(resolvedTargetPath) : [];
  return classifyWorktreeBootstrap({ targetPath: resolvedTargetPath, targetExists, harnessRoot, repoName, files, worktreeRecord });
}

export function renderPointerFile({ relativePath, harnessRoot, repoName }) {
  const normalizedHarnessRoot = path.resolve(harnessRoot);
  const bootstrapCommand = `node ${path.join(normalizedHarnessRoot, "scripts/bootstrap-codex-worktree.mjs")} <checkout-path>`;
  const title = relativePath === "CLAUDE.md" ? "Project Agent Guide" : "Agent Bootstrap";
  return `# ${title}

This checkout is part of the {{PROJECT_NAME}} workspace.
The canonical AI guidance lives in the harness repo.

Canonical repo: \`${repoName}\`

Read before changing files:

1. \`${path.join(normalizedHarnessRoot, "AGENTS.md")}\`
2. \`${path.join(normalizedHarnessRoot, "CLAUDE.md")}\`
3. \`${path.join(normalizedHarnessRoot, "ai/AGENTS.md")}\`
4. \`${path.join(normalizedHarnessRoot, "ai/HUB.md")}\`
5. \`${path.join(normalizedHarnessRoot, "ai/context.md")}\`

Regenerate this pointer with:

\`\`\`bash
${bootstrapCommand}
\`\`\`
`;
}

export function buildRepairPlan({ inspection, harnessRoot }) {
  if (!inspection.repairable) {
    return { repairable: false, writes: [], reason: inspection.issues.map((issue) => issue.message).join(" ") };
  }
  const affectedRequiredPaths = new Set(inspection.issues.filter((issue) => issue.required).map((issue) => issue.relativePath));
  const writes = [...affectedRequiredPaths].map((relativePath) => ({
    relativePath,
    targetPath: path.join(inspection.targetPath, relativePath),
    content: renderPointerFile({ relativePath, harnessRoot, repoName: inspection.repoName }),
  }));
  return { repairable: true, writes, reason: "" };
}

export async function writeRepairPlan(repairPlan) {
  for (const write of repairPlan.writes) {
    await mkdir(path.dirname(write.targetPath), { recursive: true });
    await writeFile(write.targetPath, write.content);
  }
}

export function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

export function repairCommand({ harnessRoot, targetPath }) {
  return `node ${shellQuote(path.join(harnessRoot, "scripts/bootstrap-codex-worktree.mjs"))} ${shellQuote(targetPath)}`;
}

export function parseWorktreeListPorcelain(output) {
  const records = [];
  let current = null;
  function pushCurrent() {
    if (current) records.push(current);
    current = null;
  }
  for (const line of output.split(/\r?\n/)) {
    if (line.trim() === "") {
      pushCurrent();
    } else if (line.startsWith("worktree ")) {
      pushCurrent();
      current = { path: line.slice("worktree ".length), detached: false, prunable: false };
    } else if (current && line.startsWith("HEAD ")) {
      current.head = line.slice("HEAD ".length);
    } else if (current && line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length);
    } else if (current && line === "detached") {
      current.detached = true;
    } else if (current && line.startsWith("prunable")) {
      current.prunable = true;
      current.prunableReason = line.slice("prunable".length).trim();
    }
  }
  pushCurrent();
  return records;
}

export async function listGitWorktrees(repoPath) {
  const { stdout } = await execFileAsync("git", ["-C", repoPath, "worktree", "list", "--porcelain"]);
  return parseWorktreeListPorcelain(stdout);
}

export function formatInspection(inspection, { harnessRoot } = {}) {
  const suffix = inspection.valid ? "" : ` repair=${inspection.repairable ? "available" : "manual"}`;
  const lines = [`${inspection.state} ${inspection.repoName} ${inspection.targetPath}${suffix}`];
  for (const issue of inspection.issues) lines.push(`  - ${issue.message}`);
  if (!inspection.valid && inspection.repairable && harnessRoot) lines.push(`  - repair: ${repairCommand({ harnessRoot, targetPath: inspection.targetPath })}`);
  return lines.join("\n");
}
