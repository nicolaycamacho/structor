# Agent Workflow Policy

This is harness policy for AI-assisted engineering tasks. It is not a runtime
daemon contract and it does not start or control agent sessions.

## Load Order

1. Read the task brief.
2. Read `ai/HUB.md`.
3. Read the smallest routed doc set needed for the task.
4. Read any named contract or review skill.

## Execution Rules

- Work only in authorized repos and paths.
- Keep changes within `allowed_paths` when provided.
- Do not touch `forbidden_paths`.
- Make the smallest change that satisfies the task.
- Stop when task intent conflicts with harness contracts.
- State expected file changes, preserved contracts, validation commands, and
  unresolved risks before editing.
- Keep handoff notes current when work spans multiple sessions or context
  resets.

## Validation Rules

- Run every safe validation command listed in the task.
- Capture commands run, failures, skipped checks, and reasons.
- Fix validation failures in the smallest relevant scope.
- If validation cannot run, report the blocker explicitly instead of implying
  coverage.

## Handoff Rules

Long-running work should leave enough state for a fresh agent to continue
without reconstructing intent from chat:

- current goal and accepted non-goals
- files changed and files intentionally avoided
- validation already run and remaining validation
- decisions made and open questions
- known risks, rollback path, and human approval gates
