import { access, lstat, realpath } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";

export async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function isSameOrInsidePath(candidate, root) {
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

export async function canonicalPathForWrite(targetPath) {
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

export async function assertSafeWriteTarget({ targetPath, rootPath, label = "Write target" }) {
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

  return canonicalTarget;
}
