# Workspace Repos

This workspace uses `{{HARNESS_REPO_NAME}}` as the harness repo.

## Harness

- `{{HARNESS_REPO_NAME}}`: policy, routing, contracts, review templates, generated views, and validation scripts.

## Consumers

{{CONSUMER_REPOS_LIST}}

Consumer repos own product implementation, runtime behavior, app dependencies,
and product-specific validation.

## Boundary

The harness may describe repo ownership and expected checks. It must not become
the implementation source of truth for consumer applications.
