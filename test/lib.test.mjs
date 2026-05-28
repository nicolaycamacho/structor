import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  assertSafeOutputRoot,
  isSameOrInsidePath,
  pathContainsSegment,
  validateConfigShape,
} from "../scripts/lib.mjs";

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

test("assertSafeOutputRoot accepts sibling output paths", () => {
  assert.doesNotThrow(safeOutputCall("./product-structor"));
});

test("assertSafeOutputRoot rejects absolute paths unless explicitly allowed", () => {
  assert.throws(safeOutputCall("/tmp/out"), /absolute output paths require/);
  assert.doesNotThrow(safeOutputCall("/workspace/out", { allowAbsoluteOutput: true }));
});

test("assertSafeOutputRoot rejects template, workspace, consumer, and .git paths", () => {
  assert.throws(safeOutputCall("/tpl/structor", { allowAbsoluteOutput: true }), /template repo/);
  assert.throws(safeOutputCall("/tpl/structor/generated", { allowAbsoluteOutput: true }), /template repo/);
  assert.throws(safeOutputCall("."), /workspace root/);
  assert.throws(safeOutputCall("./product-app"), /consumer repo/);
  assert.throws(safeOutputCall("./product-app/harness"), /consumer repo/);
  assert.throws(safeOutputCall("./generated/.git/harness"), /\.git path segment/);
});

function validConfig() {
  return {
    project: { name: "Demo", slug: "demo", harnessRepoName: "demo-structor" },
    output: { path: "../demo-structor" },
    models: { openai: true, anthropic: false },
    consumers: [
      {
        name: "demo-app",
        path: "../demo-app",
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

test("validateConfigShape rejects unknown top-level keys", async () => {
  const config = validConfig();
  config.unexpected = true;
  const errors = await validateConfigShape(config, "config");
  assert.ok(errors.some((error) => /not allowed/.test(error)));
});
