# {{PROJECT_NAME}} Claude Project Memory

Use this alongside the root `CLAUDE.md` entrypoint.

@../CLAUDE.md

- Canonical policy lives in `../ai/*`.
- Canonical harness policy lives in `../ai/*`.
- Keep Claude-specific guidance thin and route back into shared docs.
- Use `.claude/settings.json` only for local tool permission settings.
- Use `.claude/rules/**` for concise project-surface rules, not copied policy.
- Claude hooks are disabled by default; add them only with a validator.
