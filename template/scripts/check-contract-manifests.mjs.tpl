#!/usr/bin/env node

import { access, readFile, readdir, realpath, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { isSameOrInsidePath } from "./lib/path-safety.mjs";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractsDirectory = "ai/contracts";
const contractsReadmePath = `${contractsDirectory}/README.md`;
const contractFileSuffix = ".contract.json";
const docFileSuffix = ".md";
const requiredFields = ["id", "name", "version", "owners", "affectedRepos", "requiredFiles"];
const semverPattern = /^\d+\.\d+\.\d+$/;
const maturityLevels = {{CONTRACT_MATURITY_LEVELS_JSON}};
const workspaceRoot = path.resolve(repoRoot, {{WORKSPACE_ROOT_FROM_HARNESS_JSON}});
const sourceRoots = new Map([
  ["{{HARNESS_REPO_NAME}}", repoRoot],
  ...{{CONSUMER_CONFIG_JSON}}.map((consumer) => [consumer.name, path.resolve(workspaceRoot, consumer.workspacePath)]),
]);

function reportMaturityShape(maturity, label) {
  if (typeof maturity !== "object" || maturity === null || Array.isArray(maturity)) {
    return [`${label} must be an object with level, scope and limitations.`];
  }
  const findings = [];
  if (!maturityLevels.includes(maturity.level)) {
    findings.push(`${label}.level must be one of: ${maturityLevels.join(", ")}.`);
  }
  if (typeof maturity.scope !== "string" || !maturity.scope.trim()) {
    findings.push(`${label}.scope must be a non-empty string describing the bounded claim.`);
  }
  if (!Array.isArray(maturity.limitations) || maturity.limitations.some((item) => typeof item !== "string" || !item.trim())) {
    findings.push(`${label}.limitations must be an array of non-empty strings (use [] when none are recorded).`);
  }
  for (const key of Object.keys(maturity)) {
    if (!["level", "scope", "limitations", "evidence", "governance"].includes(key)) findings.push(`${label}.${key} is not allowed.`);
  }
  return findings;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

// Stable key ordering makes a checkpoint independent of JSON formatting.
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sourceKey(source) {
  return JSON.stringify([source.repo, source.path]);
}

const digestPattern = /^[a-f0-9]{64}$/;
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function recordShape(value, fields, label, findings) {
  if (!record(value)) {
    findings.push(`${label} must be an object; record or refresh the bounded evidence/checkpoint.`);
    return false;
  }
  for (const [key, valid] of Object.entries(fields)) {
    if (!valid(value[key])) findings.push(`${label}.${key} is missing or invalid; record a matching value.`);
  }
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(fields, key)) findings.push(`${label}.${key} is not allowed.`);
  }
  return true;
}

function sourcesShape(sources, label, findings, snapshots = true) {
  if (!Array.isArray(sources) || sources.length === 0) {
    findings.push(`${label} must list at least one exact source file (no globs).`);
    return false;
  }
  const start = findings.length;
  const seen = new Set();
  for (const [index, source] of sources.entries()) {
    const fields = { repo: nonempty, path: nonempty };
    if (snapshots) fields.sha256 = (value) => typeof value === "string" && digestPattern.test(value);
    if (!recordShape(source, fields, `${label}[${index}]`, findings)) continue;
    const key = sourceKey(source);
    if (seen.has(key)) findings.push(`${label}: duplicate source ${key}; list each source once.`);
    seen.add(key);
  }
  return findings.length === start;
}

async function sourceBytes(source) {
  const root = sourceRoots.get(source.repo);
  if (!root) throw new Error(`unknown repo ${source.repo}; use the harness name or a configured consumer name`);
  if (!nonempty(source.path) || path.isAbsolute(source.path) || source.path.includes("\\") || /[*?\[\]]/.test(source.path) ||
      source.path.split("/").some((segment) => ["", ".", "..", ".git"].includes(segment))) {
    throw new Error("use an exact repository-relative file path without traversal, .git or globs");
  }
  const target = path.resolve(root, source.path);
  const canonicalRoot = await realpath(root);
  const canonicalTarget = await realpath(target);
  if (!isSameOrInsidePath(canonicalTarget, canonicalRoot) ||
      path.relative(canonicalRoot, canonicalTarget).split(path.sep).includes(".git") ||
      !(await stat(canonicalTarget)).isFile()) {
    throw new Error("source must resolve to a regular file inside its declared repository");
  }
  return readFile(canonicalTarget);
}

async function sourceDigest(source) {
  return sha256(await sourceBytes(source));
}

async function reportMaturityEvidence(maturity, manifestPath) {
  const findings = [];
  const label = `${manifestPath}.maturity`;
  const strong = ["C4 Validated", "C5 Governed"].includes(maturity.level);
  if (!strong && !Object.hasOwn(maturity, "evidence") && !Object.hasOwn(maturity, "governance")) return findings;
  const evidence = maturity.evidence;
  const evidenceShape = [];
  if (recordShape(evidence, {
    sources: Array.isArray,
    documentationSha256: (value) => typeof value === "string" && digestPattern.test(value),
    check: nonempty, observation: nonempty, result: (value) => value === "pass",
    limitations: (value) => Array.isArray(value) && value.length > 0 && value.every(nonempty),
  }, `${label}.evidence`, evidenceShape)) {
    sourcesShape(evidence.sources, `${label}.evidence.sources`, evidenceShape);
  }
  findings.push(...evidenceShape);
  const docPath = manifestPath.replace(contractFileSuffix, docFileSuffix);
  let documentationDigest;
  let documentation;
  try {
    const bytes = await sourceBytes({ repo: "{{HARNESS_REPO_NAME}}", path: docPath });
    documentationDigest = sha256(bytes);
    documentation = bytes.toString("utf8");
  } catch (error) {
    findings.push(`${label}.evidence: cannot read sibling documentation ${docPath}: ${error.message}.`);
  }
  if (evidenceShape.length === 0) {
    if (documentationDigest !== evidence.documentationSha256) {
      findings.push(`${label}.evidence.documentationSha256 is stale; review ${docPath} and refresh the evidence.`);
    }
    for (const source of evidence.sources) {
      try {
        if (await sourceDigest(source) !== source.sha256) {
          findings.push(`${label}.evidence source ${sourceKey(source)} is stale; rerun the declared check and refresh its observation and hash.`);
        }
      } catch (error) {
        findings.push(`${label}.evidence source ${sourceKey(source)} unavailable: ${error.message}; restore the source or narrow the claim.`);
      }
    }
  }
  if (maturity.level !== "C5 Governed") {
    if (Object.hasOwn(maturity, "governance")) findings.push(`${label}.governance is inactive; only C5 Governed opts into blocking enforcement.`);
    return findings;
  }
  if (evidenceShape.length === 0 && documentation !== undefined) {
    const marker = `<!-- structor:contract-sources-sha256 ${sha256(canonicalJson(evidence.sources))} -->`;
    const markers = documentation.split(/\r?\n/).filter((line) => line.startsWith("<!-- structor:contract-sources-sha256 "));
    if (markers.length !== 1 || markers[0] !== marker) {
      findings.push(`${label}: documentation source fingerprint is missing or stale; review ${docPath}, refresh its single ${marker} line, then refresh evidence.documentationSha256.`);
    }
  }
  const governance = maturity.governance;
  const governanceShape = [];
  if (recordShape(governance, { surfaces: Array.isArray, baseline: record }, `${label}.governance`, governanceShape)) {
    sourcesShape(governance.surfaces, `${label}.governance.surfaces`, governanceShape, false);
    if (recordShape(governance.baseline, {
      sources: Array.isArray,
      documentationSha256: (value) => typeof value === "string" && digestPattern.test(value),
      evidenceSha256: (value) => typeof value === "string" && digestPattern.test(value),
    }, `${label}.governance.baseline`, governanceShape)) {
      sourcesShape(governance.baseline.sources, `${label}.governance.baseline.sources`, governanceShape);
    }
  }
  findings.push(...governanceShape);
  if (governanceShape.length > 0) {
    findings.push(`${label}: C5 requires an explicit governed surface list and complete baseline; record a reviewed checkpoint before claiming governance.`);
    return findings;
  }
  const baseline = new Map(governance.baseline.sources.map((source) => [sourceKey(source), source.sha256]));
  const evidenceSources = new Map(evidenceShape.length === 0 ? evidence.sources.map((source) => [sourceKey(source), source.sha256]) : []);
  const surfaceKeys = new Set(governance.surfaces.map(sourceKey));
  if (baseline.size !== surfaceKeys.size || [...baseline.keys()].some((key) => !surfaceKeys.has(key))) {
    findings.push(`${label}.governance.baseline is stale: its source set must exactly match governed surfaces; review scope and record a complete checkpoint.`);
  }
  let changed = false;
  for (const surface of governance.surfaces) {
    const key = sourceKey(surface);
    try {
      const current = await sourceDigest(surface);
      if (current !== baseline.get(key)) changed = true;
      if (current !== evidenceSources.get(key)) findings.push(`${label}: governed surface ${key} requires matching current evidence; rerun the check and refresh evidence.sources.`);
    } catch (error) {
      findings.push(`${label}: governed surface ${key} unavailable: ${error.message}; restore it or explicitly review a scope change.`);
    }
  }
  if (changed) {
    if (documentationDigest === governance.baseline.documentationSha256) {
      findings.push(`${label}: governed surfaces changed without documentation updates; review and update ${docPath}, then refresh evidence.documentationSha256.`);
    }
    if (sha256(canonicalJson(evidence ?? null)) === governance.baseline.evidenceSha256) {
      findings.push(`${label}: governed surfaces changed without evidence updates; rerun the declared check and record a new observation.`);
    }
  }
  return findings;
}

function absolutePath(relativePath) {
  return path.join(repoRoot, relativePath);
}

async function fileExists(relativePath) {
  try {
    await access(absolutePath(relativePath), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function reportContractShape(manifest, label) {
  const findings = [];
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return [`${label} must be a JSON object.`];
  }

  for (const field of requiredFields) {
    if (!Object.hasOwn(manifest, field)) {
      findings.push(`${label} is missing '${field}'.`);
    }
  }
  if (typeof manifest.version === "string" && !semverPattern.test(manifest.version)) {
    findings.push(`${label}.version must use semver-like x.y.z.`);
  }
  for (const field of ["owners", "affectedRepos", "requiredFiles"]) {
    if (!Array.isArray(manifest[field]) || manifest[field].length === 0) {
      findings.push(`${label}.${field} must be a non-empty array.`);
    }
  }
  if (Object.hasOwn(manifest, "maturity")) {
    findings.push(...reportMaturityShape(manifest.maturity, `${label}.maturity`));
  }

  return findings;
}

const errors = [];
const warnings = [];
const entries = await readdir(absolutePath(contractsDirectory), { withFileTypes: true });
const readme = await readFile(absolutePath(contractsReadmePath), "utf8");

for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(docFileSuffix) && item.name !== "README.md")) {
  if (!readme.includes(entry.name)) {
    errors.push(`${contractsDirectory}/${entry.name} is not linked from ${contractsReadmePath}.`);
  }
}

for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(contractFileSuffix))) {
  const relativePath = `${contractsDirectory}/${entry.name}`;
  try {
    const manifest = JSON.parse(await readFile(absolutePath(relativePath), "utf8"));
    const shapeFindings = reportContractShape(manifest, relativePath);
    errors.push(...shapeFindings);
    if (shapeFindings.length === 0 && manifest.maturity) {
      const findings = await reportMaturityEvidence(manifest.maturity, relativePath);
      const destination = manifest.maturity.level === "C5 Governed" ? errors : warnings;
      destination.push(...findings);
    }
    for (const requiredFile of manifest.requiredFiles ?? []) {
      if (!(await fileExists(requiredFile))) {
        errors.push(`${relativePath} requires missing file ${requiredFile}.`);
      }
    }
  } catch {
    errors.push(`${relativePath} must be valid JSON.`);
  }

  const docPath = `${relativePath.replace(contractFileSuffix, docFileSuffix)}`;
  if (!(await fileExists(docPath))) {
    errors.push(`${relativePath} must have a sibling ${docPath}.`);
  }
}

for (const warning of warnings) console.warn(`- Advisory: ${warning}`);

if (errors.length > 0) {
  console.error("Contract manifest check failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Contract manifest check passed (bounded file evidence and opt-in C5 policy only; maturity claims are not verified as prose or runtime behavior).");
