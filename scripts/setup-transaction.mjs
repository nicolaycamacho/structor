import { spawnSync } from "node:child_process";
import { lstat, mkdir, readFile, readdir, readlink, rm, rmdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  collectConsumerRootGuidanceConflicts,
  filesystemTimestamp,
  generateHarness,
  installConsumerEntrypoints,
  render,
} from "./init-harness.mjs";
import { exists } from "./lib.mjs";
import {
  consumerEntrypointValues,
  harnessTemplateValuesForPlan,
} from "./rendered-config.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function completionScriptsForPlan(plan) {
  return [
    {
      phase: "Workspace bootstrap",
      relativeScriptPath: "scripts/bootstrap-workspace.mjs",
      failureLabel: "Workspace bootstrap failed.",
    },
    ...plan.validation.completionGates.map((relativeScriptPath, index) => ({
      phase: index === 0 ? "Completion gates" : null,
      relativeScriptPath,
      failureLabel: relativeScriptPath === "scripts/validate-governance.mjs"
        ? "Generated governance validation failed."
        : "Workspace completion check failed.",
    })),
  ];
}

function configContent(config) {
  return `${JSON.stringify(config, null, 2)}\n`;
}

function groupedGuidanceConflicts(conflicts) {
  const groups = new Map();
  for (const conflict of conflicts) {
    const current = groups.get(conflict.consumer) ?? {
      consumer: conflict.consumer,
      consumerPath: conflict.consumerPath,
      consumerRoot: conflict.consumerRoot,
      files: [],
    };
    current.files.push(conflict);
    groups.set(conflict.consumer, current);
  }
  return [...groups.values()];
}

function preservedGuidancePlan(conflicts, timestamp) {
  return Object.fromEntries(groupedGuidanceConflicts(conflicts).map((group) => [
    group.consumer,
    {
      directory: `.structor/preserved-guidance/${timestamp}`,
      files: group.files.map((file) => `.structor/preserved-guidance/${timestamp}/${file.path}`),
    },
  ]));
}

async function defaultExecuteGeneratedScript({ harnessRoot, relativeScriptPath, args = [], failureLabel, onCommandOutput }) {
  const result = spawnSync(process.execPath, [relativeScriptPath, ...args], {
    cwd: harnessRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  onCommandOutput(result);
  if (result.status !== 0) throw new Error(failureLabel);
}

function assertGeneratedScriptsReady(generatedFiles, plan) {
  const filesByPath = new Map(generatedFiles.map((file) => [file.targetRelative, file]));
  const notReady = completionScriptsForPlan(plan)
    .map((script) => script.relativeScriptPath)
    .filter((scriptPath) => {
      const file = filesByPath.get(scriptPath);
      return !file || file.action === "skipped" || !file.rendered;
    });

  if (notReady.length > 0) {
    throw new Error(
      `Generated setup scripts were not refreshed or verified:\n${notReady.map((item) => `- ${item}`).join("\n")}\nInspect the existing files and re-run with --force if they should be replaced.`,
    );
  }
}

async function assertNoEntrypointConflicts({ config, resolvedConfig, force }) {
  if (force) return;

  const { plan } = resolvedConfig;
  const conflicts = [];
  const harnessValues = harnessTemplateValuesForPlan(plan);

  for (const entrypoint of plan.entrypoints.workspace) {
    const targetPath = path.join(resolvedConfig.workspaceRoot, entrypoint.path);
    if (!(await exists(targetPath))) continue;
    const [actual, template] = await Promise.all([
      readFile(targetPath, "utf8"),
      readFile(path.join(packageRoot, "template", entrypoint.template), "utf8"),
    ]);
    if (actual !== render(template, harnessValues)) conflicts.push(`workspace:${entrypoint.path}`);
  }

  for (const resolvedConsumer of plan.consumers) {
    const consumer = resolvedConsumer.config;
    const consumerRoot = resolvedConsumer.confirmedRoot ?? resolvedConsumer.root;
    const values = consumerEntrypointValues(config, consumer, resolvedConsumer.harnessRelativePath);

    for (const entrypoint of plan.entrypoints.consumer) {
      if (entrypoint.path === "AGENTS.md" || entrypoint.path === "CLAUDE.md") continue;
      const targetPath = path.join(consumerRoot, entrypoint.path);
      if (!(await exists(targetPath))) continue;
      const [actual, template] = await Promise.all([
        readFile(targetPath, "utf8"),
        readFile(path.join(packageRoot, "template", entrypoint.template), "utf8"),
      ]);
      if (actual !== render(template, values)) conflicts.push(`consumer:${consumer.name}:${entrypoint.path}`);
    }
  }

  if (conflicts.length > 0) {
    throw new Error(
      `Entrypoint conflicts detected before bootstrap:\n${conflicts.map((item) => `- ${item}`).join("\n")}\nRe-run with --force to overwrite known Structor pointer surfaces.`,
    );
  }
}

async function snapshotTarget(targetPath) {
  try {
    const targetStat = await lstat(targetPath);
    if (targetStat.isSymbolicLink()) {
      return { kind: "symlink", link: await readlink(targetPath) };
    }
    if (targetStat.isFile()) return { kind: "file", content: await readFile(targetPath) };
    if (targetStat.isDirectory()) return { kind: "directory" };
    return { kind: "other" };
  } catch (error) {
    if (error?.code === "ENOENT") return { kind: "absent" };
    throw error;
  }
}

async function snapshotTargets(targetPaths) {
  const snapshots = new Map();
  for (const targetPath of new Set(targetPaths)) {
    snapshots.set(targetPath, await snapshotTarget(targetPath));
  }
  return snapshots;
}

async function snapshotTree(rootPath) {
  const rootSnapshot = await snapshotTarget(rootPath);
  const snapshots = new Map([[rootPath, rootSnapshot]]);
  if (rootSnapshot.kind !== "directory") return snapshots;

  async function walk(currentPath) {
    for (const entry of await readdir(currentPath, { withFileTypes: true })) {
      const targetPath = path.join(currentPath, entry.name);
      const snapshot = await snapshotTarget(targetPath);
      snapshots.set(targetPath, snapshot);
      if (snapshot.kind === "directory") await walk(targetPath);
    }
  }

  await walk(rootPath);
  return snapshots;
}

function deepestPathFirst([left], [right]) {
  return right.split(path.sep).length - left.split(path.sep).length;
}

async function removeEmptyParents(startPath, stopPath) {
  let current = path.dirname(startPath);
  const resolvedStop = path.resolve(stopPath);
  while (current.startsWith(`${resolvedStop}${path.sep}`)) {
    try {
      await rmdir(current);
    } catch (error) {
      if (error?.code === "ENOTEMPTY" || error?.code === "ENOENT") return;
      throw error;
    }
    current = path.dirname(current);
  }
}

async function restoreSnapshots(snapshots, rootPath) {
  for (const [targetPath, snapshot] of snapshots) {
    if (snapshot.kind === "absent") {
      await rm(targetPath, { recursive: true, force: true });
      await removeEmptyParents(targetPath, rootPath);
    } else if (snapshot.kind === "file") {
      await rm(targetPath, { recursive: true, force: true });
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, snapshot.content);
    } else if (snapshot.kind === "directory") {
      await mkdir(targetPath, { recursive: true });
    } else if (snapshot.kind === "symlink") {
      await rm(targetPath, { recursive: true, force: true });
      await mkdir(path.dirname(targetPath), { recursive: true });
      await symlink(snapshot.link, targetPath);
    }
  }
}

async function restoreTree(rootPath, snapshots, rollbackRoot = rootPath) {
  const current = await snapshotTree(rootPath);
  for (const [targetPath] of [...current].sort(deepestPathFirst)) {
    if (!snapshots.has(targetPath)) await rm(targetPath, { recursive: true, force: true });
  }
  await restoreSnapshots(snapshots, rollbackRoot);
}

export async function planSetupTransaction({ config, configPath, force = false, preservationTimestamp = filesystemTimestamp() }) {
  const renderedConfig = configContent(config);
  const dryRunGenerated = await generateHarness(config, {
    configPath,
    configContent: renderedConfig,
    requireExistingConsumers: true,
    force,
    dryRun: true,
  });
  const rootGuidanceConflicts = await collectConsumerRootGuidanceConflicts(dryRunGenerated.resolvedConfig);
  return {
    config,
    configPath,
    force,
    harnessRoot: path.dirname(configPath),
    renderedConfig,
    dryRunGenerated,
    rootGuidanceConflicts,
    rootGuidanceConflictGroups: groupedGuidanceConflicts(rootGuidanceConflicts),
    preservationTimestamp,
    preservedGuidanceByConsumer: preservedGuidancePlan(rootGuidanceConflicts, preservationTimestamp),
  };
}

export async function applySetupTransaction(plan, {
  preserveExistingGuidance = false,
  executeGeneratedScript = defaultExecuteGeneratedScript,
  onPhase = () => {},
  onCommandOutput = (result) => {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  },
  onConfigWritten = () => {},
} = {}) {
  if (plan.rootGuidanceConflicts.length > 0 && !preserveExistingGuidance) {
    throw new Error(
      `Existing root guidance files require explicit preservation consent:\n${plan.rootGuidanceConflicts.map((conflict) => `- ${conflict.targetPath}`).join("\n")}`,
    );
  }

  const { config, configPath, force, harnessRoot, dryRunGenerated } = plan;
  const resolvedConfig = dryRunGenerated.resolvedConfig;
  const { plan: topologyPlan } = resolvedConfig;
  const harnessRootExisted = await exists(harnessRoot);
  const harnessTargets = [
    ...dryRunGenerated.generatedFiles.map((file) => file.targetPath),
    configPath,
    path.join(harnessRoot, ".structor", "manifest.json"),
  ];
  const workspaceTargets = topologyPlan.entrypoints.workspace
    .map((entrypoint) => path.join(resolvedConfig.workspaceRoot, entrypoint.path));
  const consumerTargets = topologyPlan.consumers.flatMap((consumer) =>
    topologyPlan.entrypoints.consumer.map((entrypoint) =>
      path.join(consumer.confirmedRoot ?? consumer.root, entrypoint.path),
    ),
  );
  const preservationTargets = Object.entries(plan.preservedGuidanceByConsumer).map(([consumerName, preserved]) => {
    const consumer = resolvedConfig.consumers.find((item) => item.config.name === consumerName);
    const consumerRoot = consumer.confirmedRoot ?? consumer.root;
    return {
      consumerRoot,
      preservationPath: path.join(consumerRoot, preserved.directory),
    };
  });
  const [
    harnessSnapshots,
    viewSnapshots,
    workspaceSnapshots,
    consumerSnapshots,
    preservationSnapshots,
  ] = await Promise.all([
    snapshotTargets(harnessTargets),
    snapshotTree(path.join(harnessRoot, "ai", "views")),
    snapshotTargets(workspaceTargets),
    snapshotTargets(consumerTargets),
    Promise.all(
      preservationTargets.map(async ({ preservationPath }) => snapshotTree(preservationPath)),
    ),
  ]);

  try {
    await assertNoEntrypointConflicts({ config, resolvedConfig, force });
    const generated = await generateHarness(config, {
      configPath,
      configContent: plan.renderedConfig,
      requireExistingConsumers: true,
      force,
      dryRun: false,
      preservedGuidanceByConsumer: plan.preservedGuidanceByConsumer,
    });
    assertGeneratedScriptsReady(generated.generatedFiles, topologyPlan);

    const durableConfigExisted = await exists(configPath);
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, plan.renderedConfig);
    onConfigWritten({ action: durableConfigExisted ? "updated" : "wrote", path: configPath });

    generated.consumerEntrypoints = await installConsumerEntrypoints(resolvedConfig, {
      dryRun: false,
      force,
      preserveExistingGuidance,
      preservationTimestamp: plan.preservationTimestamp,
      preservedGuidanceByConsumer: plan.preservedGuidanceByConsumer,
    });

    const completedScripts = [];
    for (const script of completionScriptsForPlan(topologyPlan)) {
      if (script.phase) onPhase(script.phase);
      await executeGeneratedScript({
        harnessRoot,
        relativeScriptPath: script.relativeScriptPath,
        args: script.relativeScriptPath === "scripts/bootstrap-workspace.mjs" && force ? ["--force"] : [],
        failureLabel: script.failureLabel,
        onCommandOutput,
      });
      completedScripts.push(script.relativeScriptPath);
    }

    return {
      setupComplete: true,
      completedScripts,
      generated,
      harnessRoot,
      preservedGuidanceByConsumer: plan.preservedGuidanceByConsumer,
    };
  } catch (error) {
    try {
      for (let index = 0; index < preservationTargets.length; index += 1) {
        const { consumerRoot, preservationPath } = preservationTargets[index];
        await restoreTree(preservationPath, preservationSnapshots[index], consumerRoot);
      }
      await restoreSnapshots(consumerSnapshots, resolvedConfig.workspaceRoot);
      await restoreSnapshots(workspaceSnapshots, resolvedConfig.workspaceRoot);
      if (!harnessRootExisted) {
        await rm(harnessRoot, { recursive: true, force: true });
      } else {
        await restoreTree(path.join(harnessRoot, "ai", "views"), viewSnapshots, harnessRoot);
        await restoreSnapshots(harnessSnapshots, harnessRoot);
      }
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        `Setup failed with "${error.message}" and rollback also failed with "${rollbackError.message}".`,
        { cause: error },
      );
    }
    throw error;
  }
}
