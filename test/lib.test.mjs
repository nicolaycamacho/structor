import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  assertConfirmedConsumerRepository,
  assertSafeConsumerPath,
  assertSafeOutputRoot,
  assertSafeWriteTarget,
  canonicalPathForWrite,
  isSameOrInsidePath,
  pathContainsSegment,
  resolveHarnessConfig,
  validateConfigShape,
  validateJsonSchema,
  workspaceRootForConfig,
} from "../scripts/lib.mjs";

async function withTempDir(run) {
  const dir = await mkdtemp(path.join(tmpdir(), "structor-lib-test-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("isSameOrInsidePath accepts identical paths", () => {
  assert.equal(isSameOrInsidePath("/workspace/app", "/workspace/app"), true);
});

test("isSameOrInsidePath accepts child paths", () => {
  assert.equal(isSameOrInsidePath("/workspace/app/sub", "/workspace/app"), true);
});

test("isSameOrInsidePath rejects siblings and parents", () => {
  assert.equal(isSameOrInsidePath("/workspace/other", "/workspace/app"), false);
  assert.equal(isSameOrInsidePath("/workspace", "/workspace/app"), false);
});

test("pathContainsSegment matches path segments only", () => {
  assert.equal(pathContainsSegment("/workspace/repo/.git/harness", ".git"), true);
  assert.equal(pathContainsSegment("/workspace/gitignored/harness", ".git"), false);
});

function safeConsumerCall(consumerPath, extra = {}) {
  const workspaceRoot = extra.workspaceRoot ?? "/workspace";
  const outputRoot = extra.outputRoot ?? "/workspace/product-structor";
  return () =>
    assertSafeConsumerPath({
      consumerName: "product-app",
      consumerPath,
      workspaceRoot,
      outputRoot,
      repoRoot: extra.repoRoot ?? "/tpl/structor",
    });
}

test("assertSafeConsumerPath accepts workspace-relative consumer repo paths", () => {
  assert.equal(safeConsumerCall("./product-app")(), "/workspace/product-app");
  assert.equal(safeConsumerCall("apps/product-app")(), "/workspace/apps/product-app");
});

test("assertSafeConsumerPath rejects absolute, traversal, and root paths", () => {
  assert.throws(safeConsumerCall("/tmp/product-app"), /absolute consumer paths/);
  assert.throws(safeConsumerCall("../product-app"), /relative traversal/);
  assert.throws(safeConsumerCall("apps/../product-app"), /relative traversal/);
  assert.throws(safeConsumerCall("."), /workspace root/);
});

test("assertSafeConsumerPath rejects template, output, and .git paths", () => {
  assert.throws(safeConsumerCall("./structor", { repoRoot: "/workspace/structor" }), /Structor template repo/);
  assert.throws(safeConsumerCall("./product-structor/app"), /generated harness output/);
  assert.throws(safeConsumerCall("./product-app/.git/hooks"), /\.git path segment/);
});

test("assertConfirmedConsumerRepository accepts directories with repo signals", async () => {
  await withTempDir(async (root) => {
    const workspaceRoot = path.join(root, "workspace");
    const consumerRoot = path.join(workspaceRoot, "product-app");
    await mkdir(path.join(consumerRoot, ".git"), { recursive: true });

    assert.equal(
      await assertConfirmedConsumerRepository({
        consumerName: "product-app",
        consumerRoot,
        workspaceRoot,
        outputRoot: path.join(workspaceRoot, "product-structor"),
        repoRoot: path.join(workspaceRoot, "structor"),
      }),
      await realpath(consumerRoot),
    );
  });
});

test("assertConfirmedConsumerRepository rejects existing non-repo directories", async () => {
  await withTempDir(async (root) => {
    const workspaceRoot = path.join(root, "workspace");
    const consumerRoot = path.join(workspaceRoot, "product-app");
    await mkdir(consumerRoot, { recursive: true });

    await assert.rejects(
      () =>
        assertConfirmedConsumerRepository({
          consumerName: "product-app",
          consumerRoot,
          workspaceRoot,
          outputRoot: path.join(workspaceRoot, "product-structor"),
          repoRoot: path.join(workspaceRoot, "structor"),
        }),
      /not a confirmed consumer repository/,
    );
  });
});

test("assertConfirmedConsumerRepository rejects symlinked consumer paths", async () => {
  await withTempDir(async (root) => {
    const workspaceRoot = path.join(root, "workspace");
    const outsideRoot = path.join(root, "outside-app");
    const consumerRoot = path.join(workspaceRoot, "linked-app");
    await mkdir(workspaceRoot, { recursive: true });
    await mkdir(path.join(outsideRoot, ".git"), { recursive: true });
    await symlink(outsideRoot, consumerRoot, "dir");

    await assert.rejects(
      () =>
        assertConfirmedConsumerRepository({
          consumerName: "linked-app",
          consumerRoot,
          workspaceRoot,
          outputRoot: path.join(workspaceRoot, "product-structor"),
          repoRoot: path.join(workspaceRoot, "structor"),
        }),
      /symlinked consumer paths/,
    );
  });
});

const baseSafeOutputArgs = {
  repoRoot: "/tpl/structor",
  workspaceRoot: "/workspace",
  consumerRepos: ["/workspace/product-app"],
};

function safeOutputCall(outputPath, extra = {}) {
  const workspaceRoot = extra.workspaceRoot ?? baseSafeOutputArgs.workspaceRoot;
  const outputRoot = path.resolve(workspaceRoot, outputPath);
  return () =>
    assertSafeOutputRoot({
      ...baseSafeOutputArgs,
      ...extra,
      outputPath,
      outputRoot,
    });
}

test("workspaceRootForConfig uses the template parent for template-local configs", () => {
  assert.equal(workspaceRootForConfig("/workspace/structor", "/workspace/structor"), "/workspace");
  assert.equal(workspaceRootForConfig("/workspace", "/tooling/structor"), "/workspace");
});

test("canonicalPathForWrite resolves existing symlinks before missing leaf segments", async () => {
  await withTempDir(async (root) => {
    const realTarget = path.join(root, "real-target");
    const linkedParent = path.join(root, "linked-parent");
    await mkdir(realTarget);
    await symlink(realTarget, linkedParent, "dir");

    assert.equal(
      await canonicalPathForWrite(path.join(linkedParent, "generated")),
      path.join(await realpath(realTarget), "generated"),
    );
  });
});

test("assertSafeWriteTarget accepts non-symlink targets inside the root", async () => {
  await withTempDir(async (root) => {
    const writeRoot = path.join(root, "write-root");
    await mkdir(writeRoot);

    await assert.doesNotReject(() =>
      assertSafeWriteTarget({
        targetPath: path.join(writeRoot, "nested", "file.md"),
        rootPath: writeRoot,
        label: "Test write",
      }),
    );
  });
});

test("assertSafeWriteTarget rejects targets outside the root", async () => {
  await withTempDir(async (root) => {
    const writeRoot = path.join(root, "write-root");
    await mkdir(writeRoot);

    await assert.rejects(
      () =>
        assertSafeWriteTarget({
          targetPath: path.join(root, "outside.md"),
          rootPath: writeRoot,
          label: "Test write",
        }),
      /must stay inside/,
    );
  });
});

test("assertSafeWriteTarget rejects symlinked parent and leaf targets", async () => {
  await withTempDir(async (root) => {
    const writeRoot = path.join(root, "write-root");
    const outsideRoot = path.join(root, "outside");
    await mkdir(writeRoot);
    await mkdir(outsideRoot);
    await symlink(outsideRoot, path.join(writeRoot, "linked-parent"), "dir");
    await symlink(path.join(outsideRoot, "leaf.md"), path.join(writeRoot, "leaf.md"));

    await assert.rejects(
      () =>
        assertSafeWriteTarget({
          targetPath: path.join(writeRoot, "linked-parent", "file.md"),
          rootPath: writeRoot,
          label: "Test write",
        }),
      /symlinked write targets/,
    );
    await assert.rejects(
      () =>
        assertSafeWriteTarget({
          targetPath: path.join(writeRoot, "leaf.md"),
          rootPath: writeRoot,
          label: "Test write",
        }),
      /symlinked write targets/,
    );
  });
});

test("assertSafeOutputRoot accepts sibling output paths", async () => {
  await assert.doesNotReject(safeOutputCall("./product-structor"));
});

test("assertSafeOutputRoot rejects relative traversal outside the workspace boundary", async () => {
  await assert.rejects(safeOutputCall("../product-structor"), /workspace boundary/);
});

test("assertSafeOutputRoot rejects absolute paths unless explicitly allowed", async () => {
  await assert.rejects(safeOutputCall("/tmp/out"), /absolute output paths require/);
  await assert.doesNotReject(safeOutputCall("/workspace/out", { allowAbsoluteOutput: true }));
});

test("assertSafeOutputRoot rejects template, workspace, consumer, and .git paths", async () => {
  await assert.rejects(safeOutputCall("/tpl/structor", { allowAbsoluteOutput: true }), /template repo/);
  await assert.rejects(safeOutputCall("/tpl/structor/generated", { allowAbsoluteOutput: true }), /template repo/);
  await assert.rejects(safeOutputCall("."), /workspace root/);
  await assert.rejects(safeOutputCall("./product-app"), /consumer repo/);
  await assert.rejects(safeOutputCall("./product-app/harness"), /consumer repo/);
  await assert.rejects(safeOutputCall("./generated/.git/harness"), /\.git path segment/);
});

test("assertSafeOutputRoot rejects symlinked output roots", async () => {
  await withTempDir(async (root) => {
    const workspaceRoot = path.join(root, "workspace");
    const consumerRoot = path.join(workspaceRoot, "product-app");
    const outputRoot = path.join(workspaceRoot, "product-structor");
    await mkdir(consumerRoot, { recursive: true });
    await symlink(consumerRoot, outputRoot, "dir");

    await assert.rejects(
      () =>
        assertSafeOutputRoot({
          outputPath: "./product-structor",
          outputRoot,
          repoRoot: path.join(workspaceRoot, "structor"),
          workspaceRoot,
          consumerRepos: [consumerRoot],
        }),
      /symlinked output directories/,
    );
  });
});

test("assertSafeOutputRoot rejects symlinked output ancestors", async () => {
  await withTempDir(async (root) => {
    const workspaceRoot = path.join(root, "workspace");
    const outsideRoot = path.join(root, "outside");
    const linkedParent = path.join(workspaceRoot, "linked-parent");
    await mkdir(workspaceRoot, { recursive: true });
    await mkdir(outsideRoot);
    await symlink(outsideRoot, linkedParent, "dir");

    await assert.rejects(
      () =>
        assertSafeOutputRoot({
          outputPath: "./linked-parent/product-structor",
          outputRoot: path.join(linkedParent, "product-structor"),
          repoRoot: path.join(workspaceRoot, "structor"),
          workspaceRoot,
          consumerRepos: [path.join(workspaceRoot, "product-app")],
        }),
      /symlinked output directories/,
    );
  });
});

function validConfig() {
  return {
    project: { name: "Demo", slug: "demo", harnessRepoName: "demo-structor" },
    output: { path: "../demo-structor" },
    models: { openai: true, anthropic: false },
    consumers: [
      {
        name: "demo-app",
        path: "./demo-app",
        purpose: "App repo",
        validation: { lint: "npm run lint" },
      },
    ],
  };
}

test("validateConfigShape accepts a valid config", async () => {
  assert.deepEqual(await validateConfigShape(validConfig(), "config"), []);
});

test("validateConfigShape rejects no enabled models", async () => {
  const config = validConfig();
  config.models = { openai: false, anthropic: false };
  const errors = await validateConfigShape(config, "config");
  assert.ok(errors.some((error) => /at least one model provider/.test(error)));
});

test("validateConfigShape rejects a bad slug", async () => {
  const config = validConfig();
  config.project.slug = "Not A Slug";
  const errors = await validateConfigShape(config, "config");
  assert.ok(errors.some((error) => /slug/.test(error)));
});

test("validateConfigShape rejects duplicate consumer names", async () => {
  const config = validConfig();
  config.consumers.push({ ...config.consumers[0] });
  const errors = await validateConfigShape(config, "config");
  assert.ok(errors.some((error) => /duplicated/.test(error)));
});

test("validateConfigShape rejects unsafe consumer path syntax", async () => {
  const absoluteConfig = validConfig();
  absoluteConfig.consumers[0].path = "/tmp/demo-app";
  assert.ok((await validateConfigShape(absoluteConfig, "config")).some((error) => /absolute paths/.test(error)));

  const traversalConfig = validConfig();
  traversalConfig.consumers[0].path = "../demo-app";
  assert.ok((await validateConfigShape(traversalConfig, "config")).some((error) => /relative traversal/.test(error)));

  const rootConfig = validConfig();
  rootConfig.consumers[0].path = ".";
  assert.ok((await validateConfigShape(rootConfig, "config")).some((error) => /workspace root/.test(error)));
});

test("validateConfigShape rejects unknown top-level keys", async () => {
  const config = validConfig();
  config.unexpected = true;
  const errors = await validateConfigShape(config, "config");
  assert.ok(errors.some((error) => /not allowed/.test(error)));
});

test("validateConfigShape rejects deferred Claude rules support", async () => {
  const config = validConfig();
  config.models.anthropic = true;
  config.clientSupport = { claude: { rules: true } };
  const errors = await validateConfigShape(config, "config");
  assert.ok(errors.some((error) => /clientSupport\.claude\.rules/.test(error)));
});

test("validateJsonSchema enforces enum values", () => {
  const validErrors = [];
  validateJsonSchema("ready", { type: "string", enum: ["ready", "done"] }, "brief.status", validErrors);
  assert.deepEqual(validErrors, []);

  const invalidErrors = [];
  validateJsonSchema("running", { type: "string", enum: ["ready", "done"] }, "brief.status", invalidErrors);
  assert.ok(invalidErrors.some((error) => /brief\.status must be one of "ready", "done"/.test(error)));
});

test("validateJsonSchema rejects unsupported schema keywords", () => {
  const errors = [];
  validateJsonSchema(
    { status: "ready" },
    {
      type: "object",
      properties: {
        status: { type: "string", enum: ["ready"], default: "ready" },
      },
    },
    "brief",
    errors,
  );

  assert.ok(errors.some((error) => /brief\.status schema uses unsupported keyword default/.test(error)));
});

test("validateJsonSchema rejects schema-valued additionalProperties", () => {
  const errors = [];
  validateJsonSchema(
    { priority: 1 },
    {
      type: "object",
      additionalProperties: { type: "number", minimum: 1 },
    },
    "brief",
    errors,
  );

  assert.ok(errors.some((error) => /brief\.additionalProperties must be a boolean/.test(error)));
});

function resolvableConfig(overrides = {}) {
  return {
    project: { name: "Demo", slug: "demo", harnessRepoName: "demo-structor" },
    output: { path: "./demo-structor" },
    models: { openai: true, anthropic: false },
    consumers: [
      {
        name: "demo-app",
        path: "./demo-app",
        purpose: "App repo",
        validation: { lint: "npm run lint" },
      },
    ],
    ...overrides,
  };
}

test("resolveHarnessConfig returns support defaults and safe generation paths for valid config", async () => {
  await withTempDir(async (root) => {
    const workspaceRoot = path.join(root, "workspace");
    await mkdir(workspaceRoot, { recursive: true });
    const configPath = path.join(workspaceRoot, "harness.config.json");
    const templateRepoRoot = path.join(root, "structor");
    const resolved = await resolveHarnessConfig(resolvableConfig(), {
      label: "config",
      configPath,
      repoRoot: templateRepoRoot,
    });

    assert.equal(resolved.workspaceRoot, workspaceRoot);
    assert.equal(resolved.outputRoot, path.join(await realpath(workspaceRoot), "demo-structor"));
    assert.equal(resolved.consumers[0].root, path.join(await realpath(workspaceRoot), "demo-app"));
    assert.equal(resolved.consumers[0].requestedRoot, path.join(workspaceRoot, "demo-app"));
    assert.deepEqual(resolved.support, {
      codexHooks: true,
      claudeRules: false,
      claudeHooks: false,
      claudeSkills: false,
    });
  });
});

test("resolveHarnessConfig rejects no enabled models and duplicate consumer names", async () => {
  await withTempDir(async (root) => {
    const workspaceRoot = path.join(root, "workspace");
    await mkdir(workspaceRoot, { recursive: true });
    const configPath = path.join(workspaceRoot, "harness.config.json");

    await assert.rejects(
      () =>
        resolveHarnessConfig(resolvableConfig({ models: { openai: false, anthropic: false } }), {
          label: "config",
          configPath,
          repoRoot: path.join(root, "structor"),
        }),
      /at least one model provider/,
    );

    const duplicateConfig = resolvableConfig();
    duplicateConfig.consumers.push({ ...duplicateConfig.consumers[0] });
    await assert.rejects(
      () =>
        resolveHarnessConfig(duplicateConfig, {
          label: "config",
          configPath,
          repoRoot: path.join(root, "structor"),
        }),
      /duplicated/,
    );
  });
});

test("resolveHarnessConfig rejects unsafe consumer and output paths", async () => {
  await withTempDir(async (root) => {
    const workspaceRoot = path.join(root, "workspace");
    const templateRepoRoot = path.join(workspaceRoot, "structor");
    await mkdir(templateRepoRoot, { recursive: true });
    const configPath = path.join(workspaceRoot, "harness.config.json");

    const unsafeConsumerConfig = resolvableConfig();
    unsafeConsumerConfig.consumers[0].path = "./structor";
    await assert.rejects(
      () =>
        resolveHarnessConfig(unsafeConsumerConfig, {
          label: "config",
          configPath,
          repoRoot: templateRepoRoot,
        }),
      /Structor template repo/,
    );

    await assert.rejects(
      () =>
        resolveHarnessConfig(resolvableConfig({ output: { path: "./demo-app/generated" } }), {
          label: "config",
          configPath,
          repoRoot: templateRepoRoot,
        }),
      /configured consumer repo/,
    );
  });
});

test("resolveHarnessConfig derives workspace root for template-local configs", async () => {
  await withTempDir(async (root) => {
    const workspaceRoot = path.join(root, "workspace");
    const templateRepoRoot = path.join(workspaceRoot, "structor");
    await mkdir(templateRepoRoot, { recursive: true });
    const configPath = path.join(templateRepoRoot, "harness.config.json");
    const resolved = await resolveHarnessConfig(validConfig(), {
      label: "config",
      configPath,
      repoRoot: templateRepoRoot,
    });

    assert.equal(resolved.workspaceRoot, workspaceRoot);
    assert.equal(resolved.outputRoot, path.join(await realpath(workspaceRoot), "demo-structor"));
    assert.equal(resolved.consumers[0].root, path.join(await realpath(workspaceRoot), "demo-app"));
  });
});

test("resolveHarnessConfig honors explicit workspace root semantics for harness-local configs", async () => {
  await withTempDir(async (root) => {
    const workspaceRoot = path.join(root, "workspace");
    const harnessRoot = path.join(workspaceRoot, "demo-structor");
    await mkdir(harnessRoot, { recursive: true });
    const configPath = path.join(harnessRoot, "harness.config.json");
    const config = resolvableConfig({
      workspace: { root: ".." },
      output: { path: "./demo-structor" },
    });

    const resolved = await resolveHarnessConfig(config, {
      label: "config",
      configPath,
      repoRoot: path.join(root, "structor"),
    });

    assert.equal(await realpath(resolved.workspaceRoot), await realpath(workspaceRoot));
    assert.equal(await realpath(resolved.outputRoot), await realpath(harnessRoot));
    assert.equal(resolved.consumers[0].root, path.join(await realpath(workspaceRoot), "demo-app"));
  });
});

test("resolveHarnessConfig can require confirmed consumer repositories", async () => {
  await withTempDir(async (root) => {
    const workspaceRoot = path.join(root, "workspace");
    const consumerRoot = path.join(workspaceRoot, "demo-app");
    await mkdir(consumerRoot, { recursive: true });
    await writeFile(path.join(consumerRoot, "package.json"), `${JSON.stringify({ name: "demo-app" })}\n`);

    const resolved = await resolveHarnessConfig(resolvableConfig(), {
      label: "config",
      configPath: path.join(workspaceRoot, "harness.config.json"),
      repoRoot: path.join(root, "structor"),
      requireExistingConsumers: true,
    });

    assert.equal(resolved.consumers[0].confirmedRoot, await realpath(consumerRoot));
  });
});
