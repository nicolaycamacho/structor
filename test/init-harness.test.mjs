import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  parseArgs,
  render,
  shouldRenderTemplate,
  writeRenderedFile,
} from "../scripts/init-harness.mjs";

async function withTempDir(run) {
  const dir = await mkdtemp(path.join(tmpdir(), "structor-test-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function silenceLog(run) {
  const original = console.log;
  console.log = () => {};
  try {
    return await run();
  } finally {
    console.log = original;
  }
}

// Built dynamically so the literal token never appears in source and trips the
// repo's placeholder-leak check.
const placeholder = (key) => `{{${key}}}`;
const SAMPLE_TEMPLATE = `Hello ${placeholder("NAME")}`;

test("parseArgs uses safe defaults", () => {
  const options = parseArgs([]);
  assert.equal(options.config, "harness.config.json");
  assert.equal(options.dryRun, false);
  assert.equal(options.force, false);
  assert.equal(options.installConsumerEntrypoints, false);
  assert.equal(options.allowAbsoluteOutput, false);
});

test("parseArgs reads flags and valued options", () => {
  const options = parseArgs([
    "--config", "custom.json",
    "--dry-run",
    "--force",
    "--install-consumer-entrypoints",
    "--allow-absolute-output",
  ]);
  assert.equal(options.config, "custom.json");
  assert.equal(options.dryRun, true);
  assert.equal(options.force, true);
  assert.equal(options.installConsumerEntrypoints, true);
  assert.equal(options.allowAbsoluteOutput, true);
});

test("parseArgs rejects unknown arguments", () => {
  assert.throws(() => parseArgs(["--nope"]), /Unknown argument: --nope/);
});

test("render substitutes placeholders and rejects unknown ones", () => {
  assert.equal(render(SAMPLE_TEMPLATE, { NAME: "World" }), "Hello World");
  assert.throws(() => render(`Hi ${placeholder("MISSING")}`, {}), /placeholder \{\{MISSING\}\}/);
});

test("shouldRenderTemplate gates anthropic-only surfaces", () => {
  const codexOnly = { models: { openai: true, anthropic: false }, clientSupport: {} };
  assert.equal(shouldRenderTemplate("CLAUDE.md.tpl", codexOnly), false);
  assert.equal(shouldRenderTemplate(".claude/CLAUDE.md.tpl", codexOnly), false);
  assert.equal(shouldRenderTemplate("AGENTS.md.tpl", codexOnly), true);
  assert.equal(shouldRenderTemplate("consumer/AGENTS.md.tpl", codexOnly), false);
});

test("writeRenderedFile dry-run writes nothing", async () => {
  await withTempDir(async (root) => {
    const templateRoot = path.join(root, "template");
    await mkdir(templateRoot, { recursive: true });
    await writeFile(path.join(templateRoot, "sample.md.tpl"), SAMPLE_TEMPLATE);
    const targetRoot = path.join(root, "out");

    await silenceLog(() =>
      writeRenderedFile("sample.md.tpl", targetRoot, { NAME: "World" }, { dryRun: true }, templateRoot),
    );

    await assert.rejects(readFile(path.join(targetRoot, "sample.md"), "utf8"));
  });
});

test("writeRenderedFile creates rendered output", async () => {
  await withTempDir(async (root) => {
    const templateRoot = path.join(root, "template");
    await mkdir(templateRoot, { recursive: true });
    await writeFile(path.join(templateRoot, "sample.md.tpl"), SAMPLE_TEMPLATE);
    const targetRoot = path.join(root, "out");

    await silenceLog(() =>
      writeRenderedFile("sample.md.tpl", targetRoot, { NAME: "World" }, { dryRun: false, force: false }, templateRoot),
    );

    assert.equal(await readFile(path.join(targetRoot, "sample.md"), "utf8"), "Hello World");
  });
});

test("writeRenderedFile skips existing files without force", async () => {
  await withTempDir(async (root) => {
    const templateRoot = path.join(root, "template");
    await mkdir(templateRoot, { recursive: true });
    await writeFile(path.join(templateRoot, "sample.md.tpl"), SAMPLE_TEMPLATE);
    const targetRoot = path.join(root, "out");
    await mkdir(targetRoot, { recursive: true });
    await writeFile(path.join(targetRoot, "sample.md"), "OLD");

    await silenceLog(() =>
      writeRenderedFile("sample.md.tpl", targetRoot, { NAME: "World" }, { dryRun: false, force: false }, templateRoot),
    );

    assert.equal(await readFile(path.join(targetRoot, "sample.md"), "utf8"), "OLD");
  });
});

test("writeRenderedFile overwrites existing files with force", async () => {
  await withTempDir(async (root) => {
    const templateRoot = path.join(root, "template");
    await mkdir(templateRoot, { recursive: true });
    await writeFile(path.join(templateRoot, "sample.md.tpl"), SAMPLE_TEMPLATE);
    const targetRoot = path.join(root, "out");
    await mkdir(targetRoot, { recursive: true });
    await writeFile(path.join(targetRoot, "sample.md"), "OLD");

    await silenceLog(() =>
      writeRenderedFile("sample.md.tpl", targetRoot, { NAME: "World" }, { dryRun: false, force: true }, templateRoot),
    );

    assert.equal(await readFile(path.join(targetRoot, "sample.md"), "utf8"), "Hello World");
  });
});
