# Contracts

Contracts define cross-repo invariants. They do not implement behavior.

## Index

- `repo-boundaries.md`: repository ownership boundaries
- `app-legibility.md`: commands, health checks, and validation evidence expected
  from consumer repos
- `api-boundary.md`: API ownership and compatibility expectations
- `security-boundary.md`: protected surfaces and human approval gates
- `codex-hooks.md`: local hook behavior and safety limits
- `release-flow.md`: release and external mutation safety
- `github-safety.md`: remote repository mutation guardrails

Contract JSON manifests use the `*.contract.json` suffix and are checked by
`node scripts/check-contract-manifests.mjs`.

## Rule

Contracts are authoritative for what must stay true. Consumer repos implement
the contracts. If implementation and contract disagree, update one deliberately
instead of allowing drift.
