---
paths:
  - "AGENTS.md"
  - "CLAUDE.md"
  - ".claude/**"
  - ".codex/**"
  - "ai/model-overlays/**"
  - "scripts/check-*-compatibility.mjs"
  - "scripts/check-overlay-drift.mjs"
---

# Harness Client Surface Rules

- Keep `ai/*` as the canonical governance source of truth.
- Keep `AGENTS.md` and `.codex/**` Codex-native.
- Keep `CLAUDE.md` and `.claude/**` Claude Code-native.
- Do not make Codex depend on `CLAUDE.md`.
- Do not make Claude Code depend on `AGENTS.md`.
- Do not copy broad canonical docs into `.claude/`; route back to `ai/*`.
- Do not add Claude Code hooks until a fixture-backed validator is added.
