# {{PROJECT_NAME}} Shared AI Guide

This folder holds canonical shared guidance for the {{PROJECT_NAME}} engineering
harness.

## Scope

- shared policy for AI-assisted development
- context routing and task shape
- contracts and boundary rules
- review skills and validation policy
- quality tracking and repeated-mistake capture

## Rules

- Keep shared docs model-neutral.
- Keep model overlays thin and synchronized.
- Keep consumer implementation details out of this layer.
- Use `ai/HUB.md` to route tasks before loading topical docs.
- Use `node scripts/validate-governance.mjs` for harness validation.
