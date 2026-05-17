# Decisions

Record durable harness decisions here.

## Format

- Date:
- Decision:
- Context:
- Consequences:

## Initial Decisions

### Harness owns policy; runner owns execution

- Date: initial generation
- Decision: This repository owns harness policy, contracts, task shape, review
  rules, and validation. Runtime orchestration belongs outside this repo.
- Context: Keeping policy separate from execution makes the harness reusable
  across model systems and runners.
- Consequences: Runner behavior may consume this repo, but must not become the
  canonical source of policy.
