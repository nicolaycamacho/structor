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
