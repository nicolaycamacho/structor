---
id: <ISSUE-ID>
task_size: standard
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

Write a scannable implementation summary in 250 words or fewer. Include the
problem being solved, the intended change, the main implementation surfaces,
and the key validation expectation.

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

## Repository Fit

### Guidance

- Record inspected repo entrypoint, routed/path-matched guidance, glossary and
  relevant architecture decisions, with exact files and applicable rules.

### Analogues

- Cite comparable implementations and patterns; inspect two when available.
  Explain the search if fewer exist, including uncertainty or conflicting
  precedent.

### Callers and Ownership

- Map affected callers, owning modules, boundaries and shared-file blast radius.

### Conventions

- State contracts and local conventions to preserve, including reusable helpers,
  data/query and mutation boundaries, and error/status/feedback patterns.

### Departures

- Justify necessary departures or explicitly record none. Route sensitive
  boundary or architecture changes to existing architecture review before coding;
  stop on unresolved protected changes.

### Validation and Browser Evidence

- Identify relevant checks and coverage. For UI changes, specify browser evidence
  for affected flows/states or the reason it cannot be collected. Report actual
  results separately in Validation Evidence Required.

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
