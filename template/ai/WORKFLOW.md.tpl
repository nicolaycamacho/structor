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
- `repos` declares editable owners; `read_only_repos` declares inspected
  dependencies. Names must be canonical, distinct and non-overlapping.
- `execution_intent: report_only` requires empty editable owners and allowed
  paths, plus inspected repositories in `read_only_repos`. Implementation intent
  must agree with autonomy; omitted intent follows `autonomy: report_only`,
  otherwise it defaults to `implementation`.
- Single-owner implementation policy enabled: {{SINGLE_OWNER_IMPLEMENTATION}}.
  When enabled, concrete implementation briefs require exactly one editable
  owner. Read-only dependencies do not count toward that limit.
- Keep changes within `allowed_paths` when provided.
- Paths are relative to each editable owner, never to the workspace. Use
  `repo:path` to qualify a pattern for one canonical owner. Unqualified patterns
  apply to each declared owner when multi-repository implementation is enabled.
  Use `/` separators and simple globs (`*`, `**`, `?`, character classes); reject
  absolute paths, `..` segments, backslashes, braces and extglobs.
- Do not touch `forbidden_paths`.
- Make the smallest change that satisfies the task.
- Stop when task intent conflicts with harness contracts.
- State expected file changes, preserved contracts, validation commands, and
  unresolved risks before editing.
- Keep handoff notes current when work spans multiple sessions or context
  resets.

## Validation Rules

- Validate a concrete brief with `node scripts/check-task-template.mjs --file
  ../task.md` or `node scripts/check-issue-template.mjs --file ../issue.md`.
- Metadata and these static checks do not authorize implementation, constrain
  runtime tools, inspect symlink targets, or prove agent behavior. Scope prose
  must agree with metadata; these validators do not interpret prose as authority.
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
