---
id: TEMPLATE-HARNESS-ASSESS-EXAMPLE
status: backlog
risk: medium
autonomy: pr_ready
model_policy: frontier
model: runtime-selected
repos:
  - <template-repo-path>
  - <reference-harness-repo-a-path>
  - <reference-harness-repo-b-path>
allowed_paths:
  - <template-repo-path>
forbidden_paths:
  - <reference-harness-repo-a-path>
  - <reference-harness-repo-b-path>
requires_human_approval: true
---

# Example: Assess And Harden Harness Template Gaps

## Summary

Example task brief for researching an `ai-engineering-harness-template`
checkout against two configured reference engineering harness repositories and
current public harness-engineering guidance, then implementing the
template-owned gaps that are clearly justified by the assessment.

Reference harness repos remain read-only evidence sources. Implementation is
limited to the configured template repo.

## Context

The template repo creates generic, reusable project-specific engineering
harness repositories. It owns harness policy, context routing, contracts, task
shape, validation, review rules, model overlays, quality tracking, and
workspace bootstrap scaffolding.

The template intentionally does not own runner behavior. Runner behavior means
polling, agent-session orchestration, PR automation, dashboards, repair loops,
CI shepherding, auto-merge, and other external writes.

Reference harness repos to inspect after replacing placeholders:

- `<reference-harness-repo-a-path>`
- `<reference-harness-repo-b-path>`

Current template repo to assess:

- `<template-repo-path>`

External references to read:

- `https://openai.com/index/harness-engineering/`
- `https://www.anthropic.com/engineering/harness-design-long-running-apps`

If web access is blocked, request approval for network access. Do not replace
the articles with memory-derived or stale summaries.

## Goals

- Describe what each reference harness repo does.
- Compare the two reference harness repos across purpose, structure, policy,
  generated artifacts, validation, bootstrap behavior, model support, runner
  boundaries, and production-readiness.
- Convert the OpenAI and Anthropic articles into practical evaluation criteria
  for a robust production-grade modern engineering harness.
- Assess the template repo against the reference repos and article-derived
  criteria.
- Identify missing template capabilities, documentation, validation, examples,
  and bootstrap affordances.
- Separate template-owned gaps from runner/runtime concerns that are out of
  scope unless product direction changes.
- Implement narrow template-owned improvements when the gap is clear and does
  not add runner/orchestration behavior.

## Non-Goals

- Do not change either reference harness repo.
- Do not create consumer repo pointer files.
- Do not run bootstrap commands that write outside this template repo.
- Do not create or modify GitHub, Linear, Notion, Slack, Vercel, or other remote
  resources.
- Do not implement runner/orchestration behavior in this template.
- Do not treat either reference repo as automatically canonical; extract only
  reusable patterns that fit a generic harness-template purpose.

## Scope

In scope:

- Read-only inspection of the two reference harness repos.
- Read-only inspection of the configured template repo.
- Reading the two external harness-engineering articles.
- Safe local validation and dry-run style checks.
- A written assessment report, scoped implementation, and validation evidence.

Out of scope:

- Remote writes.
- Consumer repo writes.
- Destructive commands.
- Runner implementation.

## Path Contract

### Allowed Paths

- `<template-repo-path>`

### Forbidden Paths

- `<reference-harness-repo-a-path>`
- `<reference-harness-repo-b-path>`

### Protected Contracts

- The template remains generic and reusable.
- Generated canonical policy stays under `template/ai/*`.
- Model overlays and consumer entrypoints stay thin.
- Existing template CLI commands, validation commands, and generated artifact
  paths remain backward compatible unless explicitly approved.
- Runner, orchestration, polling, PR automation, and external-write behavior
  remain outside this template.

## Requirements

- Before execution, replace every placeholder path in the frontmatter and body
  with concrete local paths.
- Start by verifying that the template repo and both configured reference
  harness repo paths exist. If a configured path does not exist exactly, stop
  and report the path failure instead of guessing an alternate path.
- Do not stop at README files. Inspect repo-local agent entrypoints, docs,
  scripts, schemas, templates, validation commands, generated-output shape,
  model overlays, workspace/bootstrap behavior, task templates, contracts, and
  harness-vs-runner boundaries.
- Use current file contents as evidence. Cite file paths for every major claim.
- Read both external articles directly. Summarize them into an explicit
  evaluation checklist before assessing the template.
- Run only safe local validation commands. Prefer existing validation commands
  such as `npm run validate` and dry-run generation where available.
- Do not run commands that write outside the template repo without human
  approval.
- Categorize findings as:
  - `must-have gaps`
  - `should-have gaps`
  - `explicitly out-of-scope runner/runtime concerns`
  - `unclear items needing human decision`
- Define missingness as capabilities or docs needed for this template to
  reliably generate a robust, generic, project-specific engineering harness
  from a prompt-driven bootstrap flow.
- Implement only gaps owned by this template repo.

## Bootstrap Requirements

Before implementation, the agent must:

- Read this repo's root `AGENTS.md`, `README.md`, `harness.config.example.json`,
  `template/ai/AGENTS.md.tpl`, `template/ai/HUB.md.tpl`, and
  `scripts/init-harness.mjs`.
- Verify all three repo paths before using them as evidence.
- Identify which files are active templates, generated harness scripts,
  reference-only docs, and out-of-scope runner surfaces.
- Identify safe local validation commands and dry-run checks before editing.
- Report missing, stale, or contradictory evidence before implementation.

Expected evidence:

- Context files read.
- Repo path existence results.
- External article access result.
- Safe validation commands discovered.
- Any mismatch or ambiguity found.

## Proposed Approach

- Inspect the current template repo and both reference harness repos without
  writing to the reference repos.
- Read the OpenAI and Anthropic harness-engineering articles directly and turn
  them into an evaluation checklist.
- Compare the template against the checklist and reference repos.
- Separate template-owned gaps from runner/runtime concerns.
- Implement only narrow template-owned improvements that preserve generated
  harness boundaries and validation behavior.
- Reject concrete model hardcoding in task briefs; use runtime-neutral model
  policy that can map to Codex or Claude when the executing runtime is known.

Alternatives considered:

- Add runner-oriented model assignment to task briefs. Rejected because this
  template does not own runner behavior.
- Copy reference-harness policy wholesale. Rejected because this template must
  stay generic and reusable.

Key trade-offs:

- Runtime-neutral model policy is less prescriptive than concrete model IDs but
  avoids stale or provider-specific defaults in generated harnesses.
- Static validation should enforce durable task shape without trying to infer
  every project-specific policy decision.

## Agent Execution Protocol

Before changing files, the agent must state:

- Files expected to change.
- Reference repos expected to remain read-only.
- Contracts expected to remain unchanged.
- Validation commands it will run.
- Risks or ambiguities found.

The agent must not proceed if the plan conflicts with the Path Contract, risk
and autonomy, or Open Questions sections.

## Success Criteria

- The assessment separates must-have gaps, should-have gaps, out-of-scope
  runner/runtime concerns, and unclear human decisions.
- Implemented changes are limited to template-owned harness improvements.
- Generated task-brief guidance remains model-family neutral and does not
  hardcode provider model IDs.
- Generated harness governance validation checks the task-brief shape.
- `npm run validate` passes, or any skipped/failing validation is reported with
  an exact blocker.

## Validation

- Verify repo path existence for all three repos.
- Run safe validation commands discovered in each repo when they do not require
  writes outside that repo, external services, database access, or destructive
  operations.
- In this template repo, run `npm run validate` if no unrelated local issue
  blocks it.
- If a validation command is skipped, document the exact reason.

## Validation Evidence Required

- Repo paths checked and their existence result.
- External URLs read, with access date.
- Commands run, working directories, and summarized outputs.
- Commands skipped and why.
- File-path evidence for major claims.
- Files changed.
- Explicit list of must-have gaps, should-have gaps, out-of-scope runner
  concerns, and open human decisions.

## Review Routing

- Architecture review for harness/template boundaries.
- Governance-drift review for task shape, context routing, contracts, and
  validation expectations.
- Human review before converting any recommended task into implementation.

## Dependencies

- The exact reference repo paths listed in this brief must exist locally.
- Network access is required to read the OpenAI and Anthropic articles.
- Safe local validation depends on the template repo's existing Node.js
  validation scripts.
- Human approval is required before any write outside the template repo.

## Rollback / Recovery

This task should only modify the template repo. If a command unexpectedly
changes files outside the template repo, stop immediately, report the changed
paths, and ask for human direction before reverting or continuing.

If web access is unavailable, stop after local repo inspection and report the
missing article evidence as a blocker rather than completing the production
harness criteria from memory.

## Open Questions

- Replace placeholder paths before execution.

## Notes for the Agent

- Keep reference repos read-only.
- Keep generated template content generic and project-neutral.
- Do not add runner behavior while improving runner-readiness documentation.
- Do not use stale memory summaries as a substitute for direct article access.
- Do not silently skip validation.
