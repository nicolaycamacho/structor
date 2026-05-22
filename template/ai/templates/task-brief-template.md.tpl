---
id: TASK-ID
status: backlog
risk: medium
autonomy: pr_ready
model_policy: standard
model: runtime-selected
repos: []
allowed_paths: []
forbidden_paths: []
requires_human_approval: false
---

# Title

## Summary

What needs to change and why.

## Context

Relevant harness docs, contracts, and repo state.

## Goals

- Goal 1

## Non-Goals

- Non-goal 1

## Scope

### In Scope

- In scope item

### Out of Scope

- Out of scope item

### Repos Affected

- Repo name

## Path Contract

### Allowed Paths

- Path the agent may edit

### Forbidden Paths

- Path the agent must not touch

### Protected Contracts

- Existing public APIs, CLI commands, validation commands, and generated
  artifact shapes must remain backward compatible unless explicitly stated.

## Requirements

### Functional Requirements

- Functional requirement

### Technical Requirements

- Technical requirement

### UX / Content Requirements

- UX or content requirement, if applicable

### Data / API Requirements

- Data or API requirement, if applicable

## Bootstrap Requirements

Before implementation, the agent must:

- Read the relevant repo entrypoint and routed harness docs.
- Identify canonical repo names and ownership boundaries.
- Identify validation commands and safe dry-run checks.
- Report missing, stale, or contradictory harness files before editing.

Expected evidence:

- Context files read.
- Bootstrap or path-contract check output, if available.
- Any mismatch or ambiguity found.

## Proposed Approach

- Preferred solution
- Alternatives considered
- Key trade-offs

## Agent Execution Protocol

Before changing files, the agent must state:

- Files expected to change.
- Contracts expected to remain unchanged.
- Validation commands it will run.
- Risks or ambiguities found.

The agent must not proceed if the plan conflicts with the Path Contract, risk
and autonomy, or Open Questions sections.

## Success Criteria

- Observable end state
- Acceptance criteria
- Definition of done

## Validation

- Command or check 1

## Validation Evidence Required

- Commands run
- Exit codes
- Relevant output excerpts
- Failures or skipped checks with reasons
- Files changed
- Manual checks performed
- Known residual risks

## Risk and Autonomy

- Risk: `low` / `medium` / `high`
- Autonomy: `report_only` / `pr_ready` / `auto_merge`
- Model policy: `cheap` / `standard` / `reasoning` / `frontier` /
  `review_only`
- Model: keep `runtime-selected` unless the task owner explicitly requires a
  provider-specific model. Choose the active runtime's current appropriate
  model: cheaper models for low-risk mechanical work, stronger reasoning
  models for cross-file implementation, and frontier models for high-risk,
  architecturally heavy, or cross-repo work.
- Human approvals required
- Protected surfaces touched, if any
- Rollout or rollback notes
- `auto_merge` is future-facing metadata only unless a separate runner is
  explicitly authorized.

## Review Routing

Required reviewers:

- Architecture reviewer: yes/no
- Security reviewer: yes/no
- UX/content reviewer: yes/no
- Cross-repo consistency reviewer: yes/no

Reviewer focus:

- What reviewers should inspect.
- What reviewers can ignore.

## Dependencies

- Upstream dependencies
- Downstream dependencies
- External blockers

## Rollback / Recovery

How to recover if validation fails.

## Open Questions

- None yet.

## Notes for the Agent

- Ask for clarification before changing files if anything is ambiguous and the
  brief does not authorize a safe default.
- Keep the change as small as possible.
- Prefer existing patterns, contracts, commands, and repo conventions.
- Do not widen scope to nearby cleanup.
- Do not make speculative architecture changes.
- Do not silently skip validation.
