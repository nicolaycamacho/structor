# Model Overlays

Model overlays are thin compatibility layers for specific model or agent
systems.

Canonical policy belongs in generated `ai/*` docs. Overlay files should only:

- route agents into canonical docs
- describe model-specific tool usage differences
- avoid duplicating policy
- stay short enough to review manually

The template supports OpenAI/Codex and Anthropic/Claude Code overlay files by
default.

- OpenAI/Codex uses `AGENTS.md` entrypoints.
- Anthropic/Claude Code uses `CLAUDE.md` and `.claude/CLAUDE.md` project
  memory entrypoints.

`models.openai` and `models.anthropic` in `harness.config.json` control which
entrypoints and overlays are generated. The example config enables both model
families.
