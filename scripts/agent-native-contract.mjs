import { createHash } from "node:crypto";

export const agentNativeContractVersion = "1.0.0";
export const installationPlanSchemaVersion = "1.0.0";
export const exactApprovalAcknowledgement = "I approve this exact installation plan.";
export const canonicalEvidenceArtifactPaths = Object.freeze([
  "installation-plan.json",
  "approval-receipt.json",
  "result.json",
  "report.md",
]);
export const canonicalInstallationEvidenceOutputPaths = Object.freeze([
  ...canonicalEvidenceArtifactPaths,
  "manifest.json",
]);
export const requiredInstallationDecisionIds = Object.freeze([
  "consumer-repositories",
  "project-identity",
  "topology",
  "enabled-clients",
  "existing-guidance",
]);

function canonicalJsonValue(value, location, ancestors) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${location}: non-finite numbers are not canonical JSON.`);
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError(`${location}: ${typeof value} is not canonical JSON.`);
  }
  if (ancestors.has(value)) {
    throw new TypeError(`${location}: cyclic values are not canonical JSON.`);
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const entries = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new TypeError(`${location}[${index}]: sparse arrays are not canonical JSON.`);
        }
        entries.push(canonicalJsonValue(value[index], `${location}[${index}]`, ancestors));
      }
      return `[${entries.join(",")}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${location}: only plain objects are canonical JSON.`);
    }
    const entries = Object.keys(value).sort().map((key) => {
      const rendered = canonicalJsonValue(value[key], `${location}.${key}`, ancestors);
      return `${JSON.stringify(key)}:${rendered}`;
    });
    return `{${entries.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalJson(value) {
  return canonicalJsonValue(value, "value", new Set());
}

export function installationPlanHash(plan) {
  return `sha256:${createHash("sha256").update(canonicalJson(plan)).digest("hex")}`;
}

export function assertCompleteInstallationPlan(plan) {
  for (const requiredId of requiredInstallationDecisionIds) {
    const occurrences = plan?.decisions?.filter((decision) => decision.id === requiredId).length ?? 0;
    if (occurrences !== 1) {
      throw new Error(`Installation plan must contain decision ${requiredId} exactly once.`);
    }
  }
  const evidenceBundleRoot = `evidence/setup/${plan?.planId ?? "missing"}`;
  for (const requiredPath of canonicalInstallationEvidenceOutputPaths) {
    const occurrences = plan?.evidenceOutputs?.filter((outputPath) => {
      const normalizedPath = outputPath.replaceAll("\\", "/");
      return normalizedPath === `${evidenceBundleRoot}/${requiredPath}`;
    }).length ?? 0;
    if (occurrences !== 1) {
      throw new Error(`Installation plan must contain canonical evidence output ${requiredPath} exactly once.`);
    }
  }
  for (const write of plan?.writes ?? []) {
    if (!/^sha256:[a-f0-9]{64}$/.test(write.contentHash ?? "")) {
      throw new Error(`Installation plan write ${write.path ?? "missing"} lacks a deterministic content hash.`);
    }
    if (write.action === "create") {
      if (write.precondition?.kind !== "absent" || Object.hasOwn(write.precondition, "contentHash")) {
        throw new Error(`Installation plan create ${write.path} must require an absent target.`);
      }
    } else if (write.precondition?.kind !== "content-hash"
        || !/^sha256:[a-f0-9]{64}$/.test(write.precondition?.contentHash ?? "")) {
      throw new Error(`Installation plan ${write.action} ${write.path} lacks an expected-before content hash.`);
    }
  }
  const replacementPaths = (plan?.writes ?? [])
    .filter((write) => write.action === "replace")
    .map((write) => write.path);
  const backups = plan?.preservation?.backups ?? [];
  if (replacementPaths.length > 0 && plan?.preservation?.backupRequired !== true) {
    throw new Error("Every replacement requires backupRequired and a matching backup declaration.");
  }
  for (const replacementPath of replacementPaths) {
    const occurrences = backups.filter((backup) => backup.sourcePath === replacementPath).length;
    if (occurrences !== 1) {
      throw new Error(`Replacement ${replacementPath} requires exactly one matching backup declaration.`);
    }
  }
  for (const backup of backups) {
    const occurrences = replacementPaths.filter((replacementPath) => replacementPath === backup.sourcePath).length;
    if (occurrences !== 1) {
      throw new Error(`Backup ${backup.sourcePath ?? "missing"} has no matching replacement declaration.`);
    }
  }
  if (replacementPaths.length === 0 && plan?.preservation?.backupRequired !== false) {
    throw new Error("backupRequired must be false when the plan contains no replacements.");
  }
  if (plan?.preservation?.rollbackStrategy?.trigger !== "filesystem-or-structor-invariant-failure"
      || plan?.preservation?.rollbackStrategy?.removeCreatedPaths !== true
      || plan?.preservation?.rollbackStrategy?.restoreBackups !== true) {
    throw new Error("Installation plan must configure automatic filesystem and Structor-invariant rollback.");
  }
}

export function assertApprovedInstallationPlan(plan, receipt) {
  assertCompleteInstallationPlan(plan);
  if (plan?.contractVersion !== agentNativeContractVersion) {
    throw new Error(`Unsupported installation contract version: ${plan?.contractVersion ?? "missing"}.`);
  }
  if (plan?.schemaVersion !== installationPlanSchemaVersion) {
    throw new Error(`Unsupported installation plan schema version: ${plan?.schemaVersion ?? "missing"}.`);
  }
  if (receipt?.contractVersion !== plan.contractVersion || receipt?.schemaVersion !== plan.schemaVersion) {
    throw new Error("Approval receipt version does not match the installation plan.");
  }
  if (receipt?.acknowledgement !== exactApprovalAcknowledgement) {
    throw new Error("Approval receipt is missing the explicit acknowledgement for the exact installation plan.");
  }
  if (receipt?.planHash !== installationPlanHash(plan)) {
    throw new Error("approval receipt does not match installation plan hash.");
  }
}

export function assertCompleteEvidenceManifest(manifest) {
  const artifactPaths = manifest?.artifacts?.map((artifact) => artifact.path) ?? [];
  for (const requiredPath of canonicalEvidenceArtifactPaths) {
    const occurrences = artifactPaths.filter((artifactPath) => artifactPath === requiredPath).length;
    if (occurrences !== 1) {
      throw new Error(`Evidence manifest must contain canonical artifact ${requiredPath} exactly once.`);
    }
  }
}
