# {{PROJECT_NAME}} Engineering Harness

This repo is the canonical harness for {{PROJECT_NAME}}. It defines shared
guidance, contracts, task structure, review policy, and validation checks.

It does not implement product behavior and it is not a runner.

## What The Harness Owns

- shared workflow and model-neutral guidance
- context routing
- contracts and boundary rules
- task templates and task metadata expectations
- review procedures
- validation scripts
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

## Harness vs Runner

The harness answers what must be true. A runner answers when and how work is
scheduled and executed.

Future runners may consume this harness as read-only policy input. They must
not become the policy source of truth.
