# Security Boundary

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
