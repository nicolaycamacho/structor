import { test } from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  exactApprovalAcknowledgement,
  installationPlanHash,
} from "../scripts/agent-native-contract.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(packageRoot, "bin/structor.mjs");

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

test("manual agent CLI uses the same no-write plan/apply contract", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "structor-agent-cli-"));
  const workspaceRoot = path.join(fixtureRoot, "workspace");
  const consumerRoot = path.join(workspaceRoot, "app");
  const draftPath = path.join(fixtureRoot, "config-draft.json");
  const planPath = path.join(fixtureRoot, "installation-plan.json");
  const approvalPath = path.join(fixtureRoot, "approval-receipt.json");
  await mkdir(consumerRoot, { recursive: true });
  await writeFile(path.join(consumerRoot, "package.json"), '{"name":"cli-app"}\n');
  await writeFile(draftPath, `${JSON.stringify({
    profile: "focused",
    project: { name: "CLI", slug: "cli", harnessRepoName: "cli-structor" },
    output: { path: "./cli-structor" },
    models: { openai: true, anthropic: false },
    clientSupport: {
      codex: { hooks: true },
      claude: { rules: false, hooks: false, skills: false },
    },
    consumers: [{
      name: "app",
      path: "./app",
      purpose: "CLI application",
      validation: {},
    }],
  }, null, 2)}\n`);

  try {
    const planned = spawnSync(process.execPath, [
      cliPath,
      "agent",
      "plan",
      "--workspace", workspaceRoot,
      "--config-draft", draftPath,
      "--plan-id", "setup-cli-001",
      "--source-revision", "0123456789abcdef0123456789abcdef01234567",
      "--planned-at", "2026-07-26T15:00:00.000Z",
    ], { encoding: "utf8" });
    assert.equal(planned.status, 0, planned.stderr);
    const plan = JSON.parse(planned.stdout);
    assert.equal(await exists(path.join(workspaceRoot, "cli-structor")), false);
    await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`);
    await writeFile(approvalPath, `${JSON.stringify({
      contractVersion: plan.contractVersion,
      schemaVersion: plan.schemaVersion,
      planHash: installationPlanHash(plan),
      approvedAt: "2026-07-26T15:01:00.000Z",
      acknowledgement: exactApprovalAcknowledgement,
    }, null, 2)}\n`);

    const applied = spawnSync(process.execPath, [
      cliPath,
      "agent",
      "apply",
      "--workspace", workspaceRoot,
      "--config-draft", draftPath,
      "--plan", planPath,
      "--approval", approvalPath,
      "--executed-at", "2026-07-26T15:02:00.000Z",
    ], { encoding: "utf8" });
    assert.equal(applied.status, 0, applied.stderr);
    assert.equal(await exists(path.join(workspaceRoot, "cli-structor/ai/context.md")), true);
    assert.equal(
      await exists(path.join(workspaceRoot, "evidence/setup/setup-cli-001/manifest.json")),
      true,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
