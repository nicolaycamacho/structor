import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createTopologyPlan } from "../scripts/topology-plan.mjs";

function sampleConfig(overrides = {}) {
  return {
    project: {
      name: "Demo Project",
      slug: "demo-project",
      harnessRepoName: "demo-project-structor",
    },
    output: { path: "./demo-project-structor" },
    models: { openai: true, anthropic: false },
    consumers: [
      {
        name: "demo-app",
        path: "./demo-app",
        purpose: "Primary application",
        validation: { test: "npm test" },
      },
    ],
    ...overrides,
  };
}

test("topology plan preserves workspace-relative paths for a workspace-root config", () => {
  const workspaceRoot = path.resolve("/workspace");
  const harnessRoot = path.join(workspaceRoot, "demo-project-structor");
  const plan = createTopologyPlan({
    config: sampleConfig(),
    workspaceRoot,
    outputRoot: harnessRoot,
  });

  assert.equal(plan.workspace.root, workspaceRoot);
  assert.equal(plan.harness.root, harnessRoot);
  assert.equal(plan.harness.workspacePath, "./demo-project-structor");
  assert.equal(plan.harness.workspaceRootFromHarness, "..");
  assert.equal(plan.consumers[0].workspacePath, "demo-app");
  assert.equal(plan.consumers[0].harnessRelativePath, "../demo-project-structor");
});

test("topology plan describes multiple consumers and their validation", () => {
  const workspaceRoot = path.resolve("/workspace");
  const config = sampleConfig({
    consumers: [
      ...sampleConfig().consumers,
      {
        name: "demo-api",
        path: "./services/demo-api",
        purpose: "API service",
        validation: { lint: "npm run lint", test: "npm test" },
      },
    ],
  });
  const plan = createTopologyPlan({
    config,
    workspaceRoot,
    outputRoot: path.join(workspaceRoot, config.project.harnessRepoName),
  });

  assert.deepEqual(
    plan.consumers.map((consumer) => ({
      name: consumer.config.name,
      workspacePath: consumer.workspacePath,
      validation: consumer.config.validation,
    })),
    [
      { name: "demo-app", workspacePath: "demo-app", validation: { test: "npm test" } },
      {
        name: "demo-api",
        workspacePath: "services/demo-api",
        validation: { lint: "npm run lint", test: "npm test" },
      },
    ],
  );
});

test("topology plan gates artifacts and entrypoints for every supported model combination", () => {
  const workspaceRoot = path.resolve("/workspace");
  const cases = [
    {
      models: { openai: true, anthropic: false },
      entrypoints: ["AGENTS.md"],
      presentArtifacts: [
        "AGENTS.md",
        "ai/model-overlays/openai/AGENTS.md",
        ".codex/hooks.json",
        "ai/contracts/codex-hooks.contract.json",
        "scripts/check-codex-hooks.mjs",
        "scripts/hooks/codex-hook.mjs",
      ],
      absentArtifacts: ["CLAUDE.md", "ai/model-overlays/anthropic/CLAUDE.md", "scripts/check-claude-compatibility.mjs"],
    },
    {
      models: { openai: false, anthropic: true },
      entrypoints: ["CLAUDE.md"],
      presentArtifacts: ["CLAUDE.md", "ai/model-overlays/anthropic/CLAUDE.md", "scripts/check-claude-compatibility.mjs"],
      absentArtifacts: [
        "AGENTS.md",
        "ai/model-overlays/openai/AGENTS.md",
        ".codex/hooks.json",
        "scripts/check-codex-hooks.mjs",
      ],
    },
    {
      models: { openai: true, anthropic: true },
      entrypoints: ["AGENTS.md", "CLAUDE.md"],
      presentArtifacts: [
        "AGENTS.md",
        "CLAUDE.md",
        "ai/model-overlays/openai/AGENTS.md",
        "ai/model-overlays/anthropic/CLAUDE.md",
        ".codex/hooks.json",
        "scripts/check-codex-hooks.mjs",
        "scripts/check-claude-compatibility.mjs",
      ],
      absentArtifacts: [],
    },
  ];

  for (const modelCase of cases) {
    const config = sampleConfig({ models: modelCase.models });
    const plan = createTopologyPlan({
      config,
      workspaceRoot,
      outputRoot: path.join(workspaceRoot, config.project.harnessRepoName),
    });
    const workspaceEntrypoints = plan.entrypoints.workspace.map((entrypoint) => entrypoint.path);
    const consumerEntrypoints = plan.entrypoints.consumer.map((entrypoint) => entrypoint.path);

    assert.deepEqual(workspaceEntrypoints, modelCase.entrypoints);
    assert.deepEqual(consumerEntrypoints, modelCase.entrypoints);
    for (const artifactPath of modelCase.presentArtifacts) {
      assert.ok(plan.harness.artifactPaths.includes(artifactPath), `expected artifact: ${artifactPath}`);
    }
    for (const artifactPath of modelCase.absentArtifacts) {
      assert.ok(!plan.harness.artifactPaths.includes(artifactPath), `unexpected artifact: ${artifactPath}`);
    }
  }
});
