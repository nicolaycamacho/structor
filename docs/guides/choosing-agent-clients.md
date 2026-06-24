# Choosing Agent Clients

Structor uses a hybrid model for agent-client support:

- concrete template files provide stable structure, safety defaults, and
  validators
- the initialization agent may customize project-specific wording,
  deny-rule descriptions, and review guidance after inspecting consumer repos
- the initialization agent should not invent client-support structure from
  scratch

This keeps generated harnesses consistent while still letting each project
adapt guidance to its domain.

## Codex

Generated Codex support can include:

- `AGENTS.md`
- `ai/model-overlays/openai/AGENTS.md`
- `.codex/hooks.json`
- `scripts/hooks/codex-hook.mjs`
- `scripts/hooks/lib/codex-hooks-core.mjs`
- `scripts/check-codex-hooks.mjs`

Codex hooks are conservative local policy guardrails. They are not a runner or
a complete security boundary.

## Claude Code

Generated Claude Code support can include:

- `CLAUDE.md`
- `ai/model-overlays/anthropic/CLAUDE.md`
- `scripts/check-claude-compatibility.mjs`

Claude `.claude/*` project memory, settings, hooks, rules, and skills are
deferred for future opt-in surfaces. Keep `clientSupport.claude.rules`,
`clientSupport.claude.hooks`, and `clientSupport.claude.skills` false or omit
them until those surfaces exist.

Claude Code discovers project skills from `.claude/skills/*/SKILL.md` in the
current repo, parent repos up to the repo root, and configured global or
additional directories. A consumer `CLAUDE.md` pointer to a sibling generated
harness does not make harness-local `.claude/skills` available when Claude Code
starts inside the consumer repo.
