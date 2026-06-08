#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateHarness,
  installConsumerEntrypoints,
} from "./init-harness.mjs";
import {
  assertSafeWriteTarget,
  exists,
} from "./lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(repoRoot);
const presetRoot = path.join(repoRoot, "contrib/self-harness");
const presetConfigPath = path.join(presetRoot, "harness.config.json");
const overlayRoot = path.join(presetRoot, "files");

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
  };
}

async function collectOverlayFiles() {
  const files = [];

  async function walk(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile()) {
        files.push(path.relative(overlayRoot, absolutePath).replaceAll(path.sep, "/"));
      }
    }
  }

  await walk(overlayRoot);
  return files.sort();
}

async function overlaySelfHarnessFiles(outputRoot, options) {
  for (const relativePath of await collectOverlayFiles()) {
    const sourcePath = path.join(overlayRoot, relativePath);
    const targetPath = path.join(outputRoot, relativePath);
    const existed = await exists(targetPath);

    if (options.dryRun) {
      console.log(`would ${existed ? "overwrite" : "create"} self-harness overlay ${targetPath}`);
      continue;
    }

    await assertSafeWriteTarget({
      targetPath,
      rootPath: outputRoot,
      label: `Self-harness overlay ${relativePath}`,
    });
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, await readFile(sourcePath, "utf8"));
    console.log(`${existed ? "wrote" : "created"} self-harness overlay ${targetPath}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = JSON.parse(await readFile(presetConfigPath, "utf8"));

  console.log("Structor contributor setup");
  console.log(`Workspace: ${workspaceRoot}`);
  console.log(`Preset: ${presetConfigPath}`);

  const { resolvedConfig } = await generateHarness(config, {
    configPath: presetConfigPath,
    configDir: workspaceRoot,
    dryRun: options.dryRun,
    force: true,
    allowTemplateRepoConsumer: true,
  });

  await overlaySelfHarnessFiles(resolvedConfig.outputRoot, options);

  const bootstrapArgs = ["scripts/bootstrap-workspace.mjs"];
  if (options.force) bootstrapArgs.push("--force");

  if (options.dryRun) {
    console.log(`would refresh self-harness HTML views in ${resolvedConfig.outputRoot}`);
    console.log(`would run workspace bootstrap dry-run in ${resolvedConfig.outputRoot}: ${process.execPath} ${bootstrapArgs.join(" ")}`);
  } else {
    execFileSync(process.execPath, ["scripts/generate-html-views.mjs"], {
      cwd: resolvedConfig.outputRoot,
      stdio: "inherit",
    });
    execFileSync(process.execPath, bootstrapArgs, {
      cwd: resolvedConfig.outputRoot,
      stdio: "inherit",
    });
  }

  console.log("Source entrypoint preview");
  await installConsumerEntrypoints(resolvedConfig, {
    dryRun: true,
    force: options.force,
    config: presetConfigPath,
    allowRootGuidanceOverwrite: true,
  });

  if (!options.dryRun) {
    console.log("Source entrypoint apply");
    await installConsumerEntrypoints(resolvedConfig, {
      dryRun: false,
      force: options.force,
      config: presetConfigPath,
      allowRootGuidanceOverwrite: true,
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
