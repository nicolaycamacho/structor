# {{PROJECT_NAME}} Harness Hub

This is the routing layer for the {{PROJECT_NAME}} engineering harness.

## Baseline

Always read:

- `./AGENTS.md` or the local entrypoint
- `./ai/AGENTS.md`
- `./ai/context.md`

## Routing

- Product, user journeys, or business context:
  `./ai/PRODUCT-SUMMARY.md`, `./ai/PRODUCT.md`
- Architecture, repo boundaries, or module design:
  `./ai/ARCHITECTURE.md`
- UI or design direction:
  `./ai/DESIGN.md`
- Harness policy, bootstrap, validation, or model overlay changes:
  `./ai/HARNESS.md`, `./ai/HARNESS-ENGINEERING.md`, `./ai/QUALITY.md`,
  `./ai/DECISIONS.md`, `./ai/knowledge-manifest.json`
- Codex/Claude client surfaces, `.codex/**`, `.claude/**`, or overlay drift:
  `./ai/HARNESS.md`, `./ai/HARNESS-ENGINEERING.md`, `./ai/QUALITY.md`,
  `./ai/CODEX-HOOKS.md`,
  and the matching generated client validator
- Workspace, repo ownership, local stack, session bootstrap, or validation
  ownership:
  `./ai/workspace/REPOS.md`, `./ai/workspace/SYSTEM-MAP.md`,
  `./ai/workspace/SESSION-BOOTSTRAP.md`, `./ai/workspace/LOCAL-STACK.md`,
  `./ai/workspace/TEST-STRATEGY.md`
- Runner or automation questions:
  `./ai/WORKFLOW.md`, `./ai/RUNNER-SAFETY.md`,
  `./ai/RUNNER-READINESS.md`, `./ai/VERSIONING.md`
- Contracts or repo boundaries:
  `./ai/contracts/README.md` and the matching contract doc
- Task template changes:
  `./ai/templates/README.md` and the matching template
- Generated HTML review views:
  `./ai/views/index.html` plus canonical Markdown, JSON, and YAML sources
- Shared specs:
  `./ai/specs/README.md` and the matching spec
- Review requests:
  `./ai/skills/README.md` and the matching review skill
- Repeated agent mistakes:
  `./ai/AGENT-GARBAGE-COLLECTION.md`

## Load Rules

- Load the smallest doc set that can answer the task.
- Add topical docs only when the task clearly needs them.
- Do not load every doc by default.
