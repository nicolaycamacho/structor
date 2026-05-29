import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { repoRoot } from "../scripts/lib.mjs";
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

async function writeMinimalConfig(root, outputPath, overrides = {}) {
  const consumerRoot = path.join(root, "product-app");
  await mkdir(consumerRoot, { recursive: true });
  await writeFile(path.join(consumerRoot, "README.md"), "# product-app\n");

  const config = {
    project: {
      name: overrides.projectName ?? "Test Project",
      slug: "test-project",
      harnessRepoName: "test-structor",
    },
    output: { path: outputPath },
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
  const configPath = path.join(root, "harness.config.json");
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return configPath;
}

function runInitHarness(configPath) {
  return spawnSync(process.execPath, [path.join(repoRoot, "scripts/init-harness.mjs"), "--config", configPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function assertSuccess(result, label) {
  assert.equal(result.status, 0, `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function assertSyntaxChecks(filePath) {
  const result = spawnSync(process.execPath, ["--check", filePath], { encoding: "utf8" });
  assertSuccess(result, `syntax check failed for ${filePath}`);
}

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

test("init harness does not execute a skipped output script", async () => {
  await withTempDir(async (root) => {
    const outputPath = "./test-structor";
    const configPath = await writeMinimalConfig(root, outputPath);
    const outputRoot = path.join(root, "test-structor");
    const scriptPath = path.join(outputRoot, "scripts", "generate-html-views.mjs");
    const markerPath = path.join(outputRoot, "executed.txt");

    await mkdir(path.dirname(scriptPath), { recursive: true });
    await writeFile(
      scriptPath,
      "import { writeFileSync } from 'node:fs';\nwriteFileSync(new URL('../executed.txt', import.meta.url), 'ran');\n",
    );

    const result = runInitHarness(configPath);

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /skipped existing .*generate-html-views\.mjs/);
    assert.match(result.stdout, /skipped HTML view generation/);
    await assert.rejects(readFile(markerPath, "utf8"));
  });
});

test("init harness treats project name as data in executable JavaScript templates", async () => {
  await withTempDir(async (root) => {
    const projectName = 'Unsafe ${(() => { throw new Error("project name executed"); })()}';
    const configPath = await writeMinimalConfig(root, "./test-structor", { projectName });
    const outputRoot = path.join(root, "test-structor");

    assertSuccess(runInitHarness(configPath), "generator should not execute project.name as JavaScript");

    const indexHtml = await readFile(path.join(outputRoot, "ai/views/index.html"), "utf8");
    assert.ok(indexHtml.includes("Unsafe ${(() =&gt; { throw new Error(&quot;project name executed&quot;); })()} Harness Views"));

    const worktreeBootstrap = await readFile(path.join(outputRoot, "scripts/lib/worktree-bootstrap.mjs"), "utf8");
    assert.ok(worktreeBootstrap.includes(`const projectName = ${JSON.stringify(projectName)};`));
  });
});

test("init harness keeps generated JavaScript valid for project names with syntax metacharacters", async () => {
  await withTempDir(async (root) => {
    const projectName = 'Quotes "double" and <tag> plus `backticks` and ${literal}';
    const configPath = await writeMinimalConfig(root, "./test-structor", { projectName });
    const outputRoot = path.join(root, "test-structor");

    assertSuccess(runInitHarness(configPath), "generator should handle JavaScript metacharacters in project.name");

    assertSyntaxChecks(path.join(outputRoot, "scripts/generate-html-views.mjs"));
    assertSyntaxChecks(path.join(outputRoot, "scripts/lib/worktree-bootstrap.mjs"));

    const indexHtml = await readFile(path.join(outputRoot, "ai/views/index.html"), "utf8");
    assert.ok(indexHtml.includes("Quotes &quot;double&quot; and &lt;tag&gt; plus `backticks` and ${literal} Harness Views"));
  });
});
