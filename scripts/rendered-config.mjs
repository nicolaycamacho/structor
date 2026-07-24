import path from "node:path";

import { createTopologyPlan } from "./topology-plan.mjs";

const rawSlugPattern = /^[a-z0-9][a-z0-9-]*$/;

export function markdownText(value) {
  const normalized = String(value).replace(/\s+/g, " ").trim();
  const escaped = normalized.replace(/[\\`*_{}\[\]<>()#+!|>~]/g, "\\$&");
  return escaped.replace(/^([-+]) /, "\\$1 ").replace(/^(\d+)([.)]) /, "$1\\$2 ");
}

export function markdownCodeSpan(value) {
  const text = String(value)
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
  const longestBacktickRun = Math.max(0, ...Array.from(text.matchAll(/`+/g), (match) => match[0].length));
  const delimiter = "`".repeat(longestBacktickRun + 1);
  const padding = text.startsWith("`") || text.endsWith("`") || text.startsWith(" ") || text.endsWith(" ") ? " " : "";
  return `${delimiter}${padding}${text}${padding}${delimiter}`;
}

export function javascriptLiteral(value) {
  return JSON.stringify(value);
}

export function jsonLiteral(value) {
  return JSON.stringify(value, null, 2);
}

export function javascriptBoolean(value) {
  return value ? "true" : "false";
}

export function rawSlug(value, label) {
  const text = String(value);
  if (!rawSlugPattern.test(text)) {
    throw new Error(`${label} must be a safe slug before raw template rendering.`);
  }
  return text;
}

export function markdownPathCodeSpan(value) {
  return markdownCodeSpan(String(value).replaceAll(path.sep, "/"));
}

function consumerList(consumers) {
  return consumers.map((consumer) => `- ${markdownCodeSpan(consumer.name)}: ${markdownText(consumer.purpose)}`).join("\n");
}

function validationList(validation) {
  const entries = Object.entries(validation ?? {});
  if (entries.length === 0) return "- No local validation commands documented yet.";
  return entries.map(([name, command]) => `- ${markdownText(name)}: ${markdownCodeSpan(command)}`).join("\n");
}

function consumerNames(consumers) {
  return consumers.map((consumer) => rawSlug(consumer.name, "consumer.name"));
}

function consumerConfig(resolvedConsumers) {
  return resolvedConsumers.map(({ config: consumer, workspacePath }) => {
    return {
      ...consumer,
      name: rawSlug(consumer.name, "consumer.name"),
      workspacePath,
    };
  });
}

function guidanceMigrationConsumerSections(plan, preservedGuidanceByConsumer = {}) {
  return plan.consumers.map(({ config: consumer, workspacePath: consumerPath }) => {
    const preservedPath = preservedGuidanceByConsumer[consumer.name]?.directory ?? "none";
    return [
      `## ${markdownText(consumer.name)}`,
      "",
      "Consumer repo:",
      `  ${markdownPathCodeSpan(consumerPath.startsWith(".") ? consumerPath : `./${consumerPath}`)}`,
      "Generated harness:",
      `  ${markdownPathCodeSpan(plan.harness.workspacePath)}`,
      "Preserved guidance:",
      `  ${markdownPathCodeSpan(preservedPath)}`,
      "Migration targets:",
      "  ai/context.md",
      "  ai/HUB.md",
      "  ai/ARCHITECTURE.md",
      "  ai/WORKFLOW.md",
      "  ai/QUALITY.md",
      "  ai/contracts/README.md",
      "  ai/workspace/TEST-STRATEGY.md",
    ].join("\n");
  }).join("\n\n");
}

export function renderedGeneratedScriptHashes(hashes) {
  return jsonLiteral(hashes);
}

export function harnessTemplateValuesForPlan(plan, options = {}) {
  const config = plan.config;
  const support = plan.clientSupport;
  const resolvedConsumers = plan.consumers;
  return {
    PROJECT_NAME: markdownText(config.project.name),
    PROJECT_NAME_CODE: markdownCodeSpan(config.project.name),
    PROJECT_NAME_JSON: javascriptLiteral(config.project.name),
    PROJECT_SLUG: rawSlug(config.project.slug, "project.slug"),
    HARNESS_REPO_NAME: rawSlug(config.project.harnessRepoName, "project.harnessRepoName"),
    WORKSPACE_HARNESS_PATH: plan.harness.workspacePath,
    WORKSPACE_ROOT_FROM_HARNESS_JSON: javascriptLiteral(plan.harness.workspaceRootFromHarness),
    CONSUMER_REPOS_LIST: consumerList(config.consumers),
    CONSUMER_REPO_NAMES_JSON: javascriptLiteral(consumerNames(config.consumers)),
    CONSUMER_CONFIG_JSON: jsonLiteral(consumerConfig(resolvedConsumers)),
    PRIMARY_CONSUMER_NAME: rawSlug(config.consumers[0].name, "consumer.name"),
    MODEL_OPENAI_ENABLED: javascriptBoolean(config.models.openai),
    MODEL_ANTHROPIC_ENABLED: javascriptBoolean(config.models.anthropic),
    CLIENT_CODEX_HOOKS_ENABLED: javascriptBoolean(support.codexHooks),
    CLIENT_CLAUDE_RULES_ENABLED: javascriptBoolean(support.claudeRules),
    CLIENT_CLAUDE_HOOKS_ENABLED: javascriptBoolean(support.claudeHooks),
    CLIENT_CLAUDE_SKILLS_ENABLED: javascriptBoolean(support.claudeSkills),
    GUIDANCE_MIGRATION_CONSUMER_SECTIONS: guidanceMigrationConsumerSections(
      plan,
      options.preservedGuidanceByConsumer,
    ),
  };
}

export function harnessTemplateValues(config, support, resolvedConsumers, outputRoot, workspaceRoot = path.dirname(outputRoot), options = {}) {
  return harnessTemplateValuesForPlan(createTopologyPlan({
    config,
    support,
    consumers: resolvedConsumers,
    outputRoot,
    workspaceRoot,
  }), options);
}

export function preservedGuidanceSection(preservedGuidancePath) {
  if (!preservedGuidancePath) return "";
  return [
    "## Preserved Guidance",
    "",
    "Existing root guidance was preserved at:",
    markdownPathCodeSpan(preservedGuidancePath),
    "",
    "Populate the generated harness before relying on it for real project work.",
    "Use the generated populate-generated-harness task in the Structor harness with a frontier model such as GPT-5.5 or Opus 4.8.",
    "Manually verify generated content, navigation, references, and commands before treating the harness as guidance-ready.",
    "",
  ].join("\n");
}

export function consumerEntrypointValues(config, consumer, harnessRelativePath, options = {}) {
  const harnessPath = (relativePath) => markdownPathCodeSpan(`${harnessRelativePath}/${relativePath}`);

  return {
    PROJECT_NAME: markdownText(config.project.name),
    CONSUMER_NAME: markdownText(consumer.name),
    CONSUMER_PURPOSE: markdownText(consumer.purpose),
    CONSUMER_VALIDATION_LIST: validationList(consumer.validation),
    HARNESS_AGENTS_PATH: harnessPath("AGENTS.md"),
    HARNESS_CLAUDE_PATH: harnessPath("CLAUDE.md"),
    HARNESS_AI_AGENTS_PATH: harnessPath("ai/AGENTS.md"),
    HARNESS_AI_HUB_PATH: harnessPath("ai/HUB.md"),
    HARNESS_AI_CONTEXT_PATH: harnessPath("ai/context.md"),
    PRESERVED_GUIDANCE_SECTION: preservedGuidanceSection(options.preservedGuidancePath),
  };
}
