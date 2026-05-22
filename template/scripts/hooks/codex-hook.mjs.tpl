#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { allow, context, evaluate, parseInput } from "./lib/codex-hooks-core.mjs";

const event = process.argv[2] ?? "UnknownEvent";
const jsonOnly = process.argv.includes("--json");

function emit(result) {
  const output = JSON.stringify(result);
  console.log(output);
  if (result.action === "deny") process.exit(2);
}

try {
  const rawInput = readFileSync(0, "utf8");
  emit(evaluate(event, parseInput(rawInput)));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const result = context(`Codex hook could not parse input safely: ${message}`);
  if (jsonOnly) {
    emit(result);
  } else {
    emit(allow("Hook parse failure is non-blocking; continue and report if behavior looks wrong."));
  }
}
