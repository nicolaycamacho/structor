// Deliberately bounded metadata: flat scalars and string lists, not general YAML.
export function readMetadata(content, file) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const errors = [];
  const metadata = Object.create(null);
  if (lines[0] !== "---") return { metadata, body: content, errors: [`${file} must start with YAML front matter.`] };
  const end = lines.indexOf("---", 1);
  if (end === -1) return { metadata, body: "", errors: [`${file} front matter is missing its closing delimiter.`] };
  let listKey = null;
  let currentKey = null;
  for (let index = 1; index < end; index++) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const field = line.match(/^([A-Za-z0-9_]+):[ \t]*(.*)$/);
    if (field) {
      const [, key, raw] = field;
      currentKey = key;
      if (Object.hasOwn(metadata, key)) errors.push(`${file} duplicate metadata field '${key}' (line ${index + 1}).`);
      listKey = raw === "" ? key : null;
      try {
        metadata[key] = raw === "" ? [] : parseValue(raw);
      } catch {
        errors.push(`${file} malformed scalar/list value for field '${key}' (line ${index + 1}).`);
      }
      continue;
    }
    const item = line.match(/^[ \t]+-[ \t]+(.+)$/);
    if (item && listKey) {
      try {
        const value = parseValue(item[1]);
        if (typeof value !== "string") throw new Error();
        metadata[listKey].push(value);
      } catch {
        errors.push(`${file} malformed list item for field '${listKey}' (line ${index + 1}).`);
      }
    } else {
      errors.push(`${file} ambiguous front matter near field '${currentKey ?? "unknown"}' (line ${index + 1}). Use flat keys and indented string lists.`);
    }
  }
  return { metadata, body: lines.slice(end + 1).join("\n"), errors };
}

function parseValue(raw) {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value.startsWith("[")) {
    // JSON string arrays and the legacy empty [] spelling are supported.
    const list = JSON.parse(value);
    if (!Array.isArray(list) || list.some((item) => typeof item !== "string" || !item.trim())) throw new Error();
    return list;
  }
  if (value.startsWith('"')) {
    const scalar = JSON.parse(value);
    if (typeof scalar !== "string" || !scalar.trim()) throw new Error();
    return scalar;
  }
  if (value.startsWith("'")) {
    if (!/^'(?:[^']|'')+'$/.test(value)) throw new Error();
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (!value || /^[{}&*!|>@`]/.test(value) || /[\[\]{}"']/.test(value) || /:\s|\s#/.test(value)) throw new Error();
  return value;
}

export function inputFile(args) {
  if (args.length === 0) return null;
  if (args.length !== 2 || args[0] !== "--file" || !args[1] || args[1].startsWith("--")) {
    throw new Error("Usage: node scripts/check-{issue,task}-template.mjs [--file <path>]");
  }
  return args[1];
}

export function report(label, errors) {
  if (errors.length) {
    console.error(`${label} failed.`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`${label} passed.`);
  }
}
export const standardSections = [
  "Summary",
  "Context",
  "Goals",
  "Non-Goals",
  "Scope",
  "Path Contract",
  "Requirements",
  "Bootstrap Requirements",
  "Proposed Approach",
  "Agent Execution Protocol",
  "Success Criteria",
  "Validation",
  "Validation Evidence Required",
  "Risk and Autonomy",
  "Review Routing",
  "Dependencies",
  "Rollback / Recovery",
  "Open Questions",
  "Notes for the Agent",
];
const metadataKeys = ["id", "status", "risk", "autonomy", "model_policy", "repos", "allowed_paths", "forbidden_paths", "requires_human_approval"];
const enums = {
  risk: ["low", "medium", "high"],
  autonomy: ["report_only", "pr_ready", "auto_merge"],
  model_policy: ["cheap", "standard", "reasoning", "frontier", "review_only"],
  task_size: ["tiny", "standard"],
};
const statuses = ["Backlog", "Ready for Agent", "Running", "Needs Fix", "Report Ready", "PR Ready", "Human Review", "Blocked", "Done"];
const placeholderPattern = /<[^>\n]+>|\{\{[^}\n]+\}\}|\b(?:TASK-ID|ISSUE-ID|TODO|TBD)\b|^# Title[ \t]*$/im;
const protectedSurfacePattern = /\b(auth|authentication|authorization|billing|subscription|payment|secret|environment variable|infrastructure|deployment|database migration|production data|tenant|quota|rate limit|shared contract)\b/i;

function sectionsIn(body) {
  const sections = new Map();
  const duplicates = [];
  let section = null;
  let fence = null;
  for (const line of body.split("\n")) {
    const delimiter = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (delimiter) {
      if (!fence) fence = delimiter[1];
      else if (delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence) {
      if (section) sections.set(section, sections.get(section) + line + "\n");
      continue;
    }
    const heading = line.match(/^## (.+?)\s*$/);
    if (heading) {
      section = heading[1];
      if (sections.has(section)) duplicates.push(section);
      sections.set(section, "");
    } else if (section) {
      sections.set(section, sections.get(section) + line + "\n");
    }
  }
  return { sections, duplicates };
}

export function validateBrief(file, content, { kind, canonicalRepos, allowPlaceholders = false }) {
  const { metadata, body, errors } = readMetadata(content, file);
  if (errors.length) return errors;
  const size = metadata.task_size ?? "standard";
  const required = size === "tiny" ? ["task_size"] : [...metadataKeys, ...(kind === "task" ? ["model"] : [])];
  for (const key of required) {
    if (!Object.hasOwn(metadata, key)) errors.push(`${file} is missing front matter key '${key}'.`);
  }
  for (const [key, value] of Object.entries(metadata)) {
    if (["repos", "allowed_paths", "forbidden_paths"].includes(key)) {
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
        errors.push(`${file} field '${key}' must be a string list.`);
      } else if (kind === "issue" && size !== "tiny" && key !== "repos" && value.length === 0) {
        errors.push(`${file} field '${key}' must contain at least one path.`);
      }
    } else if (key === "requires_human_approval") {
      if (typeof value !== "boolean") errors.push(`${file} field '${key}' must be boolean.`);
    } else if (typeof value !== "string" || !value.trim()) {
      errors.push(`${file} field '${key}' must be a non-empty scalar string.`);
    }
    if (enums[key] && !enums[key].includes(value)) errors.push(`${file} has invalid ${key} '${value}'.`);
  }
  if (metadata.status !== undefined) {
    const allowed = kind === "task" ? [...statuses, ...statuses.map((status) => status.toLowerCase().replaceAll(" ", "_"))] : statuses;
    if (!allowed.includes(metadata.status)) errors.push(`${file} has invalid status '${metadata.status}'.`);
  }
  if (Array.isArray(metadata.repos)) {
    for (const repo of metadata.repos) {
      if (!(allowPlaceholders && placeholderPattern.test(repo)) && !canonicalRepos.has(repo)) errors.push(`${file} references non-canonical repo '${repo}'.`);
    }
  }
  if (metadata.risk === "high" && metadata.autonomy === "auto_merge") errors.push(`${file} has risk: high with autonomy: auto_merge.`);
  if (kind === "task" && /\b(?:gpt-|claude|opus|sonnet|haiku)/i.test(String(metadata.model ?? ""))) {
    errors.push(`${file} field 'model' must use a runtime-neutral model selector, not a concrete provider model.`);
  }
  const { sections, duplicates } = sectionsIn(body);
  for (const section of duplicates) errors.push(`${file} has duplicate section '${section}'.`);
  for (const section of size === "tiny" ? ["Goal", "Scope", "Acceptance", "Validation"] : standardSections) {
    if (!sections.has(section)) errors.push(`${file} is missing required section '${section}'.`);
    else if (!allowPlaceholders && !sections.get(section).replace(/<!--[\s\S]*?-->/g, "").replace(/^#{3,}.*$/gm, "").replace(/[-*\s]/g, "")) errors.push(`${file} section '${section}' must contain substantive text.`);
  }
  if (!allowPlaceholders) {
    for (const [key, value] of Object.entries(metadata)) {
      if (placeholderPattern.test(String(value))) errors.push(`${file} field '${key}' contains unresolved placeholder text.`);
    }
    if (placeholderPattern.test(body)) {
      const affected = [...sections].filter(([, text]) => placeholderPattern.test(text)).map(([name]) => name);
      errors.push(`${file} contains unresolved placeholder text in section '${affected.join(", ") || "Title"}'.`);
    }
    if (!/`[^`\n]+`/.test(sections.get("Validation") ?? "")) errors.push(`${file} Validation section must include a concrete command in backticks.`);
    if (protectedSurfacePattern.test(body) && metadata.requires_human_approval !== true) errors.push(`${file} touches protected surfaces but requires_human_approval is not true.`);
  }
  if (size !== "tiny") {
    if (!/protected surfaces?/i.test(body)) errors.push(`${file} must mention protected surfaces.`);
    if (!/auto_merge.*future-facing|future-facing.*auto_merge/i.test(body.replace(/\n/g, " "))) errors.push(`${file} must state that auto_merge is future-facing metadata.`);
  }
  return errors;
}
