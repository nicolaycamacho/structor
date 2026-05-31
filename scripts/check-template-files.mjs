#!/usr/bin/env node

import path from "node:path";
import { collectFiles, exists, failIfErrors, repoRoot } from "./lib.mjs";
import {
  generatedHarnessContractErrors,
  generatedHarnessTemplatePaths,
} from "./generated-harness-contract.mjs";

const requiredFiles = generatedHarnessTemplatePaths();
const declared = new Set(requiredFiles);
const actualTemplateFiles = await collectFiles("template", (relativePath) => relativePath.endsWith(".tpl"));
const errors = generatedHarnessContractErrors();

for (const relativePath of requiredFiles) {
  if (!(await exists(path.join(repoRoot, relativePath)))) {
    errors.push(`missing ${relativePath}`);
  }
}

for (const relativePath of actualTemplateFiles) {
  if (!declared.has(relativePath)) {
    errors.push(`${relativePath} is not declared in scripts/generated-harness-contract.mjs`);
  }
}

failIfErrors("Template file check", errors);
