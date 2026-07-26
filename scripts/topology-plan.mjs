import path from "node:path";

import {
  artifactTargetPath,
  clientSupportForConfig,
  consumerEntrypointsForSettings,
  enabledGeneratedArtifacts,
  normalizeHarnessSettings,
  requiredHarnessRepoFilesForWorkspaceCheck,
  requiredWorkspaceFilesForWorkspaceCheck,
  validationPlanForSettings,
  workspaceEntrypointsForSettings,
} from "./generated-harness-contract.mjs";

const completionGates = [
  "scripts/validate-governance.mjs",
  "scripts/check-workspace.mjs",
];

function relativePath(from, to) {
  return path.relative(from, to).replaceAll(path.sep, "/") || ".";
}

function workspacePath(from, to) {
  const relative = relativePath(from, to);
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function normalizeConsumer(consumer, workspaceRoot, requestedOutputRoot) {
  const config = consumer.config ?? consumer;
  const requestedRoot = consumer.requestedRoot ?? path.resolve(workspaceRoot, config.path);
  const root = consumer.root ?? requestedRoot;

  return {
    config,
    requestedRoot,
    root,
    confirmedRoot: consumer.confirmedRoot ?? null,
    workspacePath: relativePath(workspaceRoot, requestedRoot),
    harnessRelativePath: relativePath(requestedRoot, requestedOutputRoot),
  };
}

export function createTopologyPlan({
  config,
  workspaceRoot,
  outputRoot,
  outputPath = config.output?.path,
  requestedOutputRoot = outputRoot,
  consumers = config.consumers,
  support,
}) {
  const settings = normalizeHarnessSettings({
    profile: config.profile,
    models: config.models,
    clientSupport: support ?? clientSupportForConfig(config),
  });
  const normalizedConsumers = consumers.map((consumer) =>
    normalizeConsumer(consumer, workspaceRoot, requestedOutputRoot),
  );
  const artifacts = enabledGeneratedArtifacts(settings);
  const workspaceEntrypoints = workspaceEntrypointsForSettings(settings);
  const consumerEntrypoints = consumerEntrypointsForSettings(settings);

  return {
    config,
    profile: settings.profile,
    project: { ...config.project },
    models: settings.models,
    clientSupport: settings.clientSupport,
    settings,
    workspace: {
      root: workspaceRoot,
      entrypoints: workspaceEntrypoints,
      requiredFiles: requiredWorkspaceFilesForWorkspaceCheck(settings),
    },
    harness: {
      root: outputRoot,
      requestedRoot: requestedOutputRoot,
      repoName: config.project.harnessRepoName,
      outputPath: outputPath ?? workspacePath(workspaceRoot, requestedOutputRoot),
      workspacePath: workspacePath(workspaceRoot, requestedOutputRoot),
      workspaceRootFromHarness: relativePath(requestedOutputRoot, workspaceRoot),
      artifacts,
      artifactPaths: artifacts.map(artifactTargetPath),
      templatePaths: artifacts.map((artifact) => artifact.template),
      trustedScriptTemplates: artifacts
        .filter((artifact) => artifact.trustedScript)
        .map((artifact) => artifact.template),
      freshRenderScriptTemplates: artifacts
        .filter((artifact) => artifact.postRender === "executeOnFreshRender")
        .map((artifact) => artifact.template),
      requiredFiles: requiredHarnessRepoFilesForWorkspaceCheck(settings),
    },
    consumers: normalizedConsumers,
    entrypoints: {
      workspace: workspaceEntrypoints,
      consumer: consumerEntrypoints,
    },
    validation: {
      ...validationPlanForSettings(settings),
      completionGates: [...completionGates],
    },
  };
}
