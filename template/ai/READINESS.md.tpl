# Harness Readiness

This file defines the post-generation readiness contract for the
{{PROJECT_NAME}} harness. Readiness is a gate with evidence, not a numeric
score and not a golden semantic diff against an ideal harness.

## Verdicts

- PASS: required machine gates pass and manual review domains are accepted for
  the current project.
- FAIL: any required machine gate fails.
- MANUAL REVIEW REQUIRED: machine gates pass, but project-specific context,
  contracts, routing, or review guidance still need human judgment.

## Required Machine Gates

| Gate | Command | Required evidence |
| --- | --- | --- |
| Governance validation | `node scripts/validate-governance.mjs` | Command exits 0 |
| Workspace bootstrap preview | `node scripts/bootstrap-workspace.mjs --dry-run` | Planned pointer writes are expected |
| Workspace bootstrap | `node scripts/bootstrap-workspace.mjs` | Command exits 0 or reports only intentional skips |
| Workspace check | `node scripts/check-workspace.mjs` | Command exits 0 |
| Overlay drift | `node scripts/check-overlay-drift.mjs` | Required when OpenAI or Anthropic support is enabled |
| Codex hooks | `node scripts/check-codex-hooks.mjs` | Required when Codex hooks are enabled |
| Claude compatibility | `node scripts/check-claude-compatibility.mjs` | Required when Anthropic support is enabled |

## Manual Review Domains

- `ai/context.md` names the real project, repos, and operating assumptions.
- `ai/HUB.md` routes agents to the smallest useful context.
- `ai/contracts/*` reflects real repo boundaries and protected surfaces.
- `ai/templates/task-brief-template.md` matches the team's task intake shape.
- `ai/skills/*` names review inputs that are available in this workspace.
- `ai/QUALITY.md` records evidence and blocking gaps for each readiness domain.

## Update Rule

When readiness changes, update command evidence and `ai/QUALITY.md` in the same
edit. Do not promote readiness based on intent alone.
