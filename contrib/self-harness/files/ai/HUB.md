# Structor Self-Harness Hub

This is the routing layer for work on Structor.

## Baseline

Always read:

- `./AGENTS.md`
- `./ai/AGENTS.md`
- `./ai/context.md`

## Routing

- Product language, naming, or contribution boundaries:
  `./ai/PRODUCT-SUMMARY.md`, `./ai/PRODUCT.md`
- Generator flow, template boundaries, config resolution, or write safety:
  `./ai/ARCHITECTURE.md`, `./ai/DESIGN.md`
- Validation, review evidence, or issue completion:
  `./ai/QUALITY.md`, `./ai/READINESS.md`, `./ai/DECISIONS.md`
- Harness policy, active generic templates, model overlays, or consumer
  entrypoints:
  `./ai/HARNESS.md`, `./ai/HARNESS-ENGINEERING.md`,
  `./ai/workspace/REPOS.md`, `./ai/workspace/SYSTEM-MAP.md`,
  `./ai/workspace/SESSION-BOOTSTRAP.md`, `./ai/workspace/LOCAL-STACK.md`,
  `./ai/workspace/TEST-STRATEGY.md`
- Runner, orchestration, automation, future contributor bootstrap, or
  external-service boundaries:
  `./ai/WORKFLOW.md`, `./ai/RUNNER-SAFETY.md`,
  `./ai/RUNNER-READINESS.md`, `./ai/VERSIONING.md`
- Codex hook surfaces, repo-local hooks, or client safety:
  `./ai/CODEX-HOOKS.md`
- Contracts, protected surfaces, and release or GitHub safety:
  `./ai/contracts/README.md` and the matching contract doc
- Task-shape or issue-template changes:
  `./ai/templates/README.md` and the matching template
- Generated HTML review views:
  `./ai/views/index.html` plus canonical Markdown, JSON, and YAML sources
- Review requests:
  `./ai/skills/README.md` and the matching review skill
- Repeated agent mistakes:
  `./ai/AGENT-GARBAGE-COLLECTION.md`

## Source Docs

Ground Structor-specific claims in the source repo:

- `../structor/README.md`
- `../structor/CONTEXT.md`
- `../structor/CONTRIBUTING.md`
- `../structor/docs/adr/*`
- `../structor/scripts/**`
- `../structor/template/**`

## Load Rules

- Load the smallest doc set that can answer the task.
- Prefer current source files over memory or generated summaries.
- Keep generated self-harness guidance out of active generic templates.
