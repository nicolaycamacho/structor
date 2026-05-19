# {{PROJECT_NAME}} Product Context

This is the durable product context for the {{PROJECT_NAME}} engineering
harness. Keep it factual and current; do not turn it into a task backlog.

## Problem

Describe the customer problem and the non-negotiable constraints.

## Product Model

- Define the main domain objects.
- Define how the consumer repos participate in the product.
- Identify terms that should not be used as aliases for each other.

## User Journeys

- Describe the important happy paths.
- Describe recovery paths and failure states.
- Link implementation details only when they clarify ownership.

## Boundaries

- Product behavior belongs in consumer repos.
- Shared product language and cross-repo invariants belong in this harness.
- If implementation and product context disagree, update one deliberately.

