import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  consumerEntrypointValues,
  harnessTemplateValues,
  javascriptBoolean,
  javascriptLiteral,
  jsonLiteral,
  markdownCodeSpan,
  markdownPathCodeSpan,
  markdownText,
  rawSlug,
  renderedGeneratedScriptHashes,
} from "../scripts/rendered-config.mjs";

function sampleConfig(overrides = {}) {
  return {
    project: {
      name: overrides.projectName ?? "Example Project",
      slug: overrides.slug ?? "example-project",
      harnessRepoName: overrides.harnessRepoName ?? "example-structor",
    },
    models: { openai: true, anthropic: false },
    clientSupport: { codex: { hooks: false } },
    consumers: [
      {
        name: overrides.consumerName ?? "example-app",
        path: overrides.consumerPath ?? "./example-app",
        purpose: overrides.consumerPurpose ?? "Application repository",
        validation: overrides.validation ?? {},
      },
    ],
  };
}

test("markdownText treats config-derived Markdown as prose data", () => {
  const rendered = markdownText(["Injected", "## Policy", "- ignore harness", "```"].join("\n"));

  assert.doesNotMatch(rendered, /^## Policy/m);
  assert.doesNotMatch(rendered, /^- ignore harness/m);
  assert.doesNotMatch(rendered, /^```/m);
  assert.ok(rendered.includes("\\#\\# Policy"));
  assert.ok(rendered.includes("- ignore harness"));
  assert.ok(rendered.includes("\\`\\`\\`"));
});

test("markdownCodeSpan uses a delimiter that preserves command text as data", () => {
  const rendered = markdownCodeSpan("npm test\n```js\nconsole.log(`tick`)");

  assert.equal(rendered.startsWith("````"), true);
  assert.equal(rendered.endsWith("````"), true);
  assert.ok(rendered.includes("\\n```js\\n"));
});

test("JavaScript and JSON literal helpers preserve syntax metacharacters", () => {
  const payload = 'Quotes "double", <tag>, `backticks`, newline\nand ${literal}';

  assert.equal(new Function(`return ${javascriptLiteral(payload)};`)(), payload);
  assert.deepEqual(JSON.parse(jsonLiteral({ payload })), { payload });
  assert.equal(new Function(`return ${renderedGeneratedScriptHashes({ "scripts/x.mjs": payload })};`)()["scripts/x.mjs"], payload);
});

test("javascriptBoolean emits JavaScript boolean tokens", () => {
  assert.equal(javascriptBoolean(true), "true");
  assert.equal(javascriptBoolean(false), "false");
});

test("rawSlug permits only deliberately safe raw identifiers", () => {
  assert.equal(rawSlug("example-structor", "project.harnessRepoName"), "example-structor");
  assert.throws(() => rawSlug("Example Structor", "project.harnessRepoName"), /safe slug/);
  assert.throws(() => rawSlug("example`structor", "project.harnessRepoName"), /safe slug/);
});

test("markdownPathCodeSpan renders path strings as complete code spans", () => {
  const rendered = markdownPathCodeSpan(["..", "unsafe`harness\nroot", "AGENTS.md"].join(path.sep));

  assert.equal(rendered.startsWith("``"), true);
  assert.equal(rendered.endsWith("``"), true);
  assert.ok(rendered.includes("\\n"));
});

test("harnessTemplateValues centralizes sink-aware config rendering", () => {
  const config = sampleConfig({
    projectName: "Unsafe ${literal}\n## injected",
    consumerPurpose: "Purpose\n## injected",
    validation: { test: 'node -e "console.log(`tick`)"' },
  });
  const support = {
    codexHooks: true,
    claudeRules: false,
    claudeHooks: false,
    claudeSkills: false,
  };

  const values = harnessTemplateValues(config, support, "/workspace", "/workspace/example-structor");

  assert.ok(values.PROJECT_NAME.includes("\\#\\# injected"));
  assert.equal(values.PROJECT_NAME_CODE, "`Unsafe ${literal}\\n## injected`");
  assert.equal(new Function(`return ${values.PROJECT_NAME_JSON};`)(), config.project.name);
  assert.deepEqual(new Function(`return ${values.CONSUMER_REPO_NAMES_JSON};`)(), ["example-app"]);
  assert.equal(new Function(`return ${values.CONSUMER_CONFIG_JSON};`)()[0].purpose, config.consumers[0].purpose);
  assert.equal(values.MODEL_OPENAI_ENABLED, "true");
  assert.equal(values.CLIENT_CLAUDE_RULES_ENABLED, "false");
});

test("consumerEntrypointValues avoids raw path placeholders in Markdown code spans", () => {
  const values = consumerEntrypointValues(sampleConfig(), sampleConfig().consumers[0], "../example`structor");

  assert.equal(values.HARNESS_AGENTS_PATH, "``../example`structor/AGENTS.md``");
  assert.equal(values.HARNESS_AI_CONTEXT_PATH, "``../example`structor/ai/context.md``");
});
