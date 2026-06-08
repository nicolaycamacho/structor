const gateModelOpenai = "model:openai";
const gateModelAnthropic = "model:anthropic";
const gateClientCodexHooks = "client:codexHooks";
const gateClientClaudeRules = "client:claudeRules";
const gateAnyModel = "model:any";

export const generatedHarnessContractScript = "scripts/generated-harness-contract.mjs";

function artifact(template, options = {}) {
  return {
    generated: true,
    gates: [],
    ...options,
    template,
  };
}

function script(template, options = {}) {
  return artifact(template, {
    trustedScript: true,
    ...options,
  });
}

export const generatedHarnessArtifacts = [
  artifact("AGENTS.md.tpl", { gates: [gateModelOpenai], workspaceCheck: "repo" }),
  artifact("CLAUDE.md.tpl", { gates: [gateModelAnthropic], workspaceCheck: "repo", claudeCompatibility: true }),
  artifact(".codex/hooks.json.tpl", { gates: [gateClientCodexHooks], workspaceCheck: "repo" }),
  artifact("README.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/AGENTS.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/HUB.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/context.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/HARNESS.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/HARNESS-ENGINEERING.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/READINESS.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/QUALITY.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/DECISIONS.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/PRODUCT-SUMMARY.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/PRODUCT.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/ARCHITECTURE.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/DESIGN.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/WORKFLOW.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/VERSIONING.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/CODEX-HOOKS.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/RUNNER-SAFETY.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/RUNNER-READINESS.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/AGENT-GARBAGE-COLLECTION.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/knowledge-manifest.json.tpl", { workspaceCheck: "repo" }),
  artifact("ai/workspace/REPOS.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/workspace/SYSTEM-MAP.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/workspace/SESSION-BOOTSTRAP.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/workspace/LOCAL-STACK.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/workspace/TEST-STRATEGY.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/model-overlays/openai/AGENTS.md.tpl", { gates: [gateModelOpenai], workspaceCheck: "repo" }),
  artifact("ai/model-overlays/anthropic/CLAUDE.md.tpl", {
    gates: [gateModelAnthropic],
    workspaceCheck: "repo",
  }),
  artifact("consumer/AGENTS.md.tpl", {
    generated: false,
    gates: [gateModelOpenai],
    consumerEntrypoint: { path: "AGENTS.md", routing: "harness", model: "openai" },
  }),
  artifact("consumer/CLAUDE.md.tpl", {
    generated: false,
    gates: [gateModelAnthropic],
    consumerEntrypoint: { path: "CLAUDE.md", routing: "harness", model: "anthropic" },
  }),
  artifact("workspace/AGENTS.md.tpl", {
    gates: [gateModelOpenai],
    workspaceEntrypoint: { path: "AGENTS.md", routing: "harness", model: "openai" },
  }),
  artifact("workspace/CLAUDE.md.tpl", {
    gates: [gateModelAnthropic],
    workspaceEntrypoint: { path: "CLAUDE.md", routing: "harness", model: "anthropic" },
  }),
  artifact("ai/contracts/README.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/contracts/repo-boundaries.md.tpl"),
  artifact("ai/contracts/app-legibility.md.tpl"),
  artifact("ai/contracts/api-boundary.md.tpl"),
  artifact("ai/contracts/security-boundary.md.tpl"),
  artifact("ai/contracts/repo-boundaries.contract.json.tpl"),
  artifact("ai/contracts/app-legibility.contract.json.tpl"),
  artifact("ai/contracts/api-boundary.contract.json.tpl"),
  artifact("ai/contracts/security-boundary.contract.json.tpl"),
  artifact("ai/contracts/codex-hooks.md.tpl"),
  artifact("ai/contracts/codex-hooks.contract.json.tpl", { gates: [gateClientCodexHooks] }),
  artifact("ai/contracts/release-flow.md.tpl"),
  artifact("ai/contracts/release-flow.contract.json.tpl"),
  artifact("ai/contracts/github-safety.md.tpl"),
  artifact("ai/contracts/github-safety.contract.json.tpl"),
  artifact("ai/templates/README.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/templates/task-brief-template.md.tpl"),
  artifact("ai/templates/issue-template.md.tpl"),
  artifact("ai/templates/guidance-migration-prompt.md.tpl"),
  artifact("ai/templates/fixtures/issues/valid-ready.md.tpl"),
  artifact("ai/templates/fixtures/issues/invalid-placeholder.md.tpl"),
  artifact("ai/templates/fixtures/issues/invalid-protected-surface.md.tpl"),
  artifact("ai/specs/README.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/tasks/guidance-migration.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/skills/README.md.tpl", { workspaceCheck: "repo" }),
  artifact("ai/skills/review-architecture.md.tpl"),
  artifact("ai/skills/review-security.md.tpl"),
  artifact("ai/skills/review-contract-drift.md.tpl"),
  artifact("ai/skills/review-governance-drift.md.tpl"),
  artifact("ai/plans/README.md.tpl"),
  artifact("ai/plans/tech-debt.md.tpl"),
  script("scripts/generated-harness-contract.mjs.tpl", { workspaceCheck: "repo" }),
  script("scripts/validate-governance.mjs.tpl", { trustedScript: false, workspaceCheck: "repo" }),
  script("scripts/check-template-governance.mjs.tpl"),
  script("scripts/check-readiness.mjs.tpl", { workspaceCheck: "repo" }),
  script("scripts/check-task-template.mjs.tpl", { workspaceCheck: "repo" }),
  script("scripts/check-issue-template.mjs.tpl"),
  script("scripts/check-knowledge-manifest.mjs.tpl", { workspaceCheck: "repo" }),
  script("scripts/check-plans.mjs.tpl"),
  script("scripts/check-review-skills.mjs.tpl"),
  script("scripts/check-garbage-collection.mjs.tpl"),
  script("scripts/check-contract-manifests.mjs.tpl", { workspaceCheck: "repo" }),
  script("scripts/generate-html-views.mjs.tpl", { workspaceCheck: "repo", postRender: "executeOnFreshRender" }),
  script("scripts/check-html-views.mjs.tpl", { workspaceCheck: "repo" }),
  script("scripts/check-codex-hooks.mjs.tpl", { gates: [gateClientCodexHooks], workspaceCheck: "repo" }),
  script("scripts/check-claude-compatibility.mjs.tpl", {
    gates: [gateModelAnthropic],
    workspaceCheck: "repo",
  }),
  script("scripts/check-overlay-drift.mjs.tpl", { gates: [gateAnyModel], workspaceCheck: "repo" }),
  script("scripts/bootstrap-codex-worktree.mjs.tpl", { workspaceCheck: "repo" }),
  script("scripts/check-worktrees.mjs.tpl", { workspaceCheck: "repo" }),
  script("scripts/check-worktree-bootstrap-fixtures.mjs.tpl", { workspaceCheck: "repo" }),
  script("scripts/lib/path-safety.mjs.tpl", { workspaceCheck: "repo" }),
  script("scripts/lib/worktree-bootstrap.mjs.tpl", { workspaceCheck: "repo" }),
  artifact("scripts/fixtures/worktrees/README.md.tpl", { workspaceCheck: "repo" }),
  script("scripts/bootstrap-workspace.mjs.tpl", { workspaceCheck: "repo" }),
  script("scripts/check-workspace.mjs.tpl", { workspaceCheck: "repo" }),
  script("scripts/hooks/codex-hook.mjs.tpl", { gates: [gateClientCodexHooks], workspaceCheck: "repo" }),
  script("scripts/hooks/lib/codex-hooks-core.mjs.tpl", { gates: [gateClientCodexHooks], workspaceCheck: "repo" }),
];

export const generatedHarnessValidationChecks = [
  { path: "scripts/check-template-governance.mjs", phase: "required", dependencies: [generatedHarnessContractScript] },
  { path: "scripts/check-task-template.mjs", phase: "required" },
  { path: "scripts/check-readiness.mjs", phase: "required" },
  { path: "scripts/check-issue-template.mjs", phase: "required" },
  { path: "scripts/check-knowledge-manifest.mjs", phase: "required" },
  { path: "scripts/check-plans.mjs", phase: "required" },
  { path: "scripts/check-review-skills.mjs", phase: "required" },
  { path: "scripts/check-garbage-collection.mjs", phase: "required" },
  { path: "scripts/check-contract-manifests.mjs", phase: "required" },
  {
    path: "scripts/check-html-views.mjs",
    phase: "required",
    dependencies: ["scripts/generate-html-views.mjs", "scripts/lib/path-safety.mjs"],
  },
  {
    path: "scripts/check-worktree-bootstrap-fixtures.mjs",
    phase: "required",
    dependencies: ["scripts/lib/path-safety.mjs", "scripts/lib/worktree-bootstrap.mjs"],
  },
  { path: "scripts/check-repo-name-consistency.mjs", optional: true },
  { path: "scripts/check-linear-contract.mjs", optional: true },
  { path: "scripts/check-contract-conformance.mjs", optional: true },
  { path: "scripts/check-domain-contract-matrix.mjs", optional: true },
  {
    path: "scripts/check-codex-hooks.mjs",
    phase: "conditional",
    gates: [gateClientCodexHooks],
    dependencies: ["scripts/hooks/codex-hook.mjs", "scripts/hooks/lib/codex-hooks-core.mjs"],
  },
  {
    path: "scripts/check-claude-compatibility.mjs",
    phase: "conditional",
    gates: [gateModelAnthropic],
    dependencies: [generatedHarnessContractScript],
  },
  { path: "scripts/check-overlay-drift.mjs", phase: "conditional", gates: [gateAnyModel] },
];

export function clientSupportForConfig(config) {
  return {
    codexHooks: Boolean(config.models?.openai) && (config.clientSupport?.codex?.hooks ?? true),
    claudeRules: false,
    claudeHooks: Boolean(config.models?.anthropic) && (config.clientSupport?.claude?.hooks ?? false),
    claudeSkills: Boolean(config.models?.anthropic) && (config.clientSupport?.claude?.skills ?? false),
  };
}

export function normalizeHarnessSettings(input) {
  const models = {
    openai: Boolean(input.models?.openai),
    anthropic: Boolean(input.models?.anthropic),
  };
  const support = input.clientSupport ?? {};
  const normalizedSupport =
    Object.hasOwn(support, "codexHooks") ||
    Object.hasOwn(support, "claudeRules") ||
    Object.hasOwn(support, "claudeHooks") ||
    Object.hasOwn(support, "claudeSkills")
      ? {
          codexHooks: Boolean(support.codexHooks),
          claudeRules: false,
          claudeHooks: Boolean(support.claudeHooks),
          claudeSkills: Boolean(support.claudeSkills),
        }
      : clientSupportForConfig({ models, clientSupport: support });

  return { models, clientSupport: normalizedSupport };
}

function gateEnabled(gate, settings) {
  if (gate === gateModelOpenai) return settings.models.openai;
  if (gate === gateModelAnthropic) return settings.models.anthropic;
  if (gate === gateClientCodexHooks) return settings.clientSupport.codexHooks;
  if (gate === gateClientClaudeRules) return settings.clientSupport.claudeRules;
  if (gate === gateAnyModel) return settings.models.openai || settings.models.anthropic;
  throw new Error(`Unknown generated harness gate: ${gate}`);
}

export function gatesEnabled(gates, input) {
  const settings = normalizeHarnessSettings(input);
  return (gates ?? []).every((gate) => gateEnabled(gate, settings));
}

export function artifactEnabled(artifactContract, input) {
  return gatesEnabled(artifactContract.gates, input);
}

export function artifactTargetPath(artifactContract) {
  return artifactContract.target ?? artifactContract.template.replace(/\.tpl$/, "");
}

export function templateArtifactPath(artifactContract) {
  return `template/${artifactContract.template}`;
}

export function generatedHarnessTemplatePaths() {
  return generatedHarnessArtifacts.map(templateArtifactPath).sort();
}

export function contractArtifactForTemplate(sourceRelative) {
  return generatedHarnessArtifacts.find((artifactContract) => artifactContract.template === sourceRelative) ?? null;
}

export function shouldRenderTemplate(sourceRelative, input) {
  const artifactContract = contractArtifactForTemplate(sourceRelative);
  return Boolean(artifactContract?.generated && artifactEnabled(artifactContract, input));
}

export function enabledGeneratedArtifacts(input) {
  return generatedHarnessArtifacts.filter(
    (artifactContract) => artifactContract.generated && artifactEnabled(artifactContract, input),
  );
}

export function requiredGeneratedHarnessFilesForGovernance(input) {
  return enabledGeneratedArtifacts(input).map(artifactTargetPath);
}

export function requiredHarnessRepoFilesForWorkspaceCheck(input) {
  return enabledGeneratedArtifacts(input)
    .filter((artifactContract) => artifactContract.workspaceCheck === "repo")
    .map(artifactTargetPath);
}

function entrypointsForSettings(input, key) {
  return generatedHarnessArtifacts
    .filter((artifactContract) => artifactEnabled(artifactContract, input) && artifactContract[key])
    .map((artifactContract) => ({
      source: artifactTargetPath(artifactContract),
      template: artifactContract.template,
      ...artifactContract[key],
    }));
}

export function workspaceEntrypointsForSettings(input) {
  return entrypointsForSettings(input, "workspaceEntrypoint");
}

export function consumerEntrypointsForSettings(input) {
  return entrypointsForSettings(input, "consumerEntrypoint");
}

export function requiredWorkspaceFilesForWorkspaceCheck(input) {
  return workspaceEntrypointsForSettings(input).map((entrypoint) => entrypoint.path);
}

export function requiredClaudeCompatibilityFiles(input) {
  return enabledGeneratedArtifacts(input)
    .filter((artifactContract) => artifactContract.claudeCompatibility)
    .map(artifactTargetPath);
}

export function trustedGeneratedScriptTemplatesForSettings(input) {
  return enabledGeneratedArtifacts(input)
    .filter((artifactContract) => artifactContract.trustedScript)
    .map((artifactContract) => artifactContract.template);
}

export function trustedGeneratedScriptTargetsForSettings(input) {
  return enabledGeneratedArtifacts(input)
    .filter((artifactContract) => artifactContract.trustedScript)
    .map(artifactTargetPath);
}

export function freshRenderScriptTemplatesForSettings(input) {
  return enabledGeneratedArtifacts(input)
    .filter((artifactContract) => artifactContract.postRender === "executeOnFreshRender")
    .map((artifactContract) => artifactContract.template);
}

export function validationPlanForSettings(input) {
  const enabledChecks = generatedHarnessValidationChecks.filter((check) => gatesEnabled(check.gates, input));
  const requiredChecks = enabledChecks
    .filter((check) => !check.optional && check.phase !== "conditional")
    .map((check) => check.path);
  const optionalChecks = enabledChecks.filter((check) => check.optional).map((check) => check.path);
  const conditionalChecks = enabledChecks
    .filter((check) => !check.optional && check.phase === "conditional")
    .map((check) => check.path);
  const checkDependencies = Object.fromEntries(
    enabledChecks
      .filter((check) => check.dependencies?.length)
      .map((check) => [check.path, check.dependencies]),
  );

  return { requiredChecks, optionalChecks, conditionalChecks, checkDependencies };
}

export function generatedHarnessContractErrors() {
  const errors = [];
  const templates = new Map();
  const generatedTargets = new Map();
  const validationChecks = new Map();

  for (const artifactContract of generatedHarnessArtifacts) {
    if (!artifactContract.template.endsWith(".tpl")) {
      errors.push(`${artifactContract.template} must declare a .tpl template path.`);
    }

    const previousTemplate = templates.get(artifactContract.template);
    if (previousTemplate) {
      errors.push(`${artifactContract.template} is declared more than once.`);
    }
    templates.set(artifactContract.template, artifactContract);

    if (artifactContract.generated) {
      const target = artifactTargetPath(artifactContract);
      const previousTarget = generatedTargets.get(target);
      if (previousTarget) {
        errors.push(`${target} is generated by both ${previousTarget.template} and ${artifactContract.template}.`);
      }
      generatedTargets.set(target, artifactContract);
    }

    if (artifactContract.template.startsWith("scripts/") && artifactContract.template.endsWith(".mjs.tpl")) {
      if (typeof artifactContract.trustedScript !== "boolean") {
        errors.push(`${artifactContract.template} must declare trustedScript true or false.`);
      }
    }
  }

  for (const check of generatedHarnessValidationChecks) {
    if (validationChecks.has(check.path)) {
      errors.push(`${check.path} is declared more than once in generated harness validation checks.`);
    }
    validationChecks.set(check.path, check);

    const checkArtifact = generatedTargets.get(check.path);
    if (!check.optional && !checkArtifact) {
      errors.push(`${check.path} must have a generated artifact declaration.`);
    }
    if (checkArtifact && !checkArtifact.trustedScript) {
      errors.push(`${check.path} must be declared as a trusted generated script.`);
    }

    for (const dependency of check.dependencies ?? []) {
      const dependencyArtifact = generatedTargets.get(dependency);
      if (!dependencyArtifact) {
        errors.push(`${check.path} depends on ${dependency}, but ${dependency} has no generated artifact declaration.`);
      } else if (!dependencyArtifact.trustedScript) {
        errors.push(`${check.path} depends on ${dependency}, but ${dependency} is not a trusted generated script.`);
      }
    }
  }

  return errors;
}
