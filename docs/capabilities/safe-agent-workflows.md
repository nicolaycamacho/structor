# Safe Agent Workflows

Structor setup is designed to separate deterministic local setup from
interpretive project guidance.

## Root Guidance Takeover

Root guidance means top-level `AGENTS.md` and `CLAUDE.md` files in a consumer
repo. Structor treats those files as user-owned unless the user consents to
replacement.

If no root guidance exists, Structor can generate thin root entrypoints, create
the harness, create the populate-generated-harness task, and report
deterministic setup complete.

If existing root guidance is found, Structor offers only two outcomes:

- preserve the existing root guidance as consumer-local source material and
  generate Structor entrypoints
- abort setup

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

Preserved guidance is not imported policy and not proof that the generated
harness is ready for real project work.

Structor does not silently delete, upload, analyze, reinterpret, or
automatically merge preserved guidance.

## Readiness

Keep these states separate:

```text
setup_complete: true
guidance_ready: false
```

After the user completes and manually verifies harness population:

```text
setup_complete: true
guidance_ready: true
```
