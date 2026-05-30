import { access, lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const consumerRepoSignals = [
  ".git",
  "package.json",
  "pyproject.toml",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "Gemfile",
  "composer.json",
];

export async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

export async function collectFiles(baseRelativePath, predicate = () => true) {
  const basePath = path.join(repoRoot, baseRelativePath);
  const files = [];

  async function walk(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentPath, entry.name);
      const relative = path.relative(repoRoot, absolute).replaceAll(path.sep, "/");
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile() && predicate(relative)) {
        files.push(relative);
      }
    }
  }

  if (await exists(basePath)) {
    const info = await stat(basePath);
    if (info.isDirectory()) {
      await walk(basePath);
    }
  }

  return files.sort();
}

export function pathContainsSegment(targetPath, segment) {
  return path.resolve(targetPath).split(path.sep).includes(segment);
}

export function isSameOrInsidePath(candidate, root) {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function isAbsolutePathString(candidate) {
  return (
    path.isAbsolute(candidate) ||
    candidate.startsWith("/") ||
    candidate.startsWith("\\") ||
    /^[A-Za-z]:/.test(candidate)
  );
}

export function pathHasTraversal(candidate) {
  return candidate.split(/[\\/]+/).includes("..");
}

function pathSegments(candidate) {
  return candidate.split(/[\\/]+/).filter(Boolean);
}

async function lstatIfExists(targetPath) {
  try {
    return await lstat(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export function workspaceRootForConfig(configDir, templateRepoRoot = repoRoot) {
  const resolvedConfigDir = path.resolve(configDir);
  const resolvedTemplateRepoRoot = path.resolve(templateRepoRoot);
  return isSameOrInsidePath(resolvedConfigDir, resolvedTemplateRepoRoot)
    ? path.dirname(resolvedTemplateRepoRoot)
    : resolvedConfigDir;
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

export function assertSafeConsumerPath({
  consumerName,
  consumerPath,
  workspaceRoot,
  outputRoot = null,
  repoRoot: templateRepoRoot = repoRoot,
}) {
  const label = `Consumer path for ${consumerName}`;
  const rejectedPath = path.resolve(workspaceRoot, consumerPath);
  const segments = pathSegments(consumerPath);

  if (isAbsolutePathString(consumerPath)) {
    throw new Error(`${label} is unsafe: absolute consumer paths are not allowed.`);
  }
  if (pathHasTraversal(consumerPath)) {
    throw new Error(`${label} is unsafe: relative traversal is not allowed.`);
  }
  if (segments.filter((segment) => segment !== ".").length === 0) {
    throw new Error(`${label} is unsafe: path must name a consumer repository folder, not the workspace root.`);
  }
  if (segments.includes(".git") || pathContainsSegment(rejectedPath, ".git")) {
    throw new Error(`${label} is unsafe: consumer paths must not contain a .git path segment.`);
  }
  if (!isSameOrInsidePath(rejectedPath, workspaceRoot)) {
    throw new Error(`${label} is unsafe: path must stay inside the workspace ${workspaceRoot}.`);
  }
  if (path.resolve(rejectedPath) === path.resolve(workspaceRoot)) {
    throw new Error(`${label} is unsafe: path must not equal the workspace root ${workspaceRoot}.`);
  }
  if (isSameOrInsidePath(rejectedPath, templateRepoRoot)) {
    throw new Error(`${label} is unsafe: path must not equal or be inside the Structor template repo ${templateRepoRoot}.`);
  }
  if (outputRoot && isSameOrInsidePath(rejectedPath, outputRoot)) {
    throw new Error(`${label} is unsafe: path must not equal or be inside the generated harness output ${outputRoot}.`);
  }

  return rejectedPath;
}

export async function hasConsumerRepositorySignal(consumerRoot) {
  for (const signal of consumerRepoSignals) {
    if (await exists(path.join(consumerRoot, signal))) return true;
  }
  return false;
}

export async function assertConfirmedConsumerRepository({
  consumerName,
  consumerRoot,
  workspaceRoot,
  outputRoot = null,
  repoRoot: templateRepoRoot = repoRoot,
}) {
  const label = `Consumer path for ${consumerName}`;
  const info = await lstatIfExists(consumerRoot);
  if (info === null) {
    throw new Error(`Consumer repo path for ${consumerName} does not exist: ${consumerRoot}`);
  }
  if (info.isSymbolicLink()) {
    throw new Error(`${label} is unsafe: symlinked consumer paths are not allowed: ${consumerRoot}.`);
  }
  if (!info.isDirectory()) {
    throw new Error(`${label} is not a directory: ${consumerRoot}.`);
  }

  const canonicalWorkspaceRoot = await canonicalPathForWrite(workspaceRoot);
  const canonicalConsumerRoot = await canonicalPathForWrite(consumerRoot);
  if (!isSameOrInsidePath(canonicalConsumerRoot, canonicalWorkspaceRoot)) {
    throw new Error(
      `${label} is unsafe: resolved path escapes workspace ${canonicalWorkspaceRoot}: ${canonicalConsumerRoot}.`,
    );
  }

  const canonicalTemplateRepoRoot = await canonicalPathForWrite(templateRepoRoot);
  if (isSameOrInsidePath(canonicalConsumerRoot, canonicalTemplateRepoRoot)) {
    throw new Error(
      `${label} is unsafe: resolved path must not equal or be inside the Structor template repo ${canonicalTemplateRepoRoot}.`,
    );
  }

  if (outputRoot) {
    const canonicalOutputRoot = await canonicalPathForWrite(outputRoot);
    if (isSameOrInsidePath(canonicalConsumerRoot, canonicalOutputRoot)) {
      throw new Error(
        `${label} is unsafe: resolved path must not equal or be inside the generated harness output ${canonicalOutputRoot}.`,
      );
    }
  }

  if (!(await hasConsumerRepositorySignal(canonicalConsumerRoot))) {
    throw new Error(
      `${label} is not a confirmed consumer repository: ${consumerRoot} (expected one of ${consumerRepoSignals.join(", ")}).`,
    );
  }

  return canonicalConsumerRoot;
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

export async function assertSafeOutputRoot({
  outputPath,
  outputRoot,
  repoRoot: templateRepoRoot,
  workspaceRoot,
  consumerRepos,
  allowAbsoluteOutput = false,
}) {
  const rejectedPath = path.resolve(outputRoot);
  if (path.isAbsolute(outputPath) && !allowAbsoluteOutput) {
    throw new Error(`Unsafe output path ${rejectedPath}: absolute output paths require --allow-absolute-output.`);
  }
  if (pathContainsSegment(rejectedPath, ".git")) {
    throw new Error(`Unsafe output path ${rejectedPath}: output path must not contain a .git path segment.`);
  }

  const symlinkPath = await firstSymlinkUnderRoot(outputRoot, workspaceRoot);
  if (symlinkPath !== null) {
    throw new Error(`Unsafe output path ${rejectedPath}: output path must not use symlinked output directories (${symlinkPath}).`);
  }

  const outputInfo = await lstatIfExists(outputRoot);
  if (outputInfo?.isSymbolicLink()) {
    throw new Error(`Unsafe output path ${rejectedPath}: output path must not use symlinked output directories (${rejectedPath}).`);
  }

  const canonicalOutputRoot = await canonicalPathForWrite(outputRoot);
  const canonicalTemplateRepoRoot = await canonicalPathForWrite(templateRepoRoot);
  const canonicalWorkspaceRoot = await canonicalPathForWrite(workspaceRoot);

  if (!path.isAbsolute(outputPath) && !isSameOrInsidePath(canonicalOutputRoot, canonicalWorkspaceRoot)) {
    throw new Error(
      `Unsafe output path ${rejectedPath}: relative output paths must remain inside the workspace boundary ${canonicalWorkspaceRoot}.`,
    );
  }
  if (isSameOrInsidePath(canonicalOutputRoot, canonicalTemplateRepoRoot)) {
    throw new Error(`Unsafe output path ${rejectedPath}: output must not equal or be inside the template repo ${canonicalTemplateRepoRoot}.`);
  }
  if (canonicalOutputRoot === canonicalWorkspaceRoot) {
    throw new Error(`Unsafe output path ${rejectedPath}: output must not equal the workspace root ${canonicalWorkspaceRoot}.`);
  }
  for (const consumerRoot of consumerRepos) {
    const canonicalConsumerRoot = await canonicalPathForWrite(consumerRoot);
    if (isSameOrInsidePath(canonicalOutputRoot, canonicalConsumerRoot)) {
      throw new Error(
        `Unsafe output path ${rejectedPath}: output must not equal or be inside configured consumer repo ${canonicalConsumerRoot}.`,
      );
    }
  }
  if (pathContainsSegment(canonicalOutputRoot, ".git")) {
    throw new Error(`Unsafe output path ${rejectedPath}: output path must not contain a .git path segment.`);
  }

  return canonicalOutputRoot;
}

export function failIfErrors(title, errors) {
  if (errors.length === 0) {
    console.log(`${title} passed.`);
    return;
  }

  console.error(`${title} failed.`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typeName(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function validateJsonSchema(value, schema, label, errors) {
  const expectedType = schema.type;
  if (expectedType) {
    const validType =
      expectedType === "object" ? isPlainObject(value) :
      expectedType === "array" ? Array.isArray(value) :
      typeof value === expectedType;
    if (!validType) {
      errors.push(`${label} must be ${expectedType}; got ${typeName(value)}.`);
      return;
    }
  }

  if (Object.hasOwn(schema, "const") && value !== schema.const) {
    errors.push(`${label} must be ${JSON.stringify(schema.const)}.`);
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${label} must be at least ${schema.minLength} character(s).`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${label} must match pattern ${schema.pattern}.`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${label} must contain at least ${schema.minItems} item(s).`);
    }
    if (schema.items) {
      for (const [index, item] of value.entries()) {
        validateJsonSchema(item, schema.items, `${label}[${index}]`, errors);
      }
    }
  }

  if (isPlainObject(value)) {
    const properties = schema.properties ?? {};
    for (const requiredKey of schema.required ?? []) {
      if (!Object.hasOwn(value, requiredKey)) {
        errors.push(`${label}.${requiredKey} is required.`);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) {
          errors.push(`${label}.${key} is not allowed.`);
        }
      }
    }
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) {
        validateJsonSchema(value[key], propertySchema, `${label}.${key}`, errors);
      }
    }
  }
}

export async function validateConfigShape(config, label) {
  const errors = [];
  const schema = await readJson("schemas/harness-config.schema.json");
  validateJsonSchema(config, schema, label, errors);

  if (isPlainObject(config.models) && config.models.openai === false && config.models.anthropic === false) {
    errors.push("Invalid harness config: at least one model provider must be enabled.");
  }

  const names = new Set();
  if (Array.isArray(config.consumers)) {
    for (const [index, consumer] of config.consumers.entries()) {
      if (!isPlainObject(consumer)) continue;
      const prefix = `${label}.consumers[${index}]`;
      if (names.has(consumer.name)) errors.push(`${prefix}.name is duplicated.`);
      names.add(consumer.name);
      if (typeof consumer.path === "string") {
        if (isAbsolutePathString(consumer.path)) {
          errors.push(`${prefix}.path must be relative to the workspace; absolute paths are not allowed.`);
        }
        if (pathHasTraversal(consumer.path)) {
          errors.push(`${prefix}.path must not contain relative traversal segments.`);
        }
        if (pathSegments(consumer.path).filter((segment) => segment !== ".").length === 0) {
          errors.push(`${prefix}.path must name a consumer repository folder, not the workspace root.`);
        }
      }
    }
  }

  return errors;
}
