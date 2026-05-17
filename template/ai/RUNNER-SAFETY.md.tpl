# Future Runner Safety

This document defines safety policy a future runner should honor. It is not an
active runtime implementation.

## Protected Surfaces

Future runners should require human review for:

- architecture or shared contracts
- authentication or authorization
- billing or payment behavior
- secrets or environment variables
- infrastructure or deployment configuration
- database migrations or production data
- large refactors across repo boundaries

## External Actions

Pushes, merges, paid external actions, tracker writes, and production mutations
require explicit authorization and belong in a separate observable runner.
