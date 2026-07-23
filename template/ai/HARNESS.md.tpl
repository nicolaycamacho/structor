# {{PROJECT_NAME}} AI Harness Engineering Framework

This repo is the canonical AI Harness Engineering Framework for {{PROJECT_NAME}}. It defines shared
guidance, contracts, task structure, review policy, and validation checks.

It does not implement product behavior and it is not a runner.

## Safety Backups

Before Structor regenerates existing managed state, it creates a timestamped,
repo-local safety backup under the configured workspace root's
`.structor/backups/`. If Structor state appears
missing, overwritten, stale, or unexpectedly reset, inspect `.structor/backups/`
before regenerating or editing harness files. Each backup
manifest records when and why the backup was created and which paths were
copied or skipped.

Teams may choose to commit or ignore these backups according to repository
policy. Structor does not silently impose either policy or prune old backups.

## What The Harness Owns

- shared workflow and model-neutral guidance
- shared product, architecture, design, and vocabulary docs
- context routing
- contracts and boundary rules
- task templates and task metadata expectations
- review procedures
- validation scripts
- workspace bootstrap checks and consumer entrypoint routing
- model/client startup surfaces and local compatibility validators
- quality tracking
- repeated-mistake capture

## What The Harness Does Not Own

- long-running polling
- agent session lifecycle
- PR lifecycle automation
- live dashboards or orchestration UI
- auto-merge
- production autonomous execution
- runtime state stores
- repair-loop daemons
- external client automation that is not validated as a local harness guardrail

Read-only generated Harness Cockpit views under `ai/views/*` are allowed when
they summarize canonical local files and do not execute workflows.

## Harness vs Runner

The harness answers what must be true. A runner answers when and how work is
scheduled and executed.

Future runners may consume this harness as read-only policy input. They must
not become the policy source of truth.

## Workspace Bootstrap

Use:

```sh
node scripts/bootstrap-workspace.mjs
```

This installs workspace-level pointer files and checks that configured consumer
repos can route agents back to the harness. It skips existing files by default.
Use `--dry-run` to preview writes and `--force` only after reviewing existing
consumer or workspace entrypoints.
