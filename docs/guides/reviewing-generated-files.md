# Reviewing Generated Files

Review generated harness output before treating it as project guidance.

Focus on:

- whether `AGENTS.md` and `CLAUDE.md` remain thin entrypoints
- whether `ai/HUB.md` routes to the right canonical files
- whether contracts name real boundaries
- whether validation commands match the consumer repos
- whether preserved guidance was reviewed before migration
- whether generated hook guardrails remain local and deterministic
- whether links point to existing files

Generated starter guidance is intentionally generic. Do not treat setup success
as proof that Structor has understood project architecture, ownership, or
workflow expectations.

For file anatomy, see [generated files](../reference/generated-files.md). For
the post-init migration path, see [populating a harness](populating-a-harness.md).
