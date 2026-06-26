# {{PROJECT_NAME}} Shared AI Guide

This folder holds canonical shared guidance for the {{PROJECT_NAME}} AI Harness
Engineering Framework.

## Scope

- shared policy for AI-assisted development
- context routing and task shape
- product, architecture, and design context ready to fill from consumer repos
- contracts and boundary rules
- review skills and validation policy
- quality tracking and repeated-mistake capture

## Rules

- Keep shared docs model-neutral.
- Keep model overlays thin and synchronized.
- Keep consumer implementation details out of this layer.
- Use `ai/HUB.md` to route tasks before loading topical docs.
- Use `node scripts/validate-governance.mjs` for harness validation.
- Use `node scripts/check-workspace.mjs` when changing workspace bootstrap or
  consumer entrypoint behavior.

## Coding Conventions

- Prefer deep modules that hide decisions behind clear APIs.
- Keep coordination logic close to the module that owns the decision.
- Use precise names that make the domain model obvious.
- Reuse existing types, helpers, and abstractions before adding new ones.
- Keep diffs minimal and avoid unrelated rewrites.
- Comments should explain non-obvious intent, invariants, constraints, and
  trade-offs; do not narrate syntax.
- In UI or structured modules, use section markers when they improve scanning:
  `// PROPS`, `// STATE`, `// RQ`, `// RHF`, `// HOOKS`, `// EFFECTS`,
  `// METHODS`, `// VARS`, `// ARGS`, and `// PARAMS`.
