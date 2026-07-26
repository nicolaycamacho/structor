import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  agentNativeContractVersion,
  assertApprovedInstallationPlan,
  assertCompleteEvidenceManifest,
  canonicalJson,
  assertCompleteInstallationPlan,
  canonicalInstallationEvidenceOutputPaths,
  installationPlanHash,
  installationPlanSchemaVersion,
} from "./agent-native-contract.mjs";
import {
  installConsumerEntrypoints,
  planConsumerRootGuidancePreservation,
} from "./init-harness.mjs";
import { markdownCodeSpan } from "./rendered-config.mjs";
import { applySetupTransaction, planSetupTransaction } from "./setup-transaction.mjs";

const populateSectionStart = "<!-- structor:populate:start -->";
const populateSectionEnd = "<!-- structor:populate:end -->";
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function sha256(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function repositoryRelative(workspaceRoot, targetPath) {
  const relative = path.relative(workspaceRoot, targetPath).replaceAll(path.sep, "/") || ".";
  if (relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) {
    throw new Error(`Agent-native setup path escapes the approved workspace: ${targetPath}`);
  }
  return relative;
}

function jsonFile(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function withPopulateSection(existingContent, evidence) {
  const section = `${populateSectionStart}\n${evidence}${populateSectionEnd}`;
  const startIndex = existingContent.indexOf(populateSectionStart);
  const endIndex = existingContent.indexOf(populateSectionEnd);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return `${existingContent.trimEnd()}\n\n${section}\n`;
  }
  return `${existingContent.slice(0, startIndex)}${section}${existingContent.slice(endIndex + populateSectionEnd.length)}`;
}

async function consumerEvidence(resolvedConsumer, workspaceRoot) {
  const consumerRoot = resolvedConsumer.confirmedRoot ?? resolvedConsumer.root;
  const packagePath = path.join(consumerRoot, "package.json");
  const packageContent = await readFile(packagePath, "utf8");
  const packageJson = JSON.parse(packageContent);
  return {
    config: resolvedConsumer.config,
    packageName: typeof packageJson.name === "string" ? packageJson.name : null,
    sourcePath: repositoryRelative(workspaceRoot, packagePath),
    sourceHash: sha256(packageContent),
  };
}

function renderContextEvidence(consumers) {
  const lines = consumers.flatMap((consumer) => [
    `- ${markdownCodeSpan(consumer.config.name)} at ${markdownCodeSpan(consumer.config.path)}.`,
    ...(consumer.packageName ? [`  - Package: ${markdownCodeSpan(consumer.packageName)}.`] : []),
    `  - Evidence: ${markdownCodeSpan(consumer.sourcePath)}.`,
  ]);
  return `## Local Consumer Evidence\n\n${lines.join("\n")}\n\n## Review Required\n\n- Confirm product, architecture, contracts, and workflow claims before relying on them.\n- Keep model overlays and consumer entrypoints thin.\n`;
}

async function plannedWrite({ workspaceRoot, targetPath, content, backupRoot }) {
  const relativePath = repositoryRelative(workspaceRoot, targetPath);
  if (!(await exists(targetPath))) {
    return {
      write: {
        path: relativePath,
        action: "create",
        precondition: { kind: "absent" },
        contentHash: sha256(content),
      },
      backup: null,
    };
  }
  const previousContent = await readFile(targetPath);
  return {
    write: {
      path: relativePath,
      action: "replace",
      precondition: { kind: "content-hash", contentHash: sha256(previousContent) },
      contentHash: sha256(content),
    },
    backup: {
      sourcePath: relativePath,
      backupPath: `${backupRoot}/${relativePath}`,
    },
  };
}

async function packageVersion() {
  const metadata = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  return metadata.version;
}

async function assertExecutingSourceRevision(expectedRevision) {
  const metadata = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  if (/^[a-f0-9]{40}$/.test(metadata.gitHead ?? "")) {
    if (metadata.gitHead !== expectedRevision) {
      throw new Error("Requested source revision does not match the executing Structor package.");
    }
    return;
  }
  const revision = spawnSync("git", ["-C", packageRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (revision.status !== 0) {
    throw new Error("Executing Structor source revision is unavailable; use an immutable package or Git checkout.");
  }
  const status = spawnSync("git", ["-C", packageRoot, "status", "--porcelain", "--untracked-files=all"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (status.status !== 0 || status.stdout.trim()) {
    throw new Error("Agent-native setup requires a clean immutable Structor checkout.");
  }
  if (revision.stdout.trim() !== expectedRevision) {
    throw new Error("Requested source revision does not match the executing Structor checkout.");
  }
}

function enabledClients(config) {
  return [
    ...(config.models.openai ? ["codex"] : []),
    ...(config.models.anthropic ? ["claude"] : []),
  ].join(",");
}

const consumerValidationKinds = ["lint", "test", "build", "health"];

function plannedConsumerValidationCommands(resolvedConfig, workspaceRoot) {
  return resolvedConfig.consumers.flatMap((consumer) =>
    consumerValidationKinds.flatMap((kind) => {
      const command = consumer.config.validation[kind];
      if (!command) return [];
      return [{
        id: `${consumer.config.name}-${kind}`,
        cwd: repositoryRelative(workspaceRoot, consumer.confirmedRoot ?? consumer.root),
        command,
        phase: "consumer-validation",
      }];
    }),
  );
}

async function buildPlanCandidate({
  config,
  configPath,
  planId,
  sourceRevision,
  plannedAt = new Date().toISOString(),
}) {
  if (!/^[a-f0-9]{40}$/.test(sourceRevision)) {
    throw new Error("Agent-native setup requires an immutable 40-character lowercase source revision.");
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(planId)) {
    throw new Error("Agent-native setup plan ID must contain only lowercase letters, digits, and hyphens.");
  }
  await assertExecutingSourceRevision(sourceRevision);

  if (config.profile !== "focused") {
    throw new Error("Agent-native setup currently requires the focused harness profile.");
  }
  const transaction = await planSetupTransaction({
    config,
    configPath,
    force: true,
    preservationTimestamp: planId,
    generationTimestamp: plannedAt,
  });
  const resolvedConfig = transaction.dryRunGenerated.resolvedConfig;
  const workspaceRoot = resolvedConfig.workspaceRoot;
  const consumers = await Promise.all(
    resolvedConfig.consumers.map((consumer) => consumerEvidence(consumer, workspaceRoot)),
  );
  const contextFile = transaction.dryRunGenerated.generatedFiles.find(
    (file) => file.targetRelative === "ai/context.md",
  );
  contextFile.content = withPopulateSection(contextFile.content, renderContextEvidence(consumers));

  const dryRunEntrypoints = await installConsumerEntrypoints(resolvedConfig, {
    dryRun: true,
    force: true,
    preserveExistingGuidance: transaction.rootGuidanceConflicts.length > 0,
    preservationTimestamp: planId,
    generatedAt: plannedAt,
    preservedGuidanceByConsumer: transaction.preservedGuidanceByConsumer,
  });
  const workspaceEntrypoints = resolvedConfig.plan.entrypoints.workspace.map((entrypoint) => ({
    targetPath: path.join(workspaceRoot, entrypoint.path),
    content: transaction.dryRunGenerated.generatedFiles.find(
      (file) => file.targetRelative === entrypoint.source,
    ).content,
  }));

  const preservationOutputs = await Promise.all(
    transaction.rootGuidanceConflictGroups.map(async (group) => {
      const consumer = resolvedConfig.consumers.find(
        (item) => item.config.name === group.consumer,
      );
      return planConsumerRootGuidancePreservation({
        consumer: consumer.config,
        consumerRoot: group.consumerRoot,
        conflicts: group.files,
        timestamp: planId,
        generatedAt: plannedAt,
      });
    }),
  );

  const renderedTargets = [
    ...transaction.dryRunGenerated.generatedFiles.map((file) => ({
      targetPath: file.targetPath,
      content: file.content,
    })),
    { targetPath: transaction.dryRunGenerated.manifestFile.targetPath, content: transaction.dryRunGenerated.manifestFile.content },
    ...workspaceEntrypoints,
    { targetPath: configPath, content: transaction.renderedConfig },
    ...dryRunEntrypoints.map((entrypoint) => ({
      targetPath: entrypoint.targetPath,
      content: entrypoint.content,
    })),
    ...preservationOutputs.flatMap((preservation) => preservation.outputs),
  ];
  const backupRoot = `.structor/backups/${planId}-agent-native-setup`;
  const planned = await Promise.all(renderedTargets.map((target) => plannedWrite({
    workspaceRoot,
    targetPath: target.targetPath,
    content: target.content,
    backupRoot,
  })));
  const writesByPath = new Map(planned.map((item) => [item.write.path, item.write]));
  const writes = [...writesByPath.values()].sort((left, right) => left.path.localeCompare(right.path));
  const preservedBackups = new Map(preservationOutputs.flatMap((preservation) =>
    preservation.outputs
      .filter((output) => output.sourcePath)
      .map((output) => [
        repositoryRelative(workspaceRoot, output.sourcePath),
        repositoryRelative(workspaceRoot, output.targetPath),
      ])));
  const backups = planned.flatMap((item) => {
    if (!item.backup) return [];
    const backupPath = preservedBackups.get(item.backup.sourcePath);
    if (!backupPath) {
      throw new Error(
        `Agent-native setup cannot replace ${item.backup.sourcePath} because it has no deterministic preservation path. Use the guided init flow for harness regeneration.`,
      );
    }
    return [{ ...item.backup, backupPath }];
  });
  const evidenceRoot = `evidence/setup/${planId}`;
  const consumerPaths = resolvedConfig.consumers.map((consumer) =>
    repositoryRelative(workspaceRoot, consumer.confirmedRoot ?? consumer.root));
  const existingGuidance = transaction.rootGuidanceConflicts.map((conflict) =>
    repositoryRelative(workspaceRoot, conflict.targetPath));
  const consumerCommands = plannedConsumerValidationCommands(resolvedConfig, workspaceRoot);

  return {
    plan: {
      contractVersion: agentNativeContractVersion,
      schemaVersion: installationPlanSchemaVersion,
      planId,
      structor: { packageVersion: await packageVersion(), sourceRevision },
      scope: { workspace: ".", consumers: consumerPaths },
      decisions: [
        { id: "consumer-repositories", level: "recommended-confirmed", selection: consumerPaths.join(","), provenance: consumers.map((item) => item.sourcePath) },
        { id: "project-identity", level: "recommended-confirmed", selection: config.project.slug, provenance: consumers.map((item) => item.sourcePath) },
        { id: "topology", level: "recommended-confirmed", selection: "workspace", provenance: consumers.map((item) => item.sourcePath) },
        { id: "enabled-clients", level: "explicit", selection: enabledClients(config), provenance: [] },
        { id: "generation-timestamp", level: "explicit", selection: plannedAt, provenance: [] },
        { id: "existing-guidance", level: "explicit", selection: existingGuidance.length > 0 ? "preserve" : "none", provenance: existingGuidance },
      ],
      reads: [
        ...consumers.map((item) => ({
          path: item.sourcePath,
          reason: "Extract manifest-declared population evidence",
        })),
        ...existingGuidance.map((guidancePath) => ({
          path: guidancePath,
          reason: "Detect, hash, and preserve approved existing root guidance",
        })),
      ],
      writes,
      commands: [
        { cwd: repositoryRelative(workspaceRoot, transaction.harnessRoot), command: "node scripts/bootstrap-workspace.mjs", phase: "setup" },
        { cwd: repositoryRelative(workspaceRoot, transaction.harnessRoot), command: "node scripts/validate-governance.mjs", phase: "validation" },
        { cwd: repositoryRelative(workspaceRoot, transaction.harnessRoot), command: "node scripts/check-workspace.mjs", phase: "validation" },
        ...consumerCommands.map(({ id, ...command }) => command),
      ],
      preservation: {
        backupRequired: backups.length > 0,
        existingGuidance,
        backups,
        rollbackStrategy: {
          trigger: "filesystem-or-structor-invariant-failure",
          removeCreatedPaths: true,
          restoreBackups: true,
        },
      },
      population: {
        approvedConsumers: consumerPaths,
        automaticPromotions: consumers
          .filter((item) => item.packageName)
          .map((item) => `${item.config.name}:package-name`),
        reviewRequiredClaims: ["architecture", "ownership", "security", "workflow", "deployment", "domain"],
      },
      validationGates: [
        { id: "governance", required: true, command: "node scripts/validate-governance.mjs" },
        { id: "workspace", required: true, command: "node scripts/check-workspace.mjs" },
        ...consumerCommands.map((command) => ({
          id: command.id,
          required: false,
          command: command.command,
        })),
      ],
      evidenceOutputs: canonicalInstallationEvidenceOutputPaths.map(
        (artifact) => `${evidenceRoot}/${artifact}`,
      ),
    },
    transaction,
    consumers,
    workspaceRoot,
  };
}

export async function planAgentNativeSetup(options) {
  const plan = (await buildPlanCandidate(options)).plan;
  assertCompleteInstallationPlan(plan);
  return plan;
}

function assertSamePlan(expected, actual) {
  if (canonicalJson(expected) !== canonicalJson(actual)) {
    throw new Error("Installation plan no longer matches the current config, source state, or rendered writes.");
  }
}

function reportMarkdown({ plan, result, consumers }) {
  const decisions = plan.decisions.map((decision) =>
    `- ${decision.id}: ${decision.selection} (${decision.level}; provenance: ${decision.provenance.join(", ") || "explicit"})`).join("\n");
  const facts = consumers.map((consumer) =>
    `- ${consumer.sourcePath} declares package ${consumer.packageName ?? "without a name"}.`).join("\n");
  const changes = result.actualWrites.map((write) => `- Applied ${write.path}.`).join("\n");
  const commands = result.commands.map((command) =>
    `- Command: \`${command.command}\` (cwd: \`${command.cwd}\`, status: \`${command.status}\`)`).join("\n");
  return `# Setup Report\n\n## Versions\n\n- Structor package: \`${plan.structor.packageVersion}\`\n- Contract: \`${plan.contractVersion}\`\n- Plan schema: \`${plan.schemaVersion}\`\n- Source revision: \`${plan.structor.sourceRevision}\`\n\n## Detected Facts\n\n${facts}\n\n## Decisions And Provenance\n\n${decisions}\n- Evidence bundle: \`${result.evidenceBundle}\`\n\n## Plan And Approval\n\n- Plan hash: \`${result.planHash}\`\n- Approval receipt matches the plan hash.\n- Hash binding does not prove whether a human or agent supplied approval.\n\n## Changes\n\n${changes}\n\n## Validation\n\n${commands}\n\n## Population\n\n- Promoted only manifest-declared mechanical facts.\n- Architecture, ownership, security, workflow, deployment, and domain guidance remain review-required.\n\n## Outcome And Readiness\n\n- Execution outcome: \`${result.executionOutcome}\`\n- Readiness: \`${result.readiness}\`\n\n## Risks And Recovery\n\n- Review populated starter guidance before treating it as trusted policy.\n- Create and approve a new plan before retrying changed work.\n`;
}

async function writeEvidenceBundle({ plan, receipt, result, consumers, workspaceRoot }) {
  const bundleRelative = `evidence/setup/${plan.planId}`;
  const bundleRoot = path.join(workspaceRoot, bundleRelative);
  repositoryRelative(workspaceRoot, bundleRoot);
  await mkdir(bundleRoot, { recursive: true });
  const artifacts = {
    "installation-plan.json": jsonFile(plan),
    "approval-receipt.json": jsonFile(receipt),
    "result.json": jsonFile(result),
    "report.md": reportMarkdown({ plan, result, consumers }),
  };
  for (const [artifact, content] of Object.entries(artifacts)) {
    await writeFile(path.join(bundleRoot, artifact), content);
  }
  const manifest = {
    contractVersion: plan.contractVersion,
    schemaVersion: plan.schemaVersion,
    runId: plan.planId,
    sourceRevision: plan.structor.sourceRevision,
    planHash: result.planHash,
    artifacts: Object.entries(artifacts).map(([artifact, content]) => ({
      path: artifact,
      hash: sha256(content),
    })),
    evidence: consumers.filter((consumer) => consumer.packageName).map((consumer) => ({
      id: `${consumer.config.name}-package-name`,
      classification: "observed",
      confidence: "high",
      sourcePath: consumer.sourcePath,
      extractor: "package-json-name",
      contentHash: consumer.sourceHash,
    })),
    delegation: [],
    sanitized: true,
  };
  assertCompleteEvidenceManifest(manifest);
  await writeFile(path.join(bundleRoot, "manifest.json"), jsonFile(manifest));
  return { bundleRoot, manifest };
}
function commandResults(plan, statuses) {
  return plan.commands.map((command, index) => ({
    cwd: command.cwd,
    command: command.command,
    status: statuses[index],
  }));
}

function validationResults(plan, statuses, rollback = false) {
  return plan.validationGates.map((gate, index) => {
    const status = statuses[index + 1];
    return {
      id: gate.id,
      required: gate.required,
      status,
      reason: status === "passed"
        ? ""
        : status === "failed"
          ? (rollback
            ? "This validation failed and the structural transaction rolled back."
            : "Configured consumer validation failed without rolling back setup.")
          : "The validation was skipped because setup did not reach this gate.",
    };
  });
}

function runConsumerValidations(plan, workspaceRoot, statuses) {
  for (let index = 3; index < plan.commands.length; index += 1) {
    const plannedCommand = plan.commands[index];
    const result = spawnSync(plannedCommand.command, {
      cwd: path.join(workspaceRoot, plannedCommand.cwd),
      encoding: "utf8",
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    statuses[index] = result.status === 0 ? "passed" : "failed";
  }
}

async function finalizeSuccessfulExecution({
  plan,
  receipt,
  consumers,
  workspaceRoot,
  actualWrites,
  statuses,
  executedAt,
}) {
  runConsumerValidations(plan, workspaceRoot, statuses);
  const consumerFailures = plan.commands
    .map((command, index) => ({ command, status: statuses[index] }))
    .filter(({ command, status }) =>
      command.phase === "consumer-validation" && status === "failed");
  const result = {
    contractVersion: plan.contractVersion,
    schemaVersion: plan.schemaVersion,
    planHash: installationPlanHash(plan),
    executedAt,
    executionOutcome: "applied",
    readiness: "ready_with_warnings",
    actualWrites,
    commands: commandResults(plan, statuses),
    validationOutcomes: validationResults(plan, statuses),
    rollback: { attempted: false, completed: false, restoredPaths: [] },
    evidenceBundle: `evidence/setup/${plan.planId}`,
    unresolvedRisks: [
      "Populated natural-language guidance requires human review",
      ...consumerFailures.map(({ command }) =>
        `Consumer validation failed without rolling back setup: ${command.command}`),
    ],
  };
  const evidence = await writeEvidenceBundle({
    plan,
    receipt,
    result,
    consumers,
    workspaceRoot,
  });
  return { result, manifest: evidence.manifest, evidenceBundle: evidence.bundleRoot };
}

export async function applyAgentNativeSetup({
  plan,
  receipt,
  config,
  configPath,
  executedAt = new Date().toISOString(),
  executeGeneratedScript,
}) {
  assertApprovedInstallationPlan(plan, receipt);
  const candidate = await buildPlanCandidate({
    config,
    configPath,
    planId: plan.planId,
    sourceRevision: plan.structor.sourceRevision,
    plannedAt: plan.decisions.find(
      (decision) => decision.id === "generation-timestamp",
    )?.selection,
  });
  assertSamePlan(plan, candidate.plan);
  const preserveExistingGuidance =
    plan.decisions.find((decision) => decision.id === "existing-guidance")?.selection === "preserve";

  const actualWrites = [];
  const statuses = plan.commands.map(() => "skipped");
  let successfulExecution = null;
  const contextWrite = plan.writes.find((write) => write.path.endsWith("/ai/context.md"));
  const contextContent = candidate.transaction.dryRunGenerated.generatedFiles.find(
    (file) => file.targetRelative === "ai/context.md",
  ).content;
  try {
    await applySetupTransaction(candidate.transaction, {
      preserveExistingGuidance,
      createRegenerationBackup: false,
      ...(executeGeneratedScript ? { executeGeneratedScript } : {}),
      onCommandStatus: ({ script, status }) => {
        if (status === "running") return;
        const index = plan.commands.findIndex((command) =>
          command.phase !== "consumer-validation"
          && command.command === `node ${script.relativeScriptPath}`);
        if (index !== -1) statuses[index] = status;
      },
      beforeCompletionGates: async () => {
        await writeFile(path.join(candidate.workspaceRoot, contextWrite.path), contextContent);
        for (const write of plan.writes) {
          const content = await readFile(path.join(candidate.workspaceRoot, write.path));
          const contentHash = sha256(content);
          if (contentHash !== write.contentHash) {
            throw new Error(`Applied content does not match installation plan for ${write.path}.`);
          }
          actualWrites.push({ path: write.path, contentHash });
        }
      },
      afterCompletionGates: async () => {
        successfulExecution = await finalizeSuccessfulExecution({
          plan,
          receipt,
          consumers: candidate.consumers,
          workspaceRoot: candidate.workspaceRoot,
          actualWrites,
          statuses,
          executedAt,
        });
      },
    });
  } catch (error) {
    const rollbackCompleted = !(error instanceof AggregateError);
    const result = {
      contractVersion: plan.contractVersion,
      schemaVersion: plan.schemaVersion,
      planHash: installationPlanHash(plan),
      executedAt,
      executionOutcome: rollbackCompleted ? "rolled_back" : "failed",
      readiness: "blocked",
      actualWrites: [],
      commands: commandResults(plan, statuses),
      validationOutcomes: validationResults(plan, statuses, true),
      rollback: {
        attempted: true,
        completed: rollbackCompleted,
        restoredPaths: plan.writes.map((write) => write.path),
      },
      evidenceBundle: `evidence/setup/${plan.planId}`,
      unresolvedRisks: [
        rollbackCompleted
          ? "The structural setup failed and filesystem changes were rolled back."
          : "The structural setup and automatic rollback both failed; inspect the selected workspace.",
      ],
    };
    const evidence = await writeEvidenceBundle({
      plan, receipt, result, consumers: candidate.consumers, workspaceRoot: candidate.workspaceRoot,
    });
    return { result, manifest: evidence.manifest, evidenceBundle: evidence.bundleRoot };
  }
  return successfulExecution;
}
