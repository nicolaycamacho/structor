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

## Repository Fit Before Implementation

For a standard issue or task brief, record a compact `## Repository Fit` section
before treating the work as ready. Use these level-three evidence categories:

- `### Guidance`: inspected repo entrypoint, routed/path-matched instructions,
  glossary and relevant architecture decisions, with exact files and rules.
- `### Analogues`: comparable local implementations and the patterns found;
  inspect at least two when available. If fewer exist, record where you looked
  and explain the absence, conflict or uncertainty instead of inventing a rule.
- `### Callers and Ownership`: owning modules, affected callers, boundaries and
  the blast radius of shared-file changes, inspected before editing.
- `### Conventions`: contracts to preserve, reusable types/helpers, data/query
  and mutation boundaries, and error/status/feedback patterns as applicable.
- `### Departures`: necessary departures with reasons, or an explicit account
  that none are needed. Stop for existing architecture review before coding a
  sensitive change to ownership, routing, repo boundaries, data flow or shared
  abstractions. Unresolved protected architecture changes block implementation.
- `### Validation and Browser Evidence`: relevant checks, their coverage and
  browser evidence needed for affected UI flows/states, or why it cannot be
  collected. Distinguish planned checks from actual results.

Follow the repo's existing architecture-review route. Expanded harnesses also
index their architecture review skill through the Hub; focused harnesses do not
need expanded files to apply this policy. Record the review outcome and resolve
blocking findings before proceeding. A structurally valid brief is not review
approval.

Tiny tasks still inspect the local instructions, changed surface and relevant
check, but do not require Repository Fit or long-form planning. Task size never
waives protected-surface approval or architecture review when applicable.

Validate concrete briefs with:

```sh
node scripts/check-issue-template.mjs --file ../issue.md
node scripts/check-task-template.mjs --file ../task.md
```

These read-only checks require the section and nonempty evidence categories;
they do not judge whether an analogue, departure or architecture decision is
correct, verify that inspection happened, or require particular prose.

## Validation Evidence Selection

Use the consumer repo's documented checks and existing test seams. Choose
focused checks for changed behavior, then the required integration gates; record
the command, working repo, exit status, relevant output and any skipped check
with its reason. Do not invent commands or report planned checks as passed.

For UI changes, collect relevant browser evidence for the affected flows, states
and viewports, including interactions when behavior changes. Record what was
actually observed and where the evidence can be inspected. If browser evidence
was not collected, state the reason and remaining uncertainty explicitly.
Static validation alone does not prove UI behavior or agent effectiveness.

## Handoff Rules

Long-running work should leave enough state for a fresh agent to continue
without reconstructing intent from chat:

- current goal and accepted non-goals
- files changed and files intentionally avoided
- validation already run and remaining validation
- decisions made and open questions
- known risks, rollback path, and human approval gates
