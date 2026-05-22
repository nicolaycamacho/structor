import { access, readdir, readFile, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

export function validateConfigShape(config, label) {
  const errors = [];

  if (!config.project?.name) errors.push(`${label}: project.name is required.`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(config.project?.slug ?? "")) {
    errors.push(`${label}: project.slug must be kebab-case.`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(config.project?.harnessRepoName ?? "")) {
    errors.push(`${label}: project.harnessRepoName must be kebab-case.`);
  }
  if (!config.output?.path) errors.push(`${label}: output.path is required.`);
  if (typeof config.models?.openai !== "boolean") errors.push(`${label}: models.openai must be boolean.`);
  if (typeof config.models?.anthropic !== "boolean") errors.push(`${label}: models.anthropic must be boolean.`);
  if (config.clientSupport !== undefined && typeof config.clientSupport !== "object") {
    errors.push(`${label}: clientSupport must be an object when provided.`);
  }
  if (config.clientSupport?.codex !== undefined && typeof config.clientSupport.codex !== "object") {
    errors.push(`${label}: clientSupport.codex must be an object when provided.`);
  }
  if (
    config.clientSupport?.codex?.hooks !== undefined &&
    typeof config.clientSupport.codex.hooks !== "boolean"
  ) {
    errors.push(`${label}: clientSupport.codex.hooks must be boolean when provided.`);
  }
  if (config.clientSupport?.claude !== undefined && typeof config.clientSupport.claude !== "object") {
    errors.push(`${label}: clientSupport.claude must be an object when provided.`);
  }
  for (const key of ["rules", "hooks", "skills"]) {
    if (
      config.clientSupport?.claude?.[key] !== undefined &&
      typeof config.clientSupport.claude[key] !== "boolean"
    ) {
      errors.push(`${label}: clientSupport.claude.${key} must be boolean when provided.`);
    }
  }
  for (const key of ["hooks", "skills"]) {
    if (config.clientSupport?.claude?.[key] === true) {
      errors.push(`${label}: clientSupport.claude.${key} is reserved for future support and must be false or omitted.`);
    }
  }
  if (!Array.isArray(config.consumers) || config.consumers.length === 0) {
    errors.push(`${label}: consumers must contain at least one repo.`);
  }

  const names = new Set();
  for (const [index, consumer] of (config.consumers ?? []).entries()) {
    const prefix = `${label}: consumers[${index}]`;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(consumer.name ?? "")) {
      errors.push(`${prefix}.name must be kebab-case.`);
    }
    if (names.has(consumer.name)) errors.push(`${prefix}.name is duplicated.`);
    names.add(consumer.name);
    if (!consumer.path) errors.push(`${prefix}.path is required.`);
    if (!consumer.purpose) errors.push(`${prefix}.purpose is required.`);
    if (!consumer.validation || typeof consumer.validation !== "object") {
      errors.push(`${prefix}.validation is required.`);
    }
  }

  return errors;
}
