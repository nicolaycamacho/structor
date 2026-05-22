---
id: <ISSUE-ID>
status: Backlog
risk: medium
autonomy: pr_ready
model_policy: standard
repos:
  - {{HARNESS_REPO_NAME}}
allowed_paths:
  - <path-or-glob>
forbidden_paths:
  - <path-or-glob>
requires_human_approval: false
---

# <Issue Title>

## Summary

Describe the work in one short paragraph.

## Context

Explain why the change is needed and what existing behavior matters.

## Goals

- Describe the intended outcomes.

## Non-Goals

- Describe what must remain out of scope.

## Scope

### In Scope

- List allowed surfaces.

### Out of Scope

- List forbidden surfaces.

## Path Contract

### Allowed Paths

- `<path-or-glob>`

### Forbidden Paths

- `<path-or-glob>`

## Requirements

- State concrete functional and technical requirements.

## Bootstrap Requirements

- State what the agent must read or check before editing.

## Proposed Approach

- Describe the implementation sequence.

## Agent Execution Protocol

- Keep changes scoped to allowed paths.
- Stop and ask before protected surfaces or remote mutations.

## Success Criteria

- State the observable finish line.

## Validation

- `node scripts/validate-governance.mjs`

## Validation Evidence Required

- List commands and outcomes in the final report.

## Risk and Autonomy

Protected surfaces require current human approval. `auto_merge` is future-facing
metadata and does not imply current execution by this repo.

## Review Routing

- Route review to the relevant harness docs and skills.

## Dependencies

- List dependencies or say none.

## Rollback / Recovery

- Describe how to revert the change safely.

## Open Questions

- List unresolved questions or say none.

## Notes for the Agent

Keep Markdown, JSON, and YAML sources canonical. Generated views are review
artifacts.
