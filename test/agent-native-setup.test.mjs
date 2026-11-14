import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, readdir, rm, symlink, writeFile, mkdir } from "node:fs/promises";
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
const protocolFixture = JSON.parse(
  await readFile(path.join(repoRoot, "fixtures/agent-native/protocol-conformance.json"), "utf8"),
);


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

    const expectedLevels = protocolFixture.scenarios
      .find((scenario) => scenario.id === "decision-classification").expected.levels;
    assert.deepEqual(
      Object.fromEntries(plan.decisions
        .filter((decision) => ["consumer-repositories", "project-identity", "topology", "enabled-clients", "existing-guidance"].includes(decision.id))
        .map((decision) => [decision.id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), decision.level])),
      expectedLevels,
    );
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
    const report = await readFile(path.join(bundleRoot, "report.md"), "utf8");
    for (const heading of ["Changes And Preservation", "Rollback", "Risks And Recovery"]) {
      assert.ok(report.includes(`## ${heading}`), heading);
    }
    assert.match(report, /Recovery requires inspecting preserved paths/);
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
    assert.equal(execution.result.commands.at(-1).status, "skipped");
    assert.equal(execution.result.validationOutcomes.at(-1).status, "skipped");
    assert.match(execution.result.unresolvedRisks.at(-1), /Consumer validation skipped/);
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

test("agent-native setup plans and preserves existing workspace guidance", async () => {
  await withWorkspace(async ({ workspaceRoot, configPath, config }) => {
    const original = "# Existing workspace guidance\n";
    const target = path.join(workspaceRoot, "AGENTS.md");
    await writeFile(target, original);
    const plan = await planAgentNativeSetup({ config, configPath, sourceRevision,
      planId: "setup-workspace-001", plannedAt: "2026-11-14T10:00:00.000Z" });
    const backup = plan.preservation.backups.find((item) => item.sourcePath === "AGENTS.md");
    assert.ok(backup);
    assert.equal(await exists(path.join(workspaceRoot, backup.backupPath)), false);
    assert.equal(await readFile(target, "utf8"), original);
    const execution = await applyAgentNativeSetup({ plan, receipt: approvalFor(plan), config, configPath });
    assert.equal(execution.result.executionOutcome, "applied");
    assert.equal(await readFile(path.join(workspaceRoot, backup.backupPath), "utf8"), original);
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

test("consumer validation with unconstrained effects is skipped without rolling back structural setup", async () => {
  await withWorkspace(async ({ workspaceRoot, harnessRoot, configPath, config }) => {
    const unsafeConfig = structuredClone(config);
    unsafeConfig.consumers[0].validation.test = "curl https://example.com/check";
    const plan = await planAgentNativeSetup({
      config: unsafeConfig,
      configPath,
      planId: "setup-consumer-skip-001",
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
      config: unsafeConfig,
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
    assert.equal(execution.result.commands.at(-1).status, "skipped");
    assert.equal(execution.result.validationOutcomes.at(-1).status, "skipped");
    assert.match(execution.result.validationOutcomes.at(-1).reason, /effects cannot be constrained/);
    assert.match(execution.result.unresolvedRisks.at(-1), /Consumer validation skipped/);
    assert.equal(await exists(harnessRoot), true);
    assert.equal(
      await exists(path.join(workspaceRoot, "evidence/setup/setup-consumer-skip-001/result.json")),
      true,
    );
  });
});


test("agent-native setup rejects symlinked evidence targets before mutation", async () => {
  await withWorkspace(async ({ workspaceRoot, harnessRoot, configPath, config }) => {
    const plan = await planAgentNativeSetup({
      config,
      configPath,
      planId: "setup-evidence-symlink-001",
      sourceRevision,
      plannedAt: "2026-07-26T19:00:00.000Z",
    });
    const receipt = {
      contractVersion: plan.contractVersion,
      schemaVersion: plan.schemaVersion,
      planHash: installationPlanHash(plan),
      approvedAt: "2026-07-26T19:01:00.000Z",
      acknowledgement: exactApprovalAcknowledgement,
    };
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "structor-evidence-outside-"));
    try {
      await symlink(outsideRoot, path.join(workspaceRoot, "evidence"), "dir");
      await assert.rejects(
        applyAgentNativeSetup({ plan, receipt, config, configPath }),
        /symlinked write targets/,
      );
      assert.equal(await exists(harnessRoot), false);
      assert.deepEqual(await readdir(outsideRoot), []);
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });
});

function approvalFor(plan) {
  return {
    contractVersion: plan.contractVersion,
    schemaVersion: plan.schemaVersion,
    planHash: installationPlanHash(plan),
    approvedAt: "2026-11-14T10:01:00.000Z",
    acknowledgement: exactApprovalAcknowledgement,
  };
}

test("expanded agent setup approves every generated byte without planning writes", async () => {
  await withWorkspace(async ({ workspaceRoot, harnessRoot, configPath, config }) => {
    config.profile = "expanded";
    config.models.anthropic = true;
    const before = await filesUnder(workspaceRoot);
    const plan = await planAgentNativeSetup({
      config, configPath, sourceRevision,
      planId: "setup-expanded-001",
      plannedAt: "2026-11-14T10:00:00.000Z",
    });
    assert.deepEqual(await filesUnder(workspaceRoot), before);
    for (const name of ["index", "plans", "contracts", "readiness", "quality", "workspace"]) {
      assert.ok(plan.writes.some((write) => write.path === `demo-structor/ai/views/${name}.html`));
    }
    const execution = await applyAgentNativeSetup({ plan, receipt: approvalFor(plan), config, configPath });
    assert.equal(execution.result.executionOutcome, "applied");
    assert.equal(execution.result.readiness, "ready_with_warnings");
    const added = (await filesUnder(workspaceRoot)).filter((file) => !before.includes(file) && !file.startsWith("evidence/"));
    assert.deepEqual(added, plan.writes.map((write) => write.path).sort());
    for (const write of plan.writes) {
      assert.equal(sha256(await readFile(path.join(workspaceRoot, write.path))), write.contentHash, write.path);
    }
    execFileSync(process.execPath, ["scripts/check-html-views.mjs"], { cwd: harnessRoot });
  });
});

for (const profile of ["focused", "expanded"]) {
  test(`${profile} regeneration binds backups and before hashes to approval and rolls back`, async () => {
    await withWorkspace(async ({ workspaceRoot, harnessRoot, configPath, config }) => {
      config.profile = profile;
      const options = { config, configPath, sourceRevision, plannedAt: "2026-11-14T10:00:00.000Z" };
      const initial = await planAgentNativeSetup({ ...options, planId: `setup-${profile}-initial` });
      assert.equal((await applyAgentNativeSetup({ plan: initial, receipt: approvalFor(initial), config, configPath })).result.executionOutcome, "applied");
      const editedPath = path.join(harnessRoot, "ai/context.md");
      await writeFile(editedPath, "# User context that must survive in the backup\n");
      if (profile === "expanded") {
        await writeFile(path.join(harnessRoot, "ai/plans/active/custom.md"), "# Consumer plan\n\nStatus: active\n");
      }
      const pathsBefore = await filesUnder(workspaceRoot);
      const bytesBefore = new Map(await Promise.all(pathsBefore.map(async (file) => [file, await readFile(path.join(workspaceRoot, file))])));
      const plan = await planAgentNativeSetup({ ...options, planId: `setup-${profile}-regenerate` });
      assert.deepEqual(await filesUnder(workspaceRoot), pathsBefore, "planning must not write backups or outputs");
      const replacements = plan.writes.filter((write) => write.action === "replace");
      assert.ok(replacements.length > 10);
      assert.equal(plan.preservation.backups.length, replacements.length);
      for (const write of replacements) {
        assert.equal(write.precondition.contentHash, sha256(bytesBefore.get(write.path)), write.path);
        const backup = plan.preservation.backups.find((item) => item.sourcePath === write.path);
        assert.ok(backup, write.path);
        const backupWrite = plan.writes.find((item) => item.path === backup.backupPath);
        assert.equal(backupWrite.action, "create");
        assert.equal(backupWrite.contentHash, write.precondition.contentHash);
      }
      await writeFile(editedPath, "drift after approval\n");
      await assert.rejects(() => applyAgentNativeSetup({ plan, receipt: approvalFor(plan), config, configPath }), /no longer matches/);
      assert.deepEqual(await filesUnder(workspaceRoot), pathsBefore, "drift rejection must not create files");
      await writeFile(editedPath, bytesBefore.get("demo-structor/ai/context.md"));
      const failed = await applyAgentNativeSetup({ plan, receipt: approvalFor(plan), config, configPath,
        executeGeneratedScript: async () => { throw new Error("Injected structural failure"); } });
      assert.equal(failed.result.executionOutcome, "rolled_back");
      assert.equal(failed.result.rollback.completed, true);
      for (const [file, content] of bytesBefore) {
        assert.deepEqual(await readFile(path.join(workspaceRoot, file)), content, file);
      }
      const remaining = (await filesUnder(workspaceRoot)).filter((file) => !file.startsWith(`evidence/setup/${plan.planId}/`));
      assert.deepEqual(remaining, pathsBefore, "failed attempt must remove new backup files");
      const retry = await planAgentNativeSetup({ ...options, planId: `setup-${profile}-retry` });
      const applied = await applyAgentNativeSetup({ plan: retry, receipt: approvalFor(retry), config, configPath });
      assert.equal(applied.result.executionOutcome, "applied");
      assert.equal(applied.result.readiness, "ready_with_warnings");
      for (const backup of retry.preservation.backups) {
        assert.deepEqual(await readFile(path.join(workspaceRoot, backup.backupPath)), bytesBefore.get(backup.sourcePath), backup.sourcePath);
      }
      for (const write of retry.writes) {
        assert.equal(sha256(await readFile(path.join(workspaceRoot, write.path))), write.contentHash, write.path);
      }
      await assert.rejects(() => planAgentNativeSetup({ ...options, planId: retry.planId }), /already exists.*fresh plan ID/);
      if (profile === "expanded") {
        assert.ok(retry.reads.some((read) => read.path === "demo-structor/ai/plans/active/custom.md"));
        execFileSync(process.execPath, ["scripts/check-html-views.mjs"], { cwd: harnessRoot });
      }
    });
  });
}

test("agent setup supports a non-Node consumer without inventing manifest evidence", async () => {
  await withWorkspace(async ({ consumerRoot, configPath, config }) => {
    await rm(path.join(consumerRoot, "package.json"));
    await writeFile(path.join(consumerRoot, "pyproject.toml"), '[project]\nname = "python-app"\n');
    const plan = await planAgentNativeSetup({ config, configPath, sourceRevision,
      planId: "setup-python-001", plannedAt: "2026-11-14T10:00:00.000Z" });
    assert.deepEqual(plan.population.automaticPromotions, []);
    assert.ok(!plan.reads.some((read) => read.path === "app/package.json"));
    const execution = await applyAgentNativeSetup({ plan, receipt: approvalFor(plan), config, configPath });
    assert.equal(execution.result.executionOutcome, "applied");
    assert.deepEqual(execution.manifest.evidence, []);
  });
});

test("agent setup rejects occupied or symlinked backup destinations before mutation", async () => {
  await withWorkspace(async ({ workspaceRoot, configPath, config }) => {
    await writeFile(path.join(workspaceRoot, "AGENTS.md"), "# Existing\n");
    const root = path.join(workspaceRoot, ".structor/backups/setup-backup-001-agent-native-setup");
    await mkdir(root, { recursive: true });
    const target = path.join(root, "AGENTS.md");
    await writeFile(target, "keep existing backup\n");
    const options = { config, configPath, sourceRevision, planId: "setup-backup-001", plannedAt: "2026-11-14T10:00:00.000Z" };
    await assert.rejects(() => planAgentNativeSetup(options), /already exists.*fresh plan ID/);
    assert.equal(await readFile(target, "utf8"), "keep existing backup\n");
    await rm(target);
    await symlink(path.join(workspaceRoot, "AGENTS.md"), target);
    await assert.rejects(() => planAgentNativeSetup(options), /symlinked write targets/);
    assert.equal(await readFile(path.join(workspaceRoot, "AGENTS.md"), "utf8"), "# Existing\n");
  });
});
