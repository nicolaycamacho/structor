# Harness Quality

This scorecard tracks harness readiness. Keep grades evidence-based and update
them when validation or policy changes.

| Domain | Grade | Evidence | Enforced by | Blocking gaps |
| --- | --- | --- | --- | --- |
| Entrypoints | B | `AGENTS.md`, `CLAUDE.md` | `scripts/validate-governance.mjs` | Customize after initial generation |
| Context routing | B | `ai/HUB.md`, `ai/context.md` | Manual review | Add project-specific routing as needed |
| Contracts | B | `ai/contracts/*` | `scripts/check-template-governance.mjs`, manual review | Replace starter contracts with project contracts |
| Task shape | B | `ai/templates/task-brief-template.md` | `scripts/check-task-template.mjs` | Fill concrete project issue metadata and path contracts |
| Review skills | B | `ai/skills/*` | Manual review | Customize review inputs and evaluator routing |
| Readiness contract | B | `ai/READINESS.md`, `scripts/check-readiness.mjs` | `scripts/check-readiness.mjs`, manual review | Run post-generation machine gates and accept manual review domains |
| Runner boundary | A | `ai/RUNNER-SAFETY.md` | Manual review | Keep runtime out of harness |
| Workspace bootstrap | B | `scripts/bootstrap-workspace.mjs`, `scripts/check-workspace.mjs` | `node scripts/check-workspace.mjs` | Run after consumer repos are cloned |

## Production-Grade Checklist

- Entry points are short maps, not large manuals.
- The hub routes agents to the smallest relevant context.
- Task briefs include risk, autonomy, model, repo, path, validation, review,
  and recovery metadata.
- Contracts define repository boundaries and protected surfaces.
- Validation scripts check every invariant that can be checked cheaply and
  safely.
- `ai/READINESS.md` distinguishes machine gates from manual review domains.
- Validation failures include enough context for an agent to repair drift.
- Consumer repos expose local commands and evidence hooks.
- Repeated review feedback is captured in `ai/AGENT-GARBAGE-COLLECTION.md`.
- Runner integration remains read-only until a separate runtime contract is
  approved.

## Update Rule

When a grade changes, update the evidence and the blocking gap in the same
edit. Do not improve a grade based on intent alone; use validation output,
contract coverage, or review evidence.
