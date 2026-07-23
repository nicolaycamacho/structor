import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  assertSafeWriteTarget,
  exists,
  isSameOrInsidePath,
  pathHasTraversal,
} from "./lib.mjs";

const excludedDirectoryNames = new Set([
  ".cache",
  ".git",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

function filesystemTimestamp(date) {
  return date.toISOString()
    .replace(".000Z", "Z")
    .replace(/\.(\d{3})Z$/, "-$1Z")
    .replaceAll(":", "-");
}

function manifestPathFor(sourcePath, workspaceRoot) {
  const relative = path.relative(workspaceRoot, sourcePath).replaceAll(path.sep, "/");
  return relative === "" || relative.startsWith("../") || path.isAbsolute(relative)
    ? path.resolve(sourcePath)
    : relative;
}

function isExcluded(relativePath, sourceRoot) {
  const segments = relativePath.split(path.sep).filter(Boolean);
  return (
    segments.some((segment) => excludedDirectoryNames.has(segment)) ||
    segments.some(
      (segment, index) => segment === "backups" &&
        (segments[index - 1] === ".structor" || (index === 0 && path.basename(sourceRoot) === ".structor")),
    )
  );
}

async function hasMetadataOutsideBackups(metadataRoot) {
  if (!(await exists(metadataRoot))) return false;
  const entries = await readdir(metadataRoot);
  return entries.some((entry) => entry !== "backups");
}

export async function hasExistingStructorState({
  outputRoot,
  plannedHarnessPaths,
  workspaceRoot,
  workspaceEntrypointPaths,
  consumers,
}) {
  const harnessMarkers = [
    path.join(outputRoot, ".structor", "manifest.json"),
    path.join(outputRoot, "harness.config.json"),
    ...plannedHarnessPaths.map((relativePath) => path.join(outputRoot, relativePath)),
  ];
  const hasGeneratedHarness = (await Promise.all(harnessMarkers.map(exists))).some(Boolean);
  const consumerEntrypointPaths = consumers.flatMap((consumer) =>
    consumer.entrypointPaths.map((relativePath) => path.join(consumer.root, relativePath)),
  );
  const hasConsumerEntrypoints = (
    await Promise.all([...workspaceEntrypointPaths, ...consumerEntrypointPaths].map(exists))
  ).some(Boolean);
  const metadataRoots = [
    path.join(workspaceRoot, ".structor"),
    ...consumers.map((consumer) => path.join(consumer.root, ".structor")),
  ];
  const hasStructorMetadata = (
    await Promise.all(metadataRoots.map(hasMetadataOutsideBackups))
  ).some(Boolean);

  return {
    hasStructorMetadata,
    hasGeneratedHarness,
    hasConsumerEntrypoints,
  };
}

export async function createSafetyBackup({
  reason,
  command,
  workspaceRoot,
  detectedState,
  candidatePaths,
  structorVersion,
  now = new Date(),
}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(reason)) {
    throw new Error(`Safety backup reason is invalid: ${reason}`);
  }

  const existingCandidates = [];
  for (const candidate of candidatePaths) {
    if (!(await exists(candidate.sourcePath))) continue;
    if (
      path.isAbsolute(candidate.backupPath) ||
      pathHasTraversal(candidate.backupPath) ||
      candidate.backupPath.trim() === ""
    ) {
      throw new Error(`Safety backup destination is unsafe: ${candidate.backupPath}`);
    }
    existingCandidates.push(candidate);
  }

  if (existingCandidates.length === 0) {
    return {
      created: false,
      backupPath: null,
      copiedPaths: [],
      skippedPaths: [],
    };
  }

  const backupPath = path.join(
    workspaceRoot,
    ".structor",
    "backups",
    `${filesystemTimestamp(now)}-${reason}`,
  );
  await assertSafeWriteTarget({
    targetPath: path.join(backupPath, "manifest.json"),
    rootPath: workspaceRoot,
    label: "Safety backup",
  });
  if (await exists(backupPath)) {
    throw new Error(`Safety backup destination already exists: ${backupPath}`);
  }
  await mkdir(backupPath, { recursive: true });

  const copiedPaths = [];
  const skippedPaths = new Set();
  for (const candidate of existingCandidates) {
    const destinationPath = path.join(backupPath, candidate.backupPath);
    if (!isSameOrInsidePath(destinationPath, backupPath)) {
      throw new Error(`Safety backup destination is unsafe: ${candidate.backupPath}`);
    }
    await assertSafeWriteTarget({
      targetPath: destinationPath,
      rootPath: backupPath,
      label: `Safety backup destination ${candidate.backupPath}`,
    });

    const copyOptions = {
      recursive: true,
      force: false,
      errorOnExist: true,
      verbatimSymlinks: true,
      filter(sourcePath) {
        const relative = path.relative(candidate.sourcePath, sourcePath);
        if (relative === "") return true;
        if (!isExcluded(relative, candidate.sourcePath)) return true;
        skippedPaths.add(manifestPathFor(sourcePath, workspaceRoot));
        return false;
      },
    };
    if (isSameOrInsidePath(backupPath, candidate.sourcePath)) {
      await mkdir(destinationPath, { recursive: true });
      const entries = await readdir(candidate.sourcePath);
      for (const entry of entries) {
        const sourcePath = path.join(candidate.sourcePath, entry);
        if (isExcluded(entry, candidate.sourcePath)) {
          skippedPaths.add(manifestPathFor(sourcePath, workspaceRoot));
          continue;
        }
        await cp(sourcePath, path.join(destinationPath, entry), copyOptions);
      }
    } else {
      await cp(candidate.sourcePath, destinationPath, copyOptions);
    }
    copiedPaths.push(manifestPathFor(candidate.sourcePath, workspaceRoot));
  }

  const manifest = {
    createdAt: now.toISOString(),
    reason,
    structorVersion,
    command,
    cwd: workspaceRoot,
    detectedState,
    copiedPaths,
    skippedPaths: [...skippedPaths].sort(),
  };
  await writeFile(
    path.join(backupPath, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: "wx" },
  );

  return {
    created: true,
    backupPath,
    copiedPaths,
    skippedPaths: manifest.skippedPaths,
  };
}
