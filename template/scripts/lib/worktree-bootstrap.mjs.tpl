import { access, lstat, mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

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

export async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isSameOrInsidePath(candidate, root) {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function lstatIfExists(targetPath) {
  try {
    return await lstat(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function canonicalPathForWrite(targetPath) {
  let currentPath = path.resolve(targetPath);
  const missingSegments = [];

  while (true) {
    if (await exists(currentPath)) {
      return path.join(await realpath(currentPath), ...missingSegments);
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return path.join(currentPath, ...missingSegments);
    }

    missingSegments.unshift(path.basename(currentPath));
    currentPath = parentPath;
  }
}

async function firstSymlinkUnderRoot(targetPath, rootPath) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);
  if (!isSameOrInsidePath(resolvedTarget, resolvedRoot)) return null;

  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative === "") return null;

  let currentPath = resolvedRoot;
  for (const segment of relative.split(path.sep)) {
    currentPath = path.join(currentPath, segment);
    const info = await lstatIfExists(currentPath);
    if (info === null) return null;
    if (info.isSymbolicLink()) return currentPath;
  }

  return null;
}

async function assertSafeWriteTarget({ targetPath, rootPath, label }) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);
  if (!isSameOrInsidePath(resolvedTarget, resolvedRoot)) {
    throw new Error(`${label} is unsafe: target ${resolvedTarget} must stay inside ${resolvedRoot}.`);
  }

  const symlinkPath = await firstSymlinkUnderRoot(resolvedTarget, resolvedRoot);
  if (symlinkPath !== null) {
    throw new Error(`${label} is unsafe: symlinked write targets are not allowed (${symlinkPath}).`);
  }

  const canonicalRoot = await canonicalPathForWrite(resolvedRoot);
  const canonicalTarget = await canonicalPathForWrite(resolvedTarget);
  if (!isSameOrInsidePath(canonicalTarget, canonicalRoot)) {
    throw new Error(`${label} is unsafe: resolved target escapes ${canonicalRoot}: ${canonicalTarget}.`);
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

export function resolveHarnessReferenceTarget({ reference: rawReference, consumerRoot }) {
  const reference = cleanReference(rawReference);
  const absoluteReference = path.isAbsolute(reference) ? path.resolve(reference) : path.resolve(consumerRoot, reference);
  const parts = absoluteReference.split(path.sep);
  if (parts.lastIndexOf("{{HARNESS_REPO_NAME}}") === -1) return null;
  return absoluteReference;
}

export function resolveHarnessReferenceRoot({ reference: rawReference, consumerRoot }) {
  const target = resolveHarnessReferenceTarget({ reference: rawReference, consumerRoot });
  if (!target) return null;
  const parts = target.split(path.sep);
  const index = parts.lastIndexOf("{{HARNESS_REPO_NAME}}");
  return parts.slice(0, index + 1).join(path.sep) || path.sep;
}

async function isFileTarget(target) {
  try {
    return (await stat(target)).isFile();
  } catch {
    return false;
  }
}

export async function validateHarnessReferences({
  pointerPath,
  pointerContent,
  consumerRoot,
  expectedHarnessRoot,
  fileIsFile = isFileTarget,
  models: enabledModels = models,
  requireHarnessReference = true,
}) {
  const references = extractHarnessReferences(pointerContent);
  if (references.length === 0) {
    if (!requireHarnessReference) return null;
    return [{ kind: "missing", message: `${pointerPath} does not contain a resolvable {{HARNESS_REPO_NAME}} path.` }];
  }

  const issues = [];
  let matchedExpectedRoot = false;
  for (const reference of references) {
    const target = resolveHarnessReferenceTarget({ reference, consumerRoot });
    if (!target) {
      issues.push({ kind: "missing", reference, message: `${pointerPath} does not contain a resolvable {{HARNESS_REPO_NAME}} path.` });
      continue;
    }

    const referenceRoot = resolveHarnessReferenceRoot({ reference, consumerRoot });
    if (referenceRoot === null || path.resolve(referenceRoot) !== path.resolve(expectedHarnessRoot)) {
      issues.push({
        kind: "wrong_harness_root",
        reference,
        message: `${pointerPath} points at ${referenceRoot ?? reference} instead of ${expectedHarnessRoot}.`,
      });
      continue;
    }

    matchedExpectedRoot = true;
    const relativeTarget = path.relative(expectedHarnessRoot, target).replaceAll(path.sep, "/");
    if (!enabledModels.openai && relativeTarget === "AGENTS.md") {
      issues.push({
        kind: "disabled_entrypoint",
        reference,
        message: `${pointerPath} must not reference ${relativeTarget} when OpenAI support is disabled.`,
      });
      continue;
    }
    if (!enabledModels.anthropic && relativeTarget === "CLAUDE.md") {
      issues.push({
        kind: "disabled_entrypoint",
        reference,
        message: `${pointerPath} must not reference ${relativeTarget} when Anthropic support is disabled.`,
      });
      continue;
    }
    if (relativeTarget === "" || !(await fileIsFile(target))) {
      const targetLabel = relativeTarget === "" ? "." : relativeTarget;
      issues.push({
        kind: "missing_target",
        reference,
        message: `${pointerPath} references missing generated-harness file ${targetLabel}.`,
      });
    }
  }

  if (!matchedExpectedRoot && issues.length === 0) {
    issues.push({
      kind: "wrong_harness_root",
      message: `${pointerPath} points at ${references.join(", ")} instead of ${expectedHarnessRoot}.`,
    });
  }

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
