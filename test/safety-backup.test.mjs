import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { exists } from "../scripts/lib.mjs";
import { createSafetyBackup } from "../scripts/safety-backup.mjs";

async function withTempDir(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "structor-safety-backup-"));
  try {
    return await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("createSafetyBackup skips when no Structor-managed candidates exist", async () => {
  await withTempDir(async (workspaceRoot) => {
    const result = await createSafetyBackup({
      reason: "before-init",
      command: "init",
      workspaceRoot,
      detectedState: {
        hasStructorMetadata: false,
        hasGeneratedHarness: false,
        hasConsumerEntrypoints: false,
      },
      candidatePaths: [
        {
          sourcePath: path.join(workspaceRoot, "demo-structor"),
          backupPath: "harness",
        },
      ],
      structorVersion: "0.2.4",
      now: new Date("2026-06-12T15:30:44.000Z"),
    });

    assert.deepEqual(result, {
      created: false,
      backupPath: null,
      copiedPaths: [],
      skippedPaths: [],
    });
    assert.equal(await exists(path.join(workspaceRoot, ".structor")), false);
  });
});

test("createSafetyBackup snapshots managed state and records exclusions", async () => {
  await withTempDir(async (workspaceRoot) => {
    const harnessRoot = path.join(workspaceRoot, "demo-structor");
    const consumerRoot = path.join(workspaceRoot, "app");
    await mkdir(path.join(harnessRoot, "ai"), { recursive: true });
    await mkdir(path.join(harnessRoot, ".git"), { recursive: true });
    await mkdir(path.join(harnessRoot, "node_modules", "fixture"), { recursive: true });
    await mkdir(path.join(consumerRoot, ".structor", "preserved-guidance", "existing"), {
      recursive: true,
    });
    await mkdir(path.join(harnessRoot, "ai", "backups"), { recursive: true });
    await mkdir(path.join(workspaceRoot, ".structor"), { recursive: true });
    await writeFile(path.join(workspaceRoot, ".structor", "state.json"), "{\"ready\":true}\n");
    await writeFile(path.join(harnessRoot, "ai", "PRODUCT.md"), "# Mature product context\n");
    await writeFile(path.join(harnessRoot, ".git", "config"), "not backup material\n");
    await writeFile(path.join(harnessRoot, "node_modules", "fixture", "index.js"), "transient\n");
    await writeFile(path.join(harnessRoot, "ai", "backups", "recovery.md"), "keep me\n");
    await writeFile(path.join(consumerRoot, "AGENTS.md"), "# Existing consumer entrypoint\n");
    await writeFile(
      path.join(consumerRoot, ".structor", "preserved-guidance", "existing", "AGENTS.md"),
      "# Preserved guidance\n",
    );

    const detectedState = {
      hasStructorMetadata: true,
      hasGeneratedHarness: true,
      hasConsumerEntrypoints: true,
    };
    const result = await createSafetyBackup({
      reason: "before-init",
      command: "init",
      workspaceRoot,
      detectedState,
      candidatePaths: [
        { sourcePath: harnessRoot, backupPath: "harness" },
        {
          sourcePath: path.join(consumerRoot, "AGENTS.md"),
          backupPath: "consumer-entrypoints/app/AGENTS.md",
        },
        {
          sourcePath: path.join(consumerRoot, ".structor"),
          backupPath: "consumer-metadata/app/.structor",
        },
        {
          sourcePath: path.join(workspaceRoot, ".structor"),
          backupPath: "workspace-metadata/.structor",
        },
      ],
      structorVersion: "0.2.4",
      now: new Date("2026-06-12T15:30:44.000Z"),
    });

    const expectedBackupRoot = path.join(
      workspaceRoot,
      ".structor",
      "backups",
      "2026-06-12T15-30-44Z-before-init",
    );
    assert.equal(result.created, true);
    assert.equal(result.backupPath, expectedBackupRoot);
    assert.equal(
      await readFile(path.join(expectedBackupRoot, "harness", "ai", "PRODUCT.md"), "utf8"),
      "# Mature product context\n",
    );
    assert.equal(
      await readFile(
        path.join(expectedBackupRoot, "consumer-entrypoints", "app", "AGENTS.md"),
        "utf8",
      ),
      "# Existing consumer entrypoint\n",
    );
    assert.equal(
      await readFile(
        path.join(expectedBackupRoot, "harness", "ai", "backups", "recovery.md"),
        "utf8",
      ),
      "keep me\n",
    );
    assert.equal(
      await readFile(
        path.join(expectedBackupRoot, "workspace-metadata", ".structor", "state.json"),
        "utf8",
      ),
      "{\"ready\":true}\n",
    );
    assert.equal(
      await readFile(
        path.join(
          expectedBackupRoot,
          "consumer-metadata",
          "app",
          ".structor",
          "preserved-guidance",
          "existing",
          "AGENTS.md",
        ),
        "utf8",
      ),
      "# Preserved guidance\n",
    );
    assert.equal(await exists(path.join(expectedBackupRoot, "harness", ".git")), false);
    assert.equal(await exists(path.join(expectedBackupRoot, "harness", "node_modules")), false);

    const manifest = JSON.parse(
      await readFile(path.join(expectedBackupRoot, "manifest.json"), "utf8"),
    );
    assert.equal(manifest.createdAt, "2026-06-12T15:30:44.000Z");
    assert.equal(manifest.reason, "before-init");
    assert.equal(manifest.structorVersion, "0.2.4");
    assert.equal(manifest.command, "init");
    assert.equal(manifest.cwd, workspaceRoot);
    assert.deepEqual(manifest.detectedState, detectedState);
    assert.deepEqual(manifest.copiedPaths, [
      "demo-structor",
      "app/AGENTS.md",
      "app/.structor",
      ".structor",
    ]);
    assert.deepEqual(manifest.skippedPaths, [
      ".structor/backups",
      "demo-structor/.git",
      "demo-structor/node_modules",
    ]);
  });
});
