# Security Boundary

Maturity is declared in the sibling manifest. Read `ai/contracts/README.md`
for the model and limits before relying on this starter as a project contract.

Security-sensitive changes require explicit scope and human review.

## Protected Surfaces

- authentication
- authorization
- secrets
- payment or billing behavior
- production data
- infrastructure
- deployment configuration
- database migrations

## Rule

Tasks that touch protected surfaces must state approval requirements,
validation, rollback, and review routing.
