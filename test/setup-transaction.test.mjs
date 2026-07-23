import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { exists } from "../scripts/lib.mjs";
import {
  applySetupTransaction,
  planSetupTransaction,
} from "../scripts/setup-transaction.mjs";

async function withWorkspace(run) {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "structor-transaction-"));
  try {
    const consumerRoot = path.join(workspaceRoot, "product-app");
    await mkdir(consumerRoot, { recursive: true });
    await writeFile(path.join(consumerRoot, "package.json"), `${JSON.stringify({ name: "product-app" })}\n`);

    const config = {
      workspace: { root: ".." },
      project: {
        name: "Test Project",
        slug: "test-project",
        harnessRepoName: "test-structor",
      },
      output: { path: "./test-structor" },
      models: { openai: true, anthropic: false },
      clientSupport: { codex: { hooks: false } },
      consumers: [
        {
          name: "product-app",
          path: "./product-app",
          purpose: "Application repository",
          validation: {},
        },
      ],
    };
    const harnessRoot = path.join(workspaceRoot, "test-structor");
    const configPath = path.join(harnessRoot, "harness.config.json");
    return await run({ workspaceRoot, consumerRoot, harnessRoot, configPath, config });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

test("setup transaction reports completion only after all generated gates pass", async () => {
  await withWorkspace(async ({ config, configPath, harnessRoot }) => {
    const plan = await planSetupTransaction({ config, configPath });
    const result = await applySetupTransaction(plan);

    assert.equal(result.setupComplete, true);
    assert.deepEqual(result.completedScripts, [
      "scripts/bootstrap-workspace.mjs",
      "scripts/validate-governance.mjs",
      "scripts/check-workspace.mjs",
    ]);
    assert.equal(await exists(path.join(harnessRoot, "harness.config.json")), true);
  });
});

test("setup transaction rejects root guidance conflicts before writing without preservation consent", async () => {
  await withWorkspace(async ({ config, configPath, consumerRoot, harnessRoot, workspaceRoot }) => {
    const agentsPath = path.join(consumerRoot, "AGENTS.md");
    await writeFile(agentsPath, "# user-owned guidance\n");
    const plan = await planSetupTransaction({ config, configPath });

    await assert.rejects(
      () => applySetupTransaction(plan),
      /Existing root guidance files require explicit preservation consent/,
    );

    assert.equal(await readFile(agentsPath, "utf8"), "# user-owned guidance\n");
    assert.equal(await exists(harnessRoot), false);
    assert.equal(await exists(path.join(workspaceRoot, "AGENTS.md")), false);
  });
});

test("setup transaction rolls back created local files when a completion gate fails", async () => {
  await withWorkspace(async ({ config, configPath, consumerRoot, harnessRoot }) => {
    const plan = await planSetupTransaction({ config, configPath });
    const executeGeneratedScript = ({ harnessRoot: cwd, relativeScriptPath, args = [], failureLabel }) => {
      if (relativeScriptPath === "scripts/check-workspace.mjs") {
        throw new Error(failureLabel);
      }
      const result = spawnSync(process.execPath, [relativeScriptPath, ...args], {
        cwd,
        encoding: "utf8",
      });
      if (result.status !== 0) throw new Error(failureLabel);
    };

    await assert.rejects(
      () => applySetupTransaction(plan, { executeGeneratedScript }),
      /Workspace completion check failed/,
    );

    assert.equal(await exists(harnessRoot), false);
    assert.equal(await exists(path.join(consumerRoot, "AGENTS.md")), false);
  });
});

test("setup transaction restores a pre-existing preservation directory after failure", async () => {
  await withWorkspace(async ({ config, configPath, consumerRoot }) => {
    const preservationTimestamp = "2026-07-23T12-00-00";
    const preservationRoot = path.join(
      consumerRoot,
      ".structor",
      "preserved-guidance",
      preservationTimestamp,
    );
    const historicalPath = path.join(preservationRoot, "historical.md");
    const agentsPath = path.join(consumerRoot, "AGENTS.md");
    await mkdir(preservationRoot, { recursive: true });
    await writeFile(historicalPath, "# historical preservation\n");
    await writeFile(agentsPath, "# user-owned guidance\n");
    const plan = await planSetupTransaction({ config, configPath, preservationTimestamp });

    await assert.rejects(
      () => applySetupTransaction(plan, {
        preserveExistingGuidance: true,
        executeGeneratedScript: () => {
          throw new Error("forced completion failure");
        },
      }),
      /forced completion failure/,
    );

    assert.equal(await readFile(historicalPath, "utf8"), "# historical preservation\n");
    assert.equal(await exists(path.join(preservationRoot, "AGENTS.md")), false);
    assert.equal(await readFile(agentsPath, "utf8"), "# user-owned guidance\n");
  });
});

test("setup transaction removes generated view directories when an existing harness rolls back", async () => {
  await withWorkspace(async ({ config, configPath, harnessRoot }) => {
    const sentinelPath = path.join(harnessRoot, "sentinel.txt");
    await mkdir(harnessRoot, { recursive: true });
    await writeFile(sentinelPath, "keep\n");
    const plan = await planSetupTransaction({ config, configPath });

    await assert.rejects(
      () => applySetupTransaction(plan, {
        executeGeneratedScript: () => {
          throw new Error("forced completion failure");
        },
      }),
      /forced completion failure/,
    );

    assert.equal(await readFile(sentinelPath, "utf8"), "keep\n");
    assert.equal(await exists(path.join(harnessRoot, "ai", "views")), false);
  });
});
