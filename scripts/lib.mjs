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
      const prefix = `${label}.consumers[${index}]`;
      if (names.has(consumer.name)) errors.push(`${prefix}.name is duplicated.`);
      names.add(consumer.name);
    }
  }

  return errors;
}
