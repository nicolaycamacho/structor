import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { assertSafeWriteTarget, exists } from "./path-safety.mjs";

import {
  extractHarnessReferences as extractReferences,
  isFileTarget,
  resolveHarnessReferenceRoot as resolveReferenceRoot,
  resolveHarnessReferenceTarget as resolveReferenceTarget,
  validateHarnessReferences as validateReferences,
} from "./harness-routing.mjs";

export { exists };

const execFileAsync = promisify(execFile);

const projectName = {{PROJECT_NAME_JSON}};
export const canonicalRepos = ["{{HARNESS_REPO_NAME}}", ...{{CONSUMER_REPO_NAMES_JSON}}];
export const models = {
  openai: {{MODEL_OPENAI_ENABLED}},
  anthropic: {{MODEL_ANTHROPIC_ENABLED}},
};
export const requiredPointerFiles = [
  ...(models.openai ? ["AGENTS.md"] : []),
  ...(models.anthropic ? ["CLAUDE.md"] : []),
];
export const optionalPointerFiles = [];

const repairableStates = new Set(["missing", "stale_relative", "wrong_harness_root"]);

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

// Keep the generated helper API bound to this harness's configured name and models.
export function extractHarnessReferences(content) {
  return extractReferences(content, "{{HARNESS_REPO_NAME}}");
}

export function resolveHarnessReferenceTarget({ reference, consumerRoot }) {
  return resolveReferenceTarget({ reference, basePath: consumerRoot, harnessRepoName: "{{HARNESS_REPO_NAME}}" });
}

export function resolveHarnessReferenceRoot({ reference, consumerRoot }) {
  return resolveReferenceRoot({ reference, basePath: consumerRoot, harnessRepoName: "{{HARNESS_REPO_NAME}}" });
}

export async function validateHarnessReferences({ consumerRoot, models: enabledModels = models, ...options }) {
  const issues = await validateReferences({
    ...options,
    basePath: consumerRoot,
    harnessRepoName: "{{HARNESS_REPO_NAME}}",
    models: enabledModels,
  });
  return issues.length > 0 ? issues : null;
}

export async function assertReferencesHarnessRoot({
  pointerPath,
  pointerContent,
  consumerRoot,
  expectedHarnessRoot,
  fileIsFile,
  models: enabledModels,
  requireHarnessReference,
}) {
  const issues = await validateHarnessReferences({
    pointerPath,
    pointerContent,
    consumerRoot,
    expectedHarnessRoot,
    fileIsFile,
    models: enabledModels,
    requireHarnessReference,
  });
  if (!issues) return null;
  return issues[0].message;
}

async function classifyPointerContent({ relativePath, content, targetPath, harnessRoot, fileIsFile }) {
  const issues = await validateHarnessReferences({
    pointerPath: relativePath,
    pointerContent: content,
    consumerRoot: targetPath,
    expectedHarnessRoot: harnessRoot,
    fileIsFile,
  });
  if (!issues) return null;
  const references = extractHarnessReferences(content);
  const referenceKinds = new Set(issues.map((issue) => issue.kind));
  if (referenceKinds.has("disabled_entrypoint")) {
    return { kind: "wrong_harness_root", relativePath, references, message: issues[0].message };
  }
  if (referenceKinds.has("missing_target")) {
    return { kind: "missing", relativePath, references, message: issues[0].message };
  }
  if (referenceKinds.has("missing")) {
    return { kind: "missing", relativePath, references, message: issues[0].message };
  }
  if (referenceKinds.has("wrong_harness_root")) {
    if (references.some((reference) => !path.isAbsolute(reference))) {
      return { kind: "stale_relative", relativePath, references, message: issues[0].message };
    }
    return { kind: "wrong_harness_root", relativePath, references, message: issues[0].message };
  }
  return { kind: "wrong_harness_root", relativePath, references, message: issues[0].message };
}

function stateFromIssues(issues) {
  if (issues.some((issue) => issue.kind === "missing")) return "missing";
  if (issues.some((issue) => issue.kind === "stale_relative")) return "stale_relative";
  return "wrong_harness_root";
}

export async function classifyWorktreeBootstrap({
  targetPath,
  targetExists = true,
  harnessRoot,
  repoName,
  files,
  worktreeRecord = {},
  fileIsFile = isFileTarget,
}) {
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
    const issue = await classifyPointerContent({ relativePath, content: file.content, targetPath: resolvedTargetPath, harnessRoot, fileIsFile });
    if (issue) issues.push({ ...issue, required: true });
  }
  for (const relativePath of optionalPointerFiles) {
    const file = byPath.get(relativePath);
    if (!file?.exists || repoName === "{{HARNESS_REPO_NAME}}") continue;
    const issue = await classifyPointerContent({ relativePath, content: file.content, targetPath: resolvedTargetPath, harnessRoot, fileIsFile });
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
  const bootstrapCommand = repairCommand({ harnessRoot: normalizedHarnessRoot, targetPath: "<checkout-path>" });
  const title = relativePath === "CLAUDE.md" ? "Project Agent Guide" : "Agent Bootstrap";
  const guidance = [
    ...(relativePath === "AGENTS.md" && models.openai ? [path.join(normalizedHarnessRoot, "AGENTS.md")] : []),
    ...(models.anthropic ? [path.join(normalizedHarnessRoot, "CLAUDE.md")] : []),
    path.join(normalizedHarnessRoot, "ai/AGENTS.md"),
    path.join(normalizedHarnessRoot, "ai/HUB.md"),
    path.join(normalizedHarnessRoot, "ai/context.md"),
  ];
  return `# ${title}

This checkout is part of the ${projectName} workspace.
The canonical AI guidance lives in the harness repo.

Canonical repo: \`${repoName}\`

Read before changing files:

${guidance.map((entry, index) => `${index + 1}. \`${entry}\``).join("\n")}

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
    rootPath: inspection.targetPath,
    targetPath: path.join(inspection.targetPath, relativePath),
    content: renderPointerFile({ relativePath, harnessRoot, repoName: inspection.repoName }),
  }));
  return { repairable: true, writes, reason: "" };
}

export async function writeRepairPlan(repairPlan) {
  for (const write of repairPlan.writes) {
    if (!write.rootPath) {
      throw new Error(`Worktree pointer ${write.relativePath} is unsafe: missing write root.`);
    }
    await assertSafeWriteTarget({
      targetPath: write.targetPath,
      rootPath: write.rootPath,
      label: `Worktree pointer ${write.relativePath}`,
    });
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
