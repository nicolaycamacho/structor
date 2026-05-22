# {{PROJECT_NAME}} Engineering Harness

This repo is the canonical harness for {{PROJECT_NAME}}. It defines shared
guidance, contracts, task structure, review policy, and validation checks.

It does not implement product behavior and it is not a runner.

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
- dashboards
- auto-merge
- production autonomous execution
- runtime state stores
- repair-loop daemons
- external client automation that is not validated as a local harness guardrail

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
