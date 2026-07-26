# Generated Harness Tree Artifact

This checked-in file is a text artifact for public inspection. It is not a generated harness directory, and no generated harness output is committed here.

The tree below is derived from the checked-in example configs and `scripts/generated-harness-contract.mjs`. `npm run check:ci` verifies that this artifact stays synchronized with the expected generated file, workspace pointer, and consumer pointer surfaces.

## OpenAI-only example

Source config: `examples/single-repo/harness.config.json`

```text
workspace/
  example-frontend-structor/
    .codex/hooks.json
    .structor/manifest.json
    AGENTS.md
    README.md
    ai/AGENTS.md
    ai/HUB.md
    ai/PRODUCT-SUMMARY.md
    ai/READINESS.md
    ai/WORKFLOW.md
    ai/context.md
    ai/tasks/populate-generated-harness.md
    ai/templates/populate-generated-harness-prompt.md
    scripts/bootstrap-workspace.mjs
    scripts/check-codex-hooks.mjs
    scripts/check-readiness.mjs
    scripts/check-template-governance.mjs
    scripts/check-workspace.mjs
    scripts/generated-harness-contract.mjs
    scripts/hooks/codex-hook.mjs
    scripts/hooks/lib/codex-hooks-core.mjs
    scripts/lib/path-safety.mjs
    scripts/lib/worktree-bootstrap.mjs
    scripts/validate-governance.mjs
    workspace/AGENTS.md
  AGENTS.md  # workspace pointer to example-frontend-structor/workspace/AGENTS.md
  example-frontend/
    AGENTS.md  # consumer pointer to example-frontend-structor/consumer/AGENTS.md
```

## Anthropic-only example

Source config: `examples/anthropic-only/harness.config.json`

```text
workspace/
  example-api-structor/
    .structor/manifest.json
    CLAUDE.md
    README.md
    ai/AGENTS.md
    ai/HUB.md
    ai/PRODUCT-SUMMARY.md
    ai/READINESS.md
    ai/WORKFLOW.md
    ai/context.md
    ai/tasks/populate-generated-harness.md
    ai/templates/populate-generated-harness-prompt.md
    scripts/bootstrap-workspace.mjs
    scripts/check-readiness.mjs
    scripts/check-template-governance.mjs
    scripts/check-workspace.mjs
    scripts/generated-harness-contract.mjs
    scripts/lib/path-safety.mjs
    scripts/lib/worktree-bootstrap.mjs
    scripts/validate-governance.mjs
    workspace/CLAUDE.md
  CLAUDE.md  # workspace pointer to example-api-structor/workspace/CLAUDE.md
  example-api/
    CLAUDE.md  # consumer pointer to example-api-structor/consumer/CLAUDE.md
```

## OpenAI and Anthropic example

Source config: `examples/frontend-backend/harness.config.json`

```text
workspace/
  example-platform-structor/
    .codex/hooks.json
    .structor/manifest.json
    AGENTS.md
    CLAUDE.md
    README.md
    ai/AGENT-GARBAGE-COLLECTION.md
    ai/AGENTS.md
    ai/ARCHITECTURE.md
    ai/CODEX-HOOKS.md
    ai/DECISIONS.md
    ai/DESIGN.md
    ai/HARNESS-ENGINEERING.md
    ai/HARNESS.md
    ai/HUB.md
    ai/PRODUCT-SUMMARY.md
    ai/PRODUCT.md
    ai/QUALITY.md
    ai/READINESS.md
    ai/RUNNER-READINESS.md
    ai/RUNNER-SAFETY.md
    ai/VERSIONING.md
    ai/WORKFLOW.md
    ai/context.md
    ai/contracts/README.md
    ai/contracts/api-boundary.contract.json
    ai/contracts/api-boundary.md
    ai/contracts/app-legibility.contract.json
    ai/contracts/app-legibility.md
    ai/contracts/codex-hooks.contract.json
    ai/contracts/codex-hooks.md
    ai/contracts/github-safety.contract.json
    ai/contracts/github-safety.md
    ai/contracts/release-flow.contract.json
    ai/contracts/release-flow.md
    ai/contracts/repo-boundaries.contract.json
    ai/contracts/repo-boundaries.md
    ai/contracts/security-boundary.contract.json
    ai/contracts/security-boundary.md
    ai/knowledge-manifest.json
    ai/model-overlays/anthropic/CLAUDE.md
    ai/model-overlays/openai/AGENTS.md
    ai/plans/README.md
    ai/plans/tech-debt.md
    ai/skills/README.md
    ai/skills/review-architecture.md
    ai/skills/review-contract-drift.md
    ai/skills/review-governance-drift.md
    ai/skills/review-security.md
    ai/specs/README.md
    ai/tasks/populate-generated-harness.md
    ai/templates/README.md
    ai/templates/fixtures/issues/invalid-placeholder.md
    ai/templates/fixtures/issues/invalid-protected-surface.md
    ai/templates/fixtures/issues/valid-ready.md
    ai/templates/issue-template.md
    ai/templates/populate-generated-harness-prompt.md
    ai/templates/task-brief-template.md
    ai/workspace/LOCAL-STACK.md
    ai/workspace/REPOS.md
    ai/workspace/SESSION-BOOTSTRAP.md
    ai/workspace/SYSTEM-MAP.md
    ai/workspace/TEST-STRATEGY.md
    scripts/bootstrap-codex-worktree.mjs
    scripts/bootstrap-workspace.mjs
    scripts/check-claude-compatibility.mjs
    scripts/check-codex-hooks.mjs
    scripts/check-contract-manifests.mjs
    scripts/check-garbage-collection.mjs
    scripts/check-html-views.mjs
    scripts/check-issue-template.mjs
    scripts/check-knowledge-manifest.mjs
    scripts/check-overlay-drift.mjs
    scripts/check-plans.mjs
    scripts/check-readiness.mjs
    scripts/check-review-skills.mjs
    scripts/check-task-template.mjs
    scripts/check-template-governance.mjs
    scripts/check-workspace.mjs
    scripts/check-worktree-bootstrap-fixtures.mjs
    scripts/check-worktrees.mjs
    scripts/fixtures/worktrees/README.md
    scripts/generate-html-views.mjs
    scripts/generated-harness-contract.mjs
    scripts/hooks/codex-hook.mjs
    scripts/hooks/lib/codex-hooks-core.mjs
    scripts/lib/path-safety.mjs
    scripts/lib/worktree-bootstrap.mjs
    scripts/validate-governance.mjs
    workspace/AGENTS.md
    workspace/CLAUDE.md
  AGENTS.md  # workspace pointer to example-platform-structor/workspace/AGENTS.md
  CLAUDE.md  # workspace pointer to example-platform-structor/workspace/CLAUDE.md
  example-frontend/
    AGENTS.md  # consumer pointer to example-platform-structor/consumer/AGENTS.md
    CLAUDE.md  # consumer pointer to example-platform-structor/consumer/CLAUDE.md
  example-api/
    AGENTS.md  # consumer pointer to example-platform-structor/consumer/AGENTS.md
    CLAUDE.md  # consumer pointer to example-platform-structor/consumer/CLAUDE.md
```

## OpenAI and Anthropic example

Source config: `examples/openai-and-anthropic/harness.config.json`

```text
workspace/
  example-worker-structor/
    .codex/hooks.json
    .structor/manifest.json
    AGENTS.md
    CLAUDE.md
    README.md
    ai/AGENTS.md
    ai/HUB.md
    ai/PRODUCT-SUMMARY.md
    ai/READINESS.md
    ai/WORKFLOW.md
    ai/context.md
    ai/tasks/populate-generated-harness.md
    ai/templates/populate-generated-harness-prompt.md
    scripts/bootstrap-workspace.mjs
    scripts/check-codex-hooks.mjs
    scripts/check-readiness.mjs
    scripts/check-template-governance.mjs
    scripts/check-workspace.mjs
    scripts/generated-harness-contract.mjs
    scripts/hooks/codex-hook.mjs
    scripts/hooks/lib/codex-hooks-core.mjs
    scripts/lib/path-safety.mjs
    scripts/lib/worktree-bootstrap.mjs
    scripts/validate-governance.mjs
    workspace/AGENTS.md
    workspace/CLAUDE.md
  AGENTS.md  # workspace pointer to example-worker-structor/workspace/AGENTS.md
  CLAUDE.md  # workspace pointer to example-worker-structor/workspace/CLAUDE.md
  example-worker/
    AGENTS.md  # consumer pointer to example-worker-structor/consumer/AGENTS.md
    CLAUDE.md  # consumer pointer to example-worker-structor/consumer/CLAUDE.md
```

