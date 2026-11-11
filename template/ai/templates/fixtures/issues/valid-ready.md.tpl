---
id: HARNESS-FIXTURE-001
status: Ready for Agent
risk: medium
autonomy: pr_ready
model_policy: standard
repos:
  - {{HARNESS_REPO_NAME}}
allowed_paths:
  - ai/HARNESS.md
forbidden_paths:
  - workspace/**
requires_human_approval: false
---

# Valid Ready Fixture

## Summary

Update harness guidance without touching protected surfaces. The work stays in
`ai/HARNESS.md`, preserves harness-only scope, and is complete when governance
validation passes with `node scripts/validate-governance.mjs`.

## Context

This fixture proves that a concrete issue brief can pass validation.

## Goals

- Keep the fixture mechanically valid.

## Non-Goals

- Do not change consumer repos.

## Scope

### In Scope

- `ai/HARNESS.md`

### Out of Scope

- `workspace/**`

## Path Contract

### Allowed Paths

- `ai/HARNESS.md`

### Forbidden Paths

- `workspace/**`

## Requirements

- Preserve harness-only scope.

## Bootstrap Requirements

- Read `ai/HUB.md`.

## Repository Fit

### Guidance

Inspected `ai/HUB.md` and `ai/WORKFLOW.md`; canonical policy stays in `ai/`.

### Analogues

Compared `ai/AGENTS.md` and `ai/WORKFLOW.md`; both use scoped Markdown rules.

### Callers and Ownership

`ai/HUB.md` routes to `ai/HARNESS.md`; only harness-owned guidance changes.

### Conventions

Preserve model-neutral policy, existing commands and consumer boundaries.

### Departures

No convention departure is needed for this wording update.

### Validation and Browser Evidence

Run governance validation for policy structure. Browser evidence is inapplicable
because this changes only Markdown guidance, with no UI behavior.

## Proposed Approach

- Make a narrow documentation update.

## Agent Execution Protocol

- Stay inside allowed paths.

## Success Criteria

- Governance validation passes.

## Validation

- `node scripts/validate-governance.mjs`

## Validation Evidence Required

- Report command outcomes.

## Risk and Autonomy

Protected surfaces require current human approval. `auto_merge` is future-facing
metadata and does not imply current execution by this repo.

## Review Routing

- Use `ai/skills/review-governance-drift.md`.

## Dependencies

- None.

## Rollback / Recovery

- Revert the documentation change.

## Open Questions

- None.

## Notes for the Agent

No protected surface is in scope.
