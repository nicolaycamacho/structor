import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertApprovedInstallationPlan,
  assertCompleteEvidenceManifest,
  canonicalJson,
  installationPlanHash,
} from "../scripts/agent-native-contract.mjs";
import { validateJsonSchema } from "../scripts/lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function samplePlan() {
  return {
    contractVersion: "1.0.0",
    schemaVersion: "1.0.0",
    planId: "setup-2026-07-22-001",
    structor: {
      packageVersion: "0.2.4",
      sourceRevision: "def585a428d86e7c9dcda32b5d5890c2c843b976",
    },
    scope: {
      workspace: ".",
      consumers: ["apps/web"],
    },
    decisions: [
      { id: "consumer-repositories", level: "explicit", selection: "apps/web", provenance: [] },
      { id: "project-identity", level: "explicit", selection: "demo", provenance: [] },
      { id: "topology", level: "explicit", selection: "workspace", provenance: [] },
      { id: "enabled-clients", level: "explicit", selection: "codex", provenance: [] },
      { id: "existing-guidance", level: "explicit", selection: "preserve", provenance: [] },
    ],
    reads: [{ path: "apps/web/package.json", reason: "Detect declared scripts" }],
    writes: [{
      path: "demo-structor/ai/context.md",
      action: "create",
      precondition: { kind: "absent" },
      contentHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    }],
    commands: [{ cwd: "demo-structor", command: "npm run validate", phase: "validation" }],
    preservation: {
      backupRequired: false,
      existingGuidance: [],
      backups: [],
      rollbackStrategy: {
        trigger: "filesystem-or-structor-invariant-failure",
        removeCreatedPaths: true,
        restoreBackups: true,
      },
    },
    population: {
      approvedConsumers: ["apps/web"],
      automaticPromotions: [],
      reviewRequiredClaims: [],
    },
    validationGates: [{ id: "governance", required: true, command: "node scripts/validate-governance.mjs" }],
    evidenceOutputs: [
      "evidence/setup/setup-2026-07-22-001/installation-plan.json",
      "evidence/setup/setup-2026-07-22-001/approval-receipt.json",
      "evidence/setup/setup-2026-07-22-001/result.json",
      "evidence/setup/setup-2026-07-22-001/manifest.json",
      "evidence/setup/setup-2026-07-22-001/report.md",
    ],
  };
}

test("installation plans have a stable hash independent of object key insertion order", () => {
  const plan = samplePlan();
  const reordered = {
    ...plan,
    structor: {
      sourceRevision: plan.structor.sourceRevision,
      packageVersion: plan.structor.packageVersion,
    },
  };

  assert.equal(canonicalJson(plan), canonicalJson(reordered));
  assert.match(installationPlanHash(plan), /^sha256:[a-f0-9]{64}$/);
  assert.equal(installationPlanHash(plan), installationPlanHash(reordered));
});

test("approval is bound to the exact immutable installation plan", () => {
  const plan = samplePlan();
  const receipt = {
    contractVersion: "1.0.0",
    schemaVersion: "1.0.0",
    planHash: installationPlanHash(plan),
    approvedAt: "2026-07-22T12:00:00.000Z",
    acknowledgement: "I approve this exact installation plan.",
  };

  assert.doesNotThrow(() => assertApprovedInstallationPlan(plan, receipt));
  assert.throws(
    () => assertApprovedInstallationPlan(plan, { ...receipt, acknowledgement: "approved" }),
    /explicit acknowledgement/,
  );
  assert.throws(
    () => assertApprovedInstallationPlan({ ...plan, writes: [] }, receipt),
    /approval receipt does not match installation plan hash/,
  );
  const incompleteEvidence = { ...plan, evidenceOutputs: [plan.evidenceOutputs[3]] };
  const incompleteReceipt = { ...receipt, planHash: installationPlanHash(incompleteEvidence) };
  assert.throws(
    () => assertApprovedInstallationPlan(incompleteEvidence, incompleteReceipt),
    /canonical evidence output/,
  );
  const substitutedManifest = {
    ...plan,
    evidenceOutputs: plan.evidenceOutputs.map((outputPath) => (
      outputPath.endsWith("/manifest.json") ? outputPath.replace("manifest.json", "debug.json") : outputPath
    )),
  };
  const substitutedReceipt = { ...receipt, planHash: installationPlanHash(substitutedManifest) };
  assert.throws(
    () => assertApprovedInstallationPlan(substitutedManifest, substitutedReceipt),
    /canonical evidence output manifest\.json/,
  );
  const scatteredEvidence = {
    ...plan,
    evidenceOutputs: plan.evidenceOutputs.map((outputPath) => (
      outputPath.endsWith("/result.json") ? "evidence/setup/other-run/result.json" : outputPath
    )),
  };
  const scatteredReceipt = { ...receipt, planHash: installationPlanHash(scatteredEvidence) };
  assert.throws(
    () => assertApprovedInstallationPlan(scatteredEvidence, scatteredReceipt),
    /canonical evidence output result\.json/,
  );
  const { contentHash: omittedContentHash, ...writeWithoutHash } = plan.writes[0];
  assert.ok(omittedContentHash);
  const unhashedWrite = { ...plan, writes: [writeWithoutHash] };
  const unhashedReceipt = { ...receipt, planHash: installationPlanHash(unhashedWrite) };
  assert.throws(
    () => assertApprovedInstallationPlan(unhashedWrite, unhashedReceipt),
    /deterministic content hash/,
  );
  const unsafeReplacement = {
    ...plan,
    writes: [{ ...plan.writes[0], action: "replace", precondition: { kind: "absent" } }],
  };
  const unsafeReplacementReceipt = { ...receipt, planHash: installationPlanHash(unsafeReplacement) };
  assert.throws(
    () => assertApprovedInstallationPlan(unsafeReplacement, unsafeReplacementReceipt),
    /expected-before content hash/,
  );
  const unbackedReplacement = {
    ...plan,
    writes: [{
      ...plan.writes[0],
      action: "replace",
      precondition: {
        kind: "content-hash",
        contentHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    }],
  };
  const unbackedReplacementReceipt = { ...receipt, planHash: installationPlanHash(unbackedReplacement) };
  assert.throws(
    () => assertApprovedInstallationPlan(unbackedReplacement, unbackedReplacementReceipt),
    /matching backup declaration/,
  );
});

test("canonical plan hashing rejects values outside the JSON data model", () => {
  assert.throws(() => canonicalJson({ unsafe: undefined }), /undefined is not canonical JSON/);
  assert.throws(() => canonicalJson({ unsafe: Number.NaN }), /non-finite numbers are not canonical JSON/);
});

test("versioned setup evidence fixtures conform to the public artifact schemas", async () => {
  const artifactFixtures = {
    "installation-plan": "installation-plan.json",
    "approval-receipt": "approval-receipt.json",
    "execution-result": "result.json",
    "setup-evidence-manifest": "setup-evidence-manifest.json",
  };

  for (const [artifactName, fixtureName] of Object.entries(artifactFixtures)) {
    const schema = JSON.parse(await readFile(path.join(repoRoot, "schemas", `${artifactName}.schema.json`), "utf8"));
    const fixture = JSON.parse(
      await readFile(path.join(repoRoot, "fixtures/agent-native/valid", fixtureName), "utf8"),
    );
    const errors = [];
    validateJsonSchema(fixture, schema, artifactName, errors);
    assert.deepEqual(errors, [], `${artifactName}:\n${errors.join("\n")}`);
  }
});

test("agent installation contract documents the supported flow and reconciled foundations", async () => {
  const contract = await readFile(path.join(repoRoot, "INSTALL_WITH_AGENT.md"), "utf8");
  const requiredSections = [
    "## Release Gate",
    "## Version Pinning",
    "## Discovery And Read Scope",
    "## Decisions And Consent",
    "## Installation Plan",
    "## Approval Receipt",
    "## Execution Result",
    "## Population And Evidence",
    "## Failure, Rollback, And Readiness",
    "## Delegation And Active Skills",
    "## Manual-Flow Parity",
    "## Final Report",
  ];

  assert.match(contract, /Status: supported and recommended/i);
  assert.match(contract, /#88[\s\S]*#100[\s\S]*#105[\s\S]*#107/);
  assert.match(contract, /does not run or orchestrate agents/i);
  assert.match(contract, /structor agent plan/);
  assert.match(contract, /structor agent apply/);
  for (const section of requiredSections) assert.ok(contract.includes(section), `Missing ${section}`);
});

test("installation plan schema rejects reads outside repository-relative scope", async () => {
  const schema = JSON.parse(await readFile(path.join(repoRoot, "schemas/installation-plan.schema.json"), "utf8"));
  const fixture = JSON.parse(
    await readFile(path.join(repoRoot, "fixtures/agent-native/valid/installation-plan.json"), "utf8"),
  );
  fixture.reads[0].path = "/private/source.env";
  const errors = [];

  validateJsonSchema(fixture, schema, "installation-plan", errors);

  assert.ok(errors.some((error) => error.includes("installation-plan.reads[0].path must match")));
});

test("installation plans cannot roll back for consumer validation failures", async () => {
  const schema = JSON.parse(await readFile(path.join(repoRoot, "schemas/installation-plan.schema.json"), "utf8"));
  const fixture = JSON.parse(
    await readFile(path.join(repoRoot, "fixtures/agent-native/valid/installation-plan.json"), "utf8"),
  );
  fixture.preservation.rollbackStrategy.trigger = "any-required-gate-failure";
  const errors = [];

  validateJsonSchema(fixture, schema, "installation-plan", errors);

  assert.ok(errors.some((error) => error.includes("rollbackStrategy.trigger")));

  fixture.preservation.rollbackStrategy.trigger = "filesystem-or-structor-invariant-failure";
  fixture.preservation.rollbackStrategy.restoreBackups = false;
  errors.length = 0;
  validateJsonSchema(fixture, schema, "installation-plan", errors);
  assert.ok(errors.some((error) => error.includes("rollbackStrategy.restoreBackups")));
});

test("result and evidence schemas reject absolute or traversing paths", async () => {
  const fixtureRoot = path.join(repoRoot, "fixtures/agent-native/valid");
  const cases = [
    ["execution-result", "result.json", (fixture) => { fixture.actualWrites[0].path = "/tmp/leak"; }],
    ["setup-evidence-manifest", "setup-evidence-manifest.json", (fixture) => { fixture.evidence[0].sourcePath = "../secret"; }],
  ];

  for (const [schemaName, fixtureName, mutate] of cases) {
    const schema = JSON.parse(await readFile(path.join(repoRoot, "schemas", `${schemaName}.schema.json`), "utf8"));
    const fixture = JSON.parse(await readFile(path.join(fixtureRoot, fixtureName), "utf8"));
    mutate(fixture);
    const errors = [];
    validateJsonSchema(fixture, schema, schemaName, errors);
    assert.ok(errors.some((error) => error.includes("must match")), `${schemaName} accepted an unsafe path`);
  }
});

test("evidence manifests require confidence and one copy of each canonical artifact", async () => {
  const fixtureRoot = path.join(repoRoot, "fixtures/agent-native/valid");
  const schema = JSON.parse(await readFile(path.join(repoRoot, "schemas/setup-evidence-manifest.schema.json"), "utf8"));
  const manifest = JSON.parse(await readFile(path.join(fixtureRoot, "setup-evidence-manifest.json"), "utf8"));
  const missingConfidence = structuredClone(manifest);
  delete missingConfidence.evidence[0].confidence;
  const errors = [];
  validateJsonSchema(missingConfidence, schema, "setup-evidence-manifest", errors);
  assert.ok(errors.some((error) => error.includes("confidence")));

  assert.doesNotThrow(() => assertCompleteEvidenceManifest(manifest));
  const duplicate = structuredClone(manifest);
  duplicate.artifacts[2] = duplicate.artifacts[1];
  assert.throws(() => assertCompleteEvidenceManifest(duplicate), /canonical artifact .* exactly once/);
});

test("setup evidence fixture binds the approved plan and every reported artifact", async () => {
  const fixtureRoot = path.join(repoRoot, "fixtures/agent-native/valid");
  const repositoryRoot = path.join(repoRoot, "fixtures/agent-native/repository");
  const plan = JSON.parse(await readFile(path.join(fixtureRoot, "installation-plan.json"), "utf8"));
  const receipt = JSON.parse(await readFile(path.join(fixtureRoot, "approval-receipt.json"), "utf8"));
  const result = JSON.parse(await readFile(path.join(fixtureRoot, "result.json"), "utf8"));
  const manifest = JSON.parse(await readFile(path.join(fixtureRoot, "setup-evidence-manifest.json"), "utf8"));

  assert.doesNotThrow(() => assertApprovedInstallationPlan(plan, receipt));
  assert.equal(result.planHash, receipt.planHash);
  assert.equal(manifest.planHash, receipt.planHash);
  assert.doesNotThrow(() => assertCompleteEvidenceManifest(manifest));
  assert.deepEqual(
    result.actualWrites,
    plan.writes.map((write) => ({ path: write.path, contentHash: write.contentHash })),
  );
  const packageEvidence = manifest.evidence.find((entry) => entry.id === "package-name");
  const packageContent = await readFile(path.join(repositoryRoot, packageEvidence.sourcePath));
  assert.equal(
    packageEvidence.contentHash,
    `sha256:${createHash("sha256").update(packageContent).digest("hex")}`,
  );
  const packageJson = JSON.parse(packageContent);
  const projectIdentity = plan.decisions.find((decision) => decision.id === "project-identity");
  assert.equal(packageJson.name, projectIdentity.selection);
  const expectedRoot = path.join(repoRoot, "fixtures/agent-native/expected");
  for (const write of plan.writes) {
    const expectedContent = await readFile(path.join(expectedRoot, write.path));
    assert.equal(write.contentHash, `sha256:${createHash("sha256").update(expectedContent).digest("hex")}`);
  }
  for (const artifact of manifest.artifacts) {
    const content = await readFile(path.join(fixtureRoot, artifact.path));
    const actualHash = `sha256:${createHash("sha256").update(content).digest("hex")}`;
    assert.equal(artifact.hash, actualHash, artifact.path);
  }

  const report = await readFile(path.join(fixtureRoot, "report.md"), "utf8");
  for (const heading of ["Versions", "Detected Facts", "Decisions And Provenance", "Plan And Approval", "Changes", "Validation", "Population", "Outcome And Readiness", "Risks And Recovery"]) {
    assert.ok(report.includes(`## ${heading}`), `report.md is missing ${heading}`);
  }
  assert.match(report, /Evidence bundle: `evidence\/setup\/setup-fixture-001`/);
  for (const command of result.commands) {
    assert.ok(report.includes(`Command: \`${command.command}\` (cwd: \`${command.cwd}\`, status: \`${command.status}\`)`));
  }
});
test("versioned protocol conformance fixtures cover coordinator boundaries and readiness", async () => {
  const fixture = JSON.parse(
    await readFile(path.join(repoRoot, "fixtures/agent-native/protocol-conformance.json"), "utf8"),
  );
  const scenarios = new Map(fixture.scenarios.map((scenario) => [scenario.id, scenario]));
  const protocol = await readFile(path.join(repoRoot, "INSTALL_WITH_AGENT.md"), "utf8");

  assert.equal(fixture.version, "1.0.0");
  assert.deepEqual(
    scenarios.get("decision-classification").expected.levels,
    {
      consumerRepositories: "recommended-confirmed",
      projectIdentity: "recommended-confirmed",
      topology: "recommended-confirmed",
      enabledClients: "explicit",
      existingGuidance: "explicit",
    },
  );
  assert.deepEqual(scenarios.get("delegation-conflict").expected.writes, []);
  assert.equal(scenarios.get("delegation-conflict").expected.action, "escalate-conflict");
  assert.match(protocol, /bounded read-only discovery or analysis only/i);
  assert.match(protocol, /Material conflicts return to the coordinator/i);
  assert.equal(scenarios.get("active-skill-conflict").expected.action, "stop-before-planning");
  assert.match(protocol, /Discovery must stop if any required instruction would trigger edits/i);
  assert.deepEqual(scenarios.get("forbidden-read-boundary").expected.allowed, ["consumer/package.json"]);
  assert.deepEqual(scenarios.get("forbidden-read-boundary").expected.writes, []);
  for (const forbidden of scenarios.get("forbidden-read-boundary").expected.forbidden) {
    const requiredBoundary = forbidden.includes("src/")
      ? /source bodies/i
      : forbidden.includes(".env")
        ? /credentials/i
        : /unrelated sibling repositories/i;
    assert.match(protocol, requiredBoundary, forbidden);
  }
  assert.deepEqual(scenarios.get("consumer-readiness").expected, {
    executionOutcome: "applied",
    readiness: "ready_with_warnings",
    rollback: false,
  });
  assert.match(protocol, /consumer lint, test, build, or optional readiness failure[\s\S]*does not by itself roll back setup/i);
});
