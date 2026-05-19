# {{PROJECT_NAME}} Architecture

This document captures the durable architecture map for {{PROJECT_NAME}}.

## System Shape

- Harness repo: `{{HARNESS_REPO_NAME}}`
- Consumer repos:
{{CONSUMER_REPOS_LIST}}

## Ownership Boundaries

- The harness owns shared policy, contracts, routing, and validation
  expectations.
- Consumer repos own implementation, local tests, runtime behavior, and
  deployment-specific details.
- Cross-repo invariants belong in `ai/contracts/*`.

## Module Guidance

- Prefer deep modules that hide decisions behind clear APIs.
- Avoid scattered coordination logic across unrelated files.
- Keep names precise enough that the domain model is obvious.
- Reuse existing types and abstractions before creating new ones.

## Open Architecture Notes

- Add repo-specific module maps as the consumer repos are inspected.
- Add ADRs only for durable trade-offs that would surprise a future reader.

