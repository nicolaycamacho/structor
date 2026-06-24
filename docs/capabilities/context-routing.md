# Context Routing

Structor-generated harnesses route agent clients from thin entrypoints into
canonical policy files.

Typical routing:

```text
consumer repo AGENTS.md or CLAUDE.md
  -> generated harness AGENTS.md or CLAUDE.md
  -> ai/HUB.md
  -> task, contract, review, and quality guidance
```

Consumer entrypoints may include minimal repo-local facts such as purpose and
validation commands. They should not copy canonical harness policy.

Model overlays stay thin. Shared guidance belongs in `ai/*`; client-specific
entrypoints should point there instead of becoming independent policy sources.
