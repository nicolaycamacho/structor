# {{PROJECT_NAME}} Engineering Harness

This repository contains the AI engineering harness for {{PROJECT_NAME}}.

The harness defines policy, contracts, context routing, task templates, review
rules, quality tracking, and validation. It does not implement product behavior
and it is not a runner or orchestration runtime.

## Consumer Repositories

{{CONSUMER_REPOS_LIST}}

## Validation

Run:

```sh
node scripts/validate-governance.mjs
```

Consumer repos should expose local install, lint, test, build, and health
commands. The harness documents expected contracts and validation evidence, but
consumer repos own implementation and runtime checks.
