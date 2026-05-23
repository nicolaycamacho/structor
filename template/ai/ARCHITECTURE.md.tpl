# {{PROJECT_NAME}} Architecture

This document captures the durable architecture map for {{PROJECT_NAME}}.

## System Shape

- Harness repo: `{{HARNESS_REPO_NAME}}`
- Consumer repos:
{{CONSUMER_REPOS_LIST}}
- Active harness contracts and contracts views live in `ai/contracts` and `ai/views`.

## Ownership Boundaries

- The harness owns shared policy, contracts, routing, and validation
  expectations.
- Consumer repos own implementation, local tests, runtime behavior, and
  deployment-specific details.
- Cross-repo invariants belong in `ai/contracts/*`.
- Product-owned behavior contracts should be explicit and versionable through
  `ai/contracts/*.contract.json`.

## Module Guidance

- Prefer deep modules that hide decisions behind clear APIs.
- Avoid scattered coordination logic across unrelated files.
- Keep names precise enough that the domain model is obvious.
- Reuse existing types and abstractions before creating new ones.
- Make shared interfaces explicit; avoid moving contract-owned logic into consumer
  overlays.

## Open Architecture Notes

- Add repo-specific module maps as you onboard each consumer repo.
- Add ADRs only for durable trade-offs that would surprise a future reader.
- Keep bootstrap and worktree contracts close to workspace entrypoints.
