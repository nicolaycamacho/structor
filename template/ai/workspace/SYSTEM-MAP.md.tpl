# System Map

Project {{PROJECT_NAME_CODE}} is organized around a separate harness repo and
one or more consumer repos.

## Relationship

- Harness repo: `{{HARNESS_REPO_NAME}}`
- Consumer repos: {{CONSUMER_REPO_NAMES_JSON}}

The harness defines shared engineering policy and review expectations. Consumer
repos define application architecture, runtime commands, data models, and
deployment behavior.

## Routing

Start from `ai/HUB.md`, then load only the docs that match the task. Use
`ai/workspace/REPOS.md` for repo ownership and `ai/workspace/TEST-STRATEGY.md`
for validation ownership.
