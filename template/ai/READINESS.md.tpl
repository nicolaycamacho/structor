# Harness Readiness

This file defines the post-generation readiness contract for the
{{PROJECT_NAME}} harness. Readiness is a gate with evidence, not a numeric score.

## Verdicts

- PASS: required machine gates pass and manual review domains are accepted.
- FAIL: any required machine gate fails.
- MANUAL REVIEW REQUIRED: machine gates pass, but project-specific guidance
  still needs human judgment.

## Required Machine Gates

| Gate | Command | Required evidence |
| --- | --- | --- |
| Governance validation | `node scripts/validate-governance.mjs` | Command exits 0 |
| Workspace bootstrap preview | `node scripts/bootstrap-workspace.mjs --dry-run` | Planned pointer writes are expected |
| Workspace bootstrap | `node scripts/bootstrap-workspace.mjs` | Command exits 0 or reports only intentional skips |
| Workspace check | `node scripts/check-workspace.mjs` | Command exits 0 |
| Codex hooks | `node scripts/check-codex-hooks.mjs` | Required only when Codex hooks are enabled |
{{EXPANDED_READINESS_GATES}}

## Manual Review Domains

- `ai/context.md` names the real project, repos, and operating assumptions.
- `ai/PRODUCT-SUMMARY.md` describes the product without unsupported claims.
- `ai/HUB.md` routes agents to the smallest useful context.
- `ai/WORKFLOW.md` records the real validation and handoff expectations.
{{EXPANDED_READINESS_DOMAINS}}

## Update Rule

When readiness changes, update the relevant command or manual-review evidence in
the same edit. Do not promote readiness based on intent alone.
