# Generated Files

Running `structor init` creates a generated harness repo as a sibling of your
consumer repos:

```text
workspace/
  project-structor/
  project-frontend/
  project-api/
```

Inside the generated harness:

```text
ai/                 canonical policy and guidance
AGENTS.md           thin Codex entrypoint
CLAUDE.md           thin Claude Code entrypoint
harness.config.json durable project config
scripts/            generated validation and workspace checks
```

Common `ai/*` areas include:

- `ai/HUB.md` for canonical navigation
- model overlays for client-specific routing
- contracts and contract manifests
- task templates and active task guidance
- review guidance
- quality tracking and decisions
- optional read-only views

Consumer repo entrypoints are separate thin pointers. They route agents from a
consumer repo back to the generated harness and may include minimal repo-local
facts, such as purpose and validation commands.

Generated files are local files. Structor does not initialize git, create
remotes, publish branches, or mutate external services.
