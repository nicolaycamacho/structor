# {{PROJECT_NAME}} AI Engineering Harness

This repository contains the AI Engineering Harness for {{PROJECT_NAME}}.

The AI Engineering Harness defines policy, contracts, context routing, task
templates, review rules, quality tracking, and validation. It does not implement
product behavior and it is not a runner or orchestration runtime.

## Client Support

This harness includes the client support selected during generation:

- OpenAI/Codex enabled: `{{MODEL_OPENAI_ENABLED}}`
- Anthropic/Claude Code enabled: `{{MODEL_ANTHROPIC_ENABLED}}`
- Codex hooks enabled: `{{CLIENT_CODEX_HOOKS_ENABLED}}`
- Claude project rules deferred: `{{CLIENT_CLAUDE_RULES_ENABLED}}`
- Claude hooks enabled: `{{CLIENT_CLAUDE_HOOKS_ENABLED}}`
- Claude skills enabled: `{{CLIENT_CLAUDE_SKILLS_ENABLED}}`

Canonical policy lives in `ai/*`. Client-specific files are thin startup,
overlay, or local guardrail surfaces that route back to that canonical policy.
They should not become independent policy sources.

Codex hook support, when enabled, is intentionally conservative: deterministic,
local, bounded by short timeouts, and validated to avoid network calls, external
writes, and runtime-state mutation. It is a harness guardrail, not a runner or a
complete security boundary. Hooks catch common high-risk operations and provide
contextual reminders, but they do not replace sandboxing, permission controls,
code review, CI policy, or secret management.

## Expected Workspace Layout

This AI Engineering Harness is intended to live as a sibling of the consumer
repositories it governs:

```text
workspace/
  {{HARNESS_REPO_NAME}}/
  <consumer-repo>/
  <optional-second-consumer-repo>/
```

The workspace bootstrap and check scripts resolve consumer repositories from
that shared parent folder.

## Consumer Repositories

{{CONSUMER_REPOS_LIST}}

## First Run

Validate the AI Engineering Harness:

```sh
node scripts/validate-governance.mjs
```

Generated artifact, entrypoint, and check participation lives in
`scripts/generated-harness-contract.mjs`. The validator uses that contract to
resolve required files, trusted check dependencies, and enabled client-support
surfaces.

`validate-governance.mjs` also runs client-support checks when the matching
surfaces are enabled:

- `scripts/check-codex-hooks.mjs`
- `scripts/check-claude-compatibility.mjs`
- `scripts/check-overlay-drift.mjs`

Preview workspace-level pointer files:

```sh
node scripts/bootstrap-workspace.mjs --dry-run
```

If the preview is safe, install or refresh workspace-level pointers and verify
the full layout:

```sh
node scripts/bootstrap-workspace.mjs
node scripts/check-workspace.mjs
```

`bootstrap-workspace.mjs` installs workspace-level `AGENTS.md` and `CLAUDE.md`
when the selected model support requires them. It skips existing files unless
`--force` is passed.

## Daily Use

Agents should start from the workspace, this harness repo, or a bootstrapped
consumer repo, then follow the local `AGENTS.md` or `CLAUDE.md` entrypoint into
`ai/HUB.md`.

Consumer repos own implementation, runtime behavior, local validation, and
deployment checks. The harness owns shared policy, contracts, task templates,
review guidance, and validation evidence expectations.

## Validation

```sh
node scripts/validate-governance.mjs
node scripts/check-workspace.mjs
```

If workspace entrypoints are missing or stale:

```sh
node scripts/bootstrap-workspace.mjs --dry-run
node scripts/bootstrap-workspace.mjs
```

Consumer repos should expose local install, lint, test, build, and health
commands. The harness documents expected contracts and validation evidence, but
consumer repos own implementation and runtime checks.
