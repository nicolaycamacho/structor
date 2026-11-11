import { readFile, realpath, stat } from "node:fs/promises";
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

// Internal guidance is resolved from an explicit navigation root, independently
// of consumer pointers (which must identify the expected harness repository).
export async function resolveGuidanceTarget({ harnessRoot, source, reference, base = "root" }) {
  const root = path.resolve(harnessRoot);
  const filename = reference.split("#")[0];
  if (!filename || path.isAbsolute(filename) || filename.includes("\\")) {
    throw new Error(`unsafe guidance reference ${reference}`);
  }
  const basePath = base === "source" ? path.dirname(path.resolve(root, source)) : root;
  let target = path.resolve(basePath, filename);
  if (filename.endsWith("/")) target = path.join(target, "README.md");
  if (!isWithinRoot(root, target)) throw new Error(`guidance reference ${reference} escapes the harness`);
  if (!(await isFileTarget(target))) throw new Error(`missing guidance target ${reference}`);
  if (!isWithinRoot(await realpath(root), await realpath(target))) {
    throw new Error(`guidance reference ${reference} escapes the harness through a symlink`);
  }
  return path.relative(root, target).replaceAll(path.sep, "/");
}

function declaredGuidanceReferences(content, sections) {
  let section = "";
  let fence = null;
  const references = [];
  for (const line of content.split(/\r?\n/)) {
    if (fence) {
      const closing = line.match(/^\s*(`{3,}|~{3,})\s*$/);
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) fence = null;
      continue;
    }
    const opening = line.match(/^\s*(`{3,}|~{3,})/);
    if (opening) { fence = opening[1]; continue; }
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (heading) { section = heading[1]; continue; }
    if (!sections.includes(section)) continue;
    for (const match of line.matchAll(/`([^`\n]+)`|\[[^\]]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g)) {
      const reference = match[1] ?? match[2] ?? match[3];
      if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(reference) || (match[1] && /\s/.test(reference))) continue;
      if (!match[1] || /[/\\]|\.[\w-]+(?:#.*)?$|[*{}<>]/.test(reference)) references.push(reference);
    }
  }
  return [...new Set(references)];
}

async function assertNarrowDynamicReference({ harnessRoot, source, reference, base }) {
  const parts = reference.split("/");
  const filename = parts.pop();
  if (!/^[\w.-]*\*[\w.-]*\.(?:md|json|html)$/.test(filename) ||
      parts.some((part) => part === ".." || /[*{}<>\\]/.test(part)) || path.isAbsolute(reference)) {
    throw new Error(`dynamic guidance reference ${reference} is not a narrow filename pattern`);
  }
  const root = path.resolve(harnessRoot);
  const directory = path.resolve(base === "source" ? path.dirname(path.join(root, source)) : root, parts.join("/") || ".");
  if (!isWithinRoot(root, directory) || !isWithinRoot(await realpath(root), await realpath(directory))) {
    throw new Error(`dynamic guidance reference ${reference} escapes the harness`);
  }
  if (!(await stat(directory)).isDirectory()) {
    throw new Error(`dynamic guidance reference ${reference} requires an existing directory`);
  }
}

export async function validateGuidanceGraph({ harnessRoot, models, profile, manifest }) {
  const issues = [];
  const edges = new Map();
  const entrypoints = [models.openai && "AGENTS.md", models.anthropic && "CLAUDE.md"].filter(Boolean);
  if (profile === "expanded") {
    if (models.openai) entrypoints.push("ai/model-overlays/openai/AGENTS.md");
    if (models.anthropic) entrypoints.push("ai/model-overlays/anthropic/CLAUDE.md");
  }
  const surfaces = manifest.routingSurfaces ?? [];
  const exemptions = manifest.dynamicReferences ?? [];
  const usedExemptions = new Set();
  const disabled = new Set([
    ...(!models.openai ? ["AGENTS.md", "ai/model-overlays/openai/AGENTS.md"] : []),
    ...(!models.anthropic ? ["CLAUDE.md", "ai/model-overlays/anthropic/CLAUDE.md"] : []),
  ]);
  for (const surface of surfaces) {
    try {
      if (!["root", "source"].includes(surface.base) || !Array.isArray(surface.sections)) {
        throw new Error("routing surface requires a root/source base and sections array");
      }
      const source = await resolveGuidanceTarget({ harnessRoot, reference: surface.path });
      if (disabled.has(source)) throw new Error(`disabled-client routing surface ${source}`);
      const references = declaredGuidanceReferences(await readFile(path.join(harnessRoot, source), "utf8"), surface.sections);
      const targets = new Set();
      edges.set(source, targets);
      for (const reference of references) {
        if (/[*{}<>]/.test(reference)) {
          try {
            await assertNarrowDynamicReference({ harnessRoot, source, reference, base: surface.base });
          } catch (error) {
            issues.push(`${source}: ${error.message}`);
            continue;
          }
          const index = exemptions.findIndex((item) => item.source === source && item.reference === reference && item.reason?.trim());
          if (index < 0) issues.push(`${source}: dynamic guidance reference ${reference} needs an exact exemption with a reason.`);
          else usedExemptions.add(index);
          continue;
        }
        try {
          const target = await resolveGuidanceTarget({ harnessRoot, source, reference, base: surface.base });
          if (disabled.has(target)) throw new Error(`disabled-client guidance target ${target}`);
          targets.add(target);
        } catch (error) { issues.push(`${source}: ${error.message}`); }
      }
    } catch (error) { issues.push(`${surface.path}: ${error.message}`); }
  }
  exemptions.forEach((item, index) => {
    if (!usedExemptions.has(index)) issues.push(`Unused or invalid dynamic guidance exemption: ${item.source} ${item.reference}.`);
  });
  for (const entrypoint of entrypoints) {
    const reachable = new Set();
    const queue = [entrypoint];
    while (queue.length) {
      const current = queue.shift();
      if (reachable.has(current)) continue;
      reachable.add(current);
      queue.push(...(edges.get(current) ?? []));
    }
    if (!edges.has(entrypoint)) issues.push(`${entrypoint}: enabled entrypoint has no declared routing surface.`);
    for (const doc of manifest.canonicalDocs ?? []) {
      if (!reachable.has(doc.path)) issues.push(`${doc.path} is unreachable from enabled entrypoint ${entrypoint}.`);
    }
  }
  return { issues, edges };
}
