# Local Stack

This document records stable local assumptions for {{PROJECT_NAME_CODE}}.

## Harness

- Primary validation: `node scripts/validate-governance.mjs`
- Workspace layout check: `node scripts/check-workspace.mjs`
- Workspace bootstrap: `node scripts/bootstrap-workspace.mjs`

## Consumers

Consumer validation commands are configured in `harness.config.json` and owned
by the consumer repos.

{{CONSUMER_REPOS_LIST}}

## Rule

Do not require external services, production data, or remote mutations for
harness validation.
