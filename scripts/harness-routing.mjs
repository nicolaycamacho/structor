import { realpath, stat } from "node:fs/promises";
import path from "node:path";

function cleanHarnessReference(rawReference) {
  return rawReference.trim().replace(/^[`'"]+/, "").replace(/[`'",;:.)\]}]+$/, "");
}

export function extractHarnessReferences(content, harnessRepoName) {
  const escapedName = harnessRepoName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp("(?:\\.\\.?/|/)[^`'\"\\s)<\\]}]*(?:" + escapedName + ")[^`'\"\\s)<\\]}]*", "g");
  return [...new Set((content.match(pattern) ?? []).map(cleanHarnessReference).filter(Boolean))];
}

export function resolveHarnessReferenceTarget({ reference: rawReference, basePath, harnessRepoName }) {
  const reference = cleanHarnessReference(rawReference);
  const absoluteReference = path.isAbsolute(reference) ? path.resolve(reference) : path.resolve(basePath, reference);
  const parts = absoluteReference.split(path.sep);
  if (parts.lastIndexOf(harnessRepoName) === -1) return null;
  return absoluteReference;
}

export function resolveHarnessReferenceRoot({ reference: rawReference, basePath, harnessRepoName }) {
  const target = resolveHarnessReferenceTarget({ reference: rawReference, basePath, harnessRepoName });
  if (!target) return null;
  const parts = target.split(path.sep);
  const index = parts.lastIndexOf(harnessRepoName);
  return parts.slice(0, index + 1).join(path.sep) || path.sep;
}

export async function isFileTarget(targetPath) {
  try {
    return (await stat(targetPath)).isFile();
  } catch {
    return false;
  }
}

async function canonicalExistingPath(targetPath) {
  try {
    return await realpath(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

function isWithinRoot(root, candidate) {
  if (candidate === root) return true;
  return candidate.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

export async function validateHarnessReferences({
  pointerPath,
  pointerContent,
  basePath,
  expectedHarnessRoot,
  harnessRepoName,
  models,
  fileIsFile = isFileTarget,
  requireHarnessReference = true,
}) {
  const references = extractHarnessReferences(pointerContent, harnessRepoName);
  if (references.length === 0) {
    return requireHarnessReference
      ? [{ kind: "missing", message: `${pointerPath} does not contain a resolvable ${harnessRepoName} path.` }]
      : [];
  }

  const issues = [];
  for (const reference of references) {
    const target = resolveHarnessReferenceTarget({ reference, basePath, harnessRepoName });
    const referenceRoot = resolveHarnessReferenceRoot({ reference, basePath, harnessRepoName });
    if (!target || !referenceRoot) {
      issues.push({ kind: "missing", reference, message: `${pointerPath} does not contain a resolvable ${harnessRepoName} path.` });
      continue;
    }
    const canonicalReferenceRoot = await canonicalExistingPath(referenceRoot);
    const canonicalExpectedHarnessRoot = await canonicalExistingPath(expectedHarnessRoot);
    if (canonicalReferenceRoot !== canonicalExpectedHarnessRoot) {
      issues.push({ kind: "wrong_harness_root", reference, message: `${pointerPath} points at ${referenceRoot} instead of ${expectedHarnessRoot}.` });
      continue;
    }

    const relativeTarget = path.relative(referenceRoot, target).replaceAll(path.sep, "/");
    if (!models.openai && relativeTarget === "AGENTS.md") {
      issues.push({ kind: "disabled_entrypoint", reference, message: `${pointerPath} must not reference ${relativeTarget} when OpenAI support is disabled.` });
    } else if (!models.anthropic && relativeTarget === "CLAUDE.md") {
      issues.push({ kind: "disabled_entrypoint", reference, message: `${pointerPath} must not reference ${relativeTarget} when Anthropic support is disabled.` });
    } else if (relativeTarget === "" || !(await fileIsFile(target))) {
      issues.push({ kind: "missing_target", reference, message: `${pointerPath} references missing generated-harness file ${relativeTarget || "."}.` });
    } else {
      // The lexical reference root can match while the target file resolves,
      // via a symlink, to policy outside the harness. Require the canonical
      // (realpath-resolved) target to stay under the canonical harness root.
      const canonicalTarget = await canonicalExistingPath(target);
      if (!isWithinRoot(canonicalExpectedHarnessRoot, canonicalTarget)) {
        issues.push({ kind: "outside_harness", reference, message: `${pointerPath} resolves to ${canonicalTarget} outside the generated harness ${canonicalExpectedHarnessRoot}.` });
      }
    }
  }
  return issues;
}

