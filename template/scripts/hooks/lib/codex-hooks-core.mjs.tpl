const docsWorkflow = "ai/WORKFLOW.md";
const docsQuality = "ai/QUALITY.md";
const docsHub = "ai/HUB.md";
const docsContext = "ai/context.md";
const taskBriefTemplate = "ai/templates/task-brief-template.md";
const eventSessionStart = "SessionStart";
const eventUserPromptSubmit = "UserPromptSubmit";
const eventPreToolUse = "PreToolUse";
const eventPermissionRequest = "PermissionRequest";
const eventPostToolUse = "PostToolUse";
const eventStop = "Stop";
const workflowDocs = [docsWorkflow, docsHub, docsContext];
const taskDocs = [docsWorkflow, taskBriefTemplate];
const postToolDocs = [docsWorkflow, docsQuality];
const stopDocs = [docsWorkflow, docsQuality];
const promptRequiresContextPattern = /\b(implement|fix|change|refactor|update|edit)\b/i;
const commandFailurePattern = /fail|timeout|error/i;
const finalMessagePattern = /commands run|validation|files changed/i;
const allowedActionAllow = "allow";

export const denyRules = [
  {
    id: "destructive-git-reset",
    pattern: /\bgit\s+reset\s+--hard\b/i,
    prevents: "discarding local work without explicit human approval",
    remediation: "stop and ask for approval before destructive git operations",
    policyDocs: ["ai/WORKFLOW.md", "ai/RUNNER-SAFETY.md"],
    falsePositiveNote: "Only applies to destructive reset operations.",
  },
  {
    id: "force-push",
    pattern: /\bgit\s+push\b.*\s--force(?:-with-lease)?\b/i,
    prevents: "rewriting remote history without explicit human approval",
    remediation: "use a normal push or ask for approval with the exact branch and reason",
    policyDocs: ["ai/WORKFLOW.md", "ai/RUNNER-SAFETY.md"],
    falsePositiveNote: "Normal non-force pushes are not denied by this rule.",
  },
  {
    id: "secret-read",
    pattern: /\b(?:cat|sed|grep|rg|less|tail|head)\b.*(?:\.env|secret|token|credential)/i,
    prevents: "unnecessary secret exposure in agent context",
    remediation: "read documented env var names instead of secret values",
    policyDocs: ["ai/RUNNER-SAFETY.md", "ai/contracts/security-boundary.md"],
    falsePositiveNote: "Adjust this generic rule if the project has fixture files with safe secret-like names.",
  },
];

export function parseInput(rawInput) {
  if (!rawInput.trim()) return {};
  return JSON.parse(rawInput);
}

export function context(message, docs = []) {
  return { action: "context", message, docs };
}

export function allow(message = "Allowed by harness hook policy.") {
  return { action: "allow", message };
}

export function deny(rule) {
  return {
    action: "deny",
    message: `${rule.id}: ${rule.prevents}. ${rule.remediation}.`,
    docs: rule.policyDocs,
  };
}

export function evaluate(event, input) {
  if (event === "SessionStart") {
    return context("Load the repo entrypoint, ai/AGENTS.md, ai/HUB.md, and ai/context.md before feature work.", [
      "AGENTS.md",
      ...workflowDocs,
    ]);
  }

  if (event === eventUserPromptSubmit) {
    const prompt = String(input.prompt ?? "");
    if (promptRequiresContextPattern.test(prompt)) {
      return context("Before editing, identify expected files, preserved contracts, and validation commands.", [
        ...taskDocs,
      ]);
    }
    return allow();
  }

  if (event === eventPreToolUse || event === eventPermissionRequest) {
    const command = String(input.command ?? input.toolInput?.cmd ?? "");
    for (const rule of denyRules) {
      if (rule.pattern.test(command)) return deny(rule);
    }
    return allow();
  }

  if (event === eventPostToolUse) {
    const exitCode = Number(input.exitCode ?? 0);
    const status = String(input.status ?? "");
    if (exitCode !== 0 || commandFailurePattern.test(status)) {
      return context("A command failed or timed out. Report the exact command, failure, and next repair step.", [...postToolDocs]);
    }
    return allow();
  }

  if (event === eventStop) {
    const changedFiles = Array.isArray(input.changedFiles) ? input.changedFiles : [];
    const finalMessage = String(input.finalMessage ?? "");
    if (changedFiles.length > 0 && !finalMessagePattern.test(finalMessage)) {
      return context("Final response should include files changed and validation evidence.", [...stopDocs]);
    }
    return allow();
  }

  return context("Unknown hook event. Defaulting to context-only behavior.");
}
