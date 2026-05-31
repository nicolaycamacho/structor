#!/usr/bin/env node

import { access, constants as fsConstants, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const models = {
  openai: {{MODEL_OPENAI_ENABLED}},
  anthropic: {{MODEL_ANTHROPIC_ENABLED}},
};
const clientSupport = {
  codexHooks: {{CLIENT_CODEX_HOOKS_ENABLED}},
};
const generatedContractScript = "scripts/generated-harness-contract.mjs";
const generatedScriptHashes = {{GENERATED_SCRIPT_HASHES_JSON}};

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function exists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function assertTrustedCheck(relativePath) {
  const expectedHash = generatedScriptHashes[relativePath];
  if (!expectedHash) {
    throw new Error(
      `Refusing to execute ${relativePath}: no trusted generated hash is recorded. ` +
        "Inspect the file and regenerate with --force after review if it should be replaced.",
    );
  }

  let content;
  try {
    content = await readFile(path.join(repoRoot, relativePath));
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        `Refusing to execute ${relativePath}: the expected generated script is missing. ` +
          "Regenerate the harness after reviewing the output directory.",
      );
    }
    throw error;
  }

  const actualHash = sha256(content);
  if (actualHash !== expectedHash) {
    throw new Error(
      `Refusing to execute ${relativePath}: content does not match the current generated template. ` +
        "Inspect the preserved file and regenerate with --force after review if it should be replaced.",
    );
  }
}

async function runCheck(relativePath) {
  await assertTrustedCheck(relativePath);
  for (const dependency of validationPlan.checkDependencies[relativePath] ?? []) {
    await assertTrustedCheck(dependency);
  }

  execFileSync(process.execPath, [path.join(repoRoot, relativePath)], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

await assertTrustedCheck(generatedContractScript);
const { validationPlanForSettings } = await import(pathToFileURL(path.join(repoRoot, generatedContractScript)).href);
const validationPlan = validationPlanForSettings({ models, clientSupport });

for (const check of validationPlan.requiredChecks) {
  await runCheck(check);
}

for (const optionalCheck of validationPlan.optionalChecks) {
  if (await exists(optionalCheck)) {
    await runCheck(optionalCheck);
  }
}

for (const check of validationPlan.conditionalChecks) {
  await runCheck(check);
}

console.log("Governance validation passed.");
