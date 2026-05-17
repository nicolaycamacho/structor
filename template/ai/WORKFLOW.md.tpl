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

## Validation Rules

- Run every safe validation command listed in the task.
- Capture commands run, failures, skipped checks, and reasons.
- Fix validation failures in the smallest relevant scope.
