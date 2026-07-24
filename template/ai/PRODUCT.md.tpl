# {{PROJECT_NAME}} Product Context

This is the durable product context for the {{PROJECT_NAME}} AI Harness
Engineering Framework. Agents should treat this as the source of truth for
product semantics.

## Problem

The harness exists to keep every consumer repo aligned on the same business
meaning, shared vocabulary, and user-facing invariants.

- Preserve the end-to-end value chain from input to outcome.
- Surface the failure modes that must be handled explicitly.
- Keep behavior choices traceable to a durable contract, not to local convenience.

## Product Model

- Define the core domain objects for this product and keep names consistent across
  all repos.
- Define ownership of each object and where source-of-truth transitions happen.
- Define which terms are equivalent and which are not. Do not silently merge terms.

## User Journeys

- Document the expected happy path from first user intent to completed outcome.
- Define recovery paths and observable fallback behavior for every step that can fail.
- Keep implementation details out unless needed to clarify ownership boundaries.

## Boundaries

- Product behavior belongs in consumer repos.
- Shared product language and cross-repo invariants belong in this harness.
- If implementation and product context disagree, update one deliberately.
