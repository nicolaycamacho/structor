# Guidance Safety

This document describes the planned safe guidance takeover and post-init
migration model for Structor-generated harnesses. It is a documentation contract
for the flow Structor should expose; it does not make setup interpret or migrate
project guidance automatically.

## Root Guidance Takeover

Structor root entrypoints are the top-level agent files that route Codex,
Claude Code, and similar tools into the generated harness. The planned
`structor init` flow treats root `AGENTS.md` and `CLAUDE.md` files in consumer
repos as user-owned guidance unless the user consents to replacement.

If no root guidance exists, Structor can generate thin root entrypoints, create
the harness, create a migration task, and report deterministic setup complete.
Guidance migration is still required because the generated harness starts from
starter policy, not from interpreted project-specific conventions.

If existing root guidance is found, Structor offers only two outcomes:

- preserve the existing root guidance as consumer-local source material and
  generate Structor entrypoints
- abort setup

There is no silent skip path for root guidance takeover in the planned flow.

## Preservation Model

After consent, existing root guidance is preserved inside the consumer repo:

```text
<consumer>/
  .structor/
    preserved-guidance/
      <timestamp>/
        AGENTS.md
        CLAUDE.md
        manifest.json
```

Preserved guidance is local source material. It is not imported policy, not a
canonical harness rule, and not proof that the generated harness is ready for
real project work.

The manifest may list broader guidance candidates that deserve human review.
Tool-local state directories such as `.claude/*`, `.cursor/*`, `.codex/*`, and
`.ai/*` should not be blindly copied wholesale. They may contain caches, local
state, generated artifacts, or client-specific behavior that does not belong in
canonical harness policy.

Structor does not silently delete, upload, analyze, reinterpret, or
automatically merge preserved guidance.

## Consumer Entrypoints

Consumer entrypoints should stay thin. Their job is to route agents from the
consumer repo into the generated harness and record only minimal repo-local
facts, such as purpose and validation commands.

Canonical shared guidance belongs in the generated harness under `ai/`.
Preserved root guidance remains nearby so the user and their preferred local
agent can migrate useful conventions deliberately.

## Migration Task

The planned safe takeover flow creates concrete local migration task material.
The task should tell the user's preferred local agent to compare preserved
guidance against the generated harness and propose reviewed updates for:

- repo-specific conventions
- contract boundaries
- validation expectations
- workflow and review guidance
- project context that belongs in canonical harness docs

Structor does not run this interpretive migration during deterministic setup.
The user runs the migration task locally, reviews the result, and commits only
the guidance they accept.

## Readiness States

Setup completion and guidance readiness are separate:

```text
setup_complete: true
guidance_ready: false
```

This means Structor files, routing, and deterministic setup gates completed, but
the generated harness still needs reviewed project-specific guidance before it
should steer real implementation work.

After the user completes and reviews guidance migration:

```text
setup_complete: true
guidance_ready: true
```

Keeping these states separate lets Structor finish a deterministic local setup
without pretending it has interpreted the consumer repo's conventions,
contracts, or workflow rules.
