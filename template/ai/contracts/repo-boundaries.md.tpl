# Repo Boundaries

Maturity is declared in the sibling manifest. Read `ai/contracts/README.md`
for the model and limits before relying on this starter as a project contract.

This contract defines ownership boundaries for {{PROJECT_NAME}}.

## Harness Repo

Owns policy, context routing, contracts, task templates, review skills, quality
tracking, and validation scripts.

## Consumer Repos

{{CONSUMER_REPOS_LIST}}

Consumer repos own product implementation and local runtime checks.

## Runner

Any future runner owns execution runtime outside this harness.
