import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  applyAgentNativeSetup,
  planAgentNativeSetup,
} from "../scripts/agent-native-setup.mjs";
import {
  exactApprovalAcknowledgement,
  installationPlanHash,
} from "../scripts/agent-native-contract.mjs";
const repoRoot = path.resolve(".");
const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();


async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
async function filesUnder(rootPath, currentPath = rootPath) {
  const files = [];
  for (const entry of await readdir(currentPath, { withFileTypes: true })) {
    const targetPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await filesUnder(rootPath, targetPath));
    } else if (entry.isFile()) {
      files.push(path.relative(rootPath, targetPath).replaceAll(path.sep, "/"));
    }
  }
  return files.sort();
}


function sha256(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

async function withWorkspace(run) {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "structor-agent-native-"));
  const consumerRoot = path.join(workspaceRoot, "app");
  const harnessRoot = path.join(workspaceRoot, "demo-structor");
  const configPath = path.join(harnessRoot, "harness.config.json");
  await mkdir(consumerRoot, { recursive: true });
  await writeFile(path.join(consumerRoot, "package.json"), `${JSON.stringify({
    name: "demo-app",
    description: "Evidence-backed demo",
    scripts: { test: "node --version" },
  }, null, 2)}\n`);
  const config = {
    workspace: { root: ".." },
    profile: "focused",
    project: { name: "Demo", slug: "demo", harnessRepoName: "demo-structor" },
    output: { path: "./demo-structor" },
    models: { openai: true, anthropic: false },
    clientSupport: {
      codex: { hooks: true },
      claude: { rules: false, hooks: false, skills: false },
    },
    consumers: [{
      name: "app",
      path: "./app",
      purpose: "Primary application",
      validation: { test: "node --version" },
    }],
  };

  try {
    await run({ workspaceRoot, consumerRoot, harnessRoot, configPath, config });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

test("agent-native setup binds approval to a no-write plan and emits a verifiable evidence journey", async () => {
  await withWorkspace(async ({ workspaceRoot, consumerRoot, harnessRoot, configPath, config }) => {
    const filesBeforePlan = await filesUnder(workspaceRoot);
    const plan = await planAgentNativeSetup({
      config,
      configPath,
      planId: "setup-test-001",
      sourceRevision,
      plannedAt: "2026-07-26T12:00:00.000Z",
    });

    assert.equal(await exists(harnessRoot), false, "planning must not mutate the selected workspace");
    assert.ok(plan.writes.some((write) => write.path === "demo-structor/ai/context.md"));
    assert.ok(plan.writes.some((write) => write.path === "AGENTS.md"));
    assert.ok(plan.writes.some((write) => write.path === "demo-structor/.structor/manifest.json"));
    assert.deepEqual(plan.evidenceOutputs, [
      "evidence/setup/setup-test-001/installation-plan.json",
      "evidence/setup/setup-test-001/approval-receipt.json",
      "evidence/setup/setup-test-001/result.json",
      "evidence/setup/setup-test-001/report.md",
      "evidence/setup/setup-test-001/manifest.json",
    ]);

    const receipt = {
      contractVersion: plan.contractVersion,
      schemaVersion: plan.schemaVersion,
      planHash: installationPlanHash(plan),
      approvedAt: "2026-07-26T12:01:00.000Z",
      acknowledgement: exactApprovalAcknowledgement,
    };
    await assert.rejects(
      () => applyAgentNativeSetup({
        plan,
        receipt: { ...receipt, planHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        config,
        configPath,
        executedAt: "2026-07-26T12:02:00.000Z",
      }),
      /approval receipt does not match installation plan hash/,
    );
    assert.equal(await exists(harnessRoot), false, "rejected approval must not mutate the workspace");
    const packagePath = path.join(consumerRoot, "package.json");
    const packageBeforeDrift = await readFile(packagePath, "utf8");
    await writeFile(packagePath, packageBeforeDrift.replace("demo-app", "drifted-app"));
    await assert.rejects(
      () => applyAgentNativeSetup({
        plan,
        receipt,
        config,
        configPath,
        executedAt: "2026-07-26T12:02:00.000Z",
      }),
      /no longer matches the current config, source state, or rendered writes/,
    );
    assert.equal(await exists(harnessRoot), false, "source drift must be rejected before mutation");
    await writeFile(packagePath, packageBeforeDrift);


    const execution = await applyAgentNativeSetup({
      plan,
      receipt,
      config,
      configPath,
      executedAt: "2026-07-26T12:02:00.000Z",
    });

    assert.equal(execution.result.executionOutcome, "applied");
    assert.equal(execution.result.readiness, "ready_with_warnings");
    assert.match(await readFile(path.join(harnessRoot, "ai/context.md"), "utf8"), /demo-app/);

    const bundleRoot = path.join(workspaceRoot, "evidence/setup/setup-test-001");
    for (const artifact of ["installation-plan.json", "approval-receipt.json", "result.json", "manifest.json", "report.md"]) {
      assert.equal(await exists(path.join(bundleRoot, artifact)), true, artifact);
    }
    const newSetupFiles = (await filesUnder(workspaceRoot))
      .filter((file) => !filesBeforePlan.includes(file))
      .filter((file) => !file.startsWith("evidence/"));
    assert.deepEqual(
      newSetupFiles,
      plan.writes.map((write) => write.path).sort(),
    );
    const manifest = JSON.parse(await readFile(path.join(bundleRoot, "manifest.json"), "utf8"));
    for (const artifact of manifest.artifacts) {
      const content = await readFile(path.join(bundleRoot, artifact.path));
      assert.equal(artifact.hash, sha256(content), artifact.path);
    }
    assert.equal(plan.commands.at(-1).phase, "consumer-validation");
    assert.equal(execution.result.commands.at(-1).status, "passed");
    assert.equal(execution.result.validationOutcomes.at(-1).status, "passed");
    assert.doesNotMatch(await readFile(path.join(harnessRoot, "ai/context.md"), "utf8"), /Evidence-backed demo/);
    assert.equal(manifest.planHash, receipt.planHash);
    assert.equal(manifest.sanitized, true);
    assert.doesNotMatch(JSON.stringify(manifest), new RegExp(workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

test("agent-native setup reports structural rollback independently from readiness", async () => {
  await withWorkspace(async ({ workspaceRoot, harnessRoot, configPath, config }) => {
    const plan = await planAgentNativeSetup({
      config,
      configPath,
      planId: "setup-rollback-001",
      sourceRevision,
      plannedAt: "2026-07-26T13:00:00.000Z",
    });
    const receipt = {
      contractVersion: plan.contractVersion,
      schemaVersion: plan.schemaVersion,
      planHash: installationPlanHash(plan),
      approvedAt: "2026-07-26T13:01:00.000Z",
      acknowledgement: exactApprovalAcknowledgement,
    };

    const execution = await applyAgentNativeSetup({
      plan,
      receipt,
      config,
      configPath,
      executedAt: "2026-07-26T13:02:00.000Z",
      executeGeneratedScript: async () => {
        throw new Error("injected structural gate failure");
      },
    });

    assert.equal(execution.result.executionOutcome, "rolled_back");
    assert.equal(execution.result.readiness, "blocked");
    assert.deepEqual(execution.result.rollback, {
      attempted: true,
      completed: true,
      restoredPaths: plan.writes.map((write) => write.path),
    });
    assert.equal(execution.result.commands[0].status, "failed");
    assert.equal(execution.result.commands[1].status, "skipped");
    assert.equal(execution.result.validationOutcomes[0].status, "skipped");
    assert.equal(await exists(harnessRoot), false);
    assert.equal(
      await exists(path.join(workspaceRoot, "evidence/setup/setup-rollback-001/result.json")),
      true,
    );
  });
});

test("agent-native setup plans and preserves existing root guidance byte-for-byte", async () => {
  await withWorkspace(async ({ workspaceRoot, consumerRoot, harnessRoot, configPath, config }) => {
    const originalGuidance = "# Existing agent guidance\n\nKeep this local rule.\n";
    await writeFile(path.join(consumerRoot, "AGENTS.md"), originalGuidance);
    const plan = await planAgentNativeSetup({
      config,
      configPath,
      planId: "setup-preserve-001",
      sourceRevision,
      plannedAt: "2026-07-26T14:00:00.000Z",
    });
    const preservedPath = "app/.structor/preserved-guidance/setup-preserve-001/AGENTS.md";

    assert.equal(
      plan.decisions.find((decision) => decision.id === "existing-guidance").selection,
      "preserve",
    );
    assert.ok(plan.writes.some((write) => write.path === preservedPath));
    assert.ok(plan.writes.some((write) =>
      write.path === "app/.structor/preserved-guidance/setup-preserve-001/README.md"));
    assert.ok(plan.reads.some((read) =>
      read.path === "app/AGENTS.md"
      && read.reason.includes("preserve approved existing root guidance")));
    assert.deepEqual(
      plan.preservation.backups.find((backup) => backup.sourcePath === "app/AGENTS.md"),
      { sourcePath: "app/AGENTS.md", backupPath: preservedPath },
    );
    assert.equal(await exists(path.join(workspaceRoot, preservedPath)), false);

    const receipt = {
      contractVersion: plan.contractVersion,
      schemaVersion: plan.schemaVersion,
      planHash: installationPlanHash(plan),
      approvedAt: "2026-07-26T14:01:00.000Z",
      acknowledgement: exactApprovalAcknowledgement,
    };
    const execution = await applyAgentNativeSetup({
      plan,
      receipt,
      config,
      configPath,
      executedAt: "2026-07-26T14:02:00.000Z",
    });

    assert.equal(execution.result.executionOutcome, "applied");
    assert.equal(await exists(path.join(harnessRoot, ".structor", "backups")), false);
    assert.equal(await readFile(path.join(workspaceRoot, preservedPath), "utf8"), originalGuidance);
    assert.match(await readFile(path.join(consumerRoot, "AGENTS.md"), "utf8"), /## Preserved Guidance/);
  });
});

test("agent-native setup rejects unmanaged harness or workspace replacement during planning", async () => {
  await withWorkspace(async ({ workspaceRoot, configPath, config }) => {
    const existingGuidance = "# Existing workspace guidance\n";
    const workspaceGuidancePath = path.join(workspaceRoot, "AGENTS.md");
    await writeFile(workspaceGuidancePath, existingGuidance);

    await assert.rejects(
      planAgentNativeSetup({
        config,
        configPath,
        planId: "setup-existing-workspace-001",
        sourceRevision,
        plannedAt: "2026-07-26T15:00:00.000Z",
      }),
      /has no deterministic preservation path/,
    );
    assert.equal(await readFile(workspaceGuidancePath, "utf8"), existingGuidance);
  });
});
test("agent-native setup rejects unsafe plan IDs and source revision drift before mutation", async () => {
  await withWorkspace(async ({ harnessRoot, configPath, config }) => {
    await assert.rejects(
      planAgentNativeSetup({
        config,
        configPath,
        planId: "../escape",
        sourceRevision,
        plannedAt: "2026-07-26T16:00:00.000Z",
      }),
      /plan ID must contain only lowercase letters, digits, and hyphens/,
    );
    await assert.rejects(
      planAgentNativeSetup({
        config,
        configPath,
        planId: "setup-source-drift-001",
        sourceRevision: "0000000000000000000000000000000000000000",
        plannedAt: "2026-07-26T16:00:00.000Z",
      }),
      /does not match the executing Structor checkout/,
    );
    assert.equal(await exists(harnessRoot), false);
  });
});

test("consumer validation failures are reported without rolling back structural setup", async () => {
  await withWorkspace(async ({ workspaceRoot, harnessRoot, configPath, config }) => {
    const failingConfig = structuredClone(config);
    failingConfig.consumers[0].validation.test = `${process.execPath} -e "process.exit(1)"`;
    const plan = await planAgentNativeSetup({
      config: failingConfig,
      configPath,
      planId: "setup-consumer-failure-001",
      sourceRevision,
      plannedAt: "2026-07-26T17:00:00.000Z",
    });
    const receipt = {
      contractVersion: plan.contractVersion,
      schemaVersion: plan.schemaVersion,
      planHash: installationPlanHash(plan),
      approvedAt: "2026-07-26T17:01:00.000Z",
      acknowledgement: exactApprovalAcknowledgement,
    };

    const execution = await applyAgentNativeSetup({
      plan,
      receipt,
      config: failingConfig,
      configPath,
      executedAt: "2026-07-26T17:02:00.000Z",
    });

    assert.equal(execution.result.executionOutcome, "applied");
    assert.equal(execution.result.readiness, "ready_with_warnings");
    assert.deepEqual(execution.result.rollback, {
      attempted: false,
      completed: false,
      restoredPaths: [],
    });
    assert.equal(execution.result.commands.at(-1).status, "failed");
    assert.equal(execution.result.validationOutcomes.at(-1).status, "failed");
    assert.match(execution.result.unresolvedRisks.at(-1), /Consumer validation failed/);
    assert.equal(await exists(harnessRoot), true);
    assert.equal(
      await exists(path.join(workspaceRoot, "evidence/setup/setup-consumer-failure-001/result.json")),
      true,
    );
  });
});
