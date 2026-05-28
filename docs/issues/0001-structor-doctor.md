# Add a Structor doctor command

## Summary

Add a future `structor doctor` command that diagnoses and optionally repairs a
previously generated Structor workspace after installation drift, stale consumer
entrypoints, moved folders, or incomplete setup.

## Motivation

The setup wizard should make first-time installation easy, but users may later
move folders, edit pointer files, delete generated files, or partially complete
manual setup. A doctor flow would make Structor easier to adopt by providing a
clear recovery path instead of forcing users to understand every generated file.

## Scope

- Inspect `harness.config.json`, generated harness files, workspace pointers,
  and configured consumer entrypoints.
- Report healthy, missing, stale, and unsafe surfaces.
- Offer preview-first repairs for local files that Structor owns.
- Reuse existing validation commands where possible.
- Avoid runner behavior, polling, remote services, or automatic repository
  mutation without confirmation.

## Non-Goals

- No external service repair.
- No GitHub, CI, deployment, database, or production mutations.
- No automatic rewrite of hand-written consumer instructions without explicit
  confirmation.
- No replacement for the setup wizard or deterministic initializer.

## Open Questions

- Should repair be a separate `structor doctor --repair` mode or an interactive
  prompt after diagnosis?
- Which files should be considered Structor-owned versus user-owned?
- Should doctor be available in the wizard MVP or shipped as a follow-up issue?
