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

The generated profile controls which `ai/*` areas are present.

## Focused Profile Inventory

The focused inventory follows the normal first-session journey:

1. Find the canonical route in `ai/HUB.md`.
2. Verify project and repository facts in `ai/context.md` and
   `ai/PRODUCT-SUMMARY.md`.
3. Review preserved guidance through
   `ai/tasks/populate-generated-harness.md`.
4. Record work and validation expectations in `ai/WORKFLOW.md`.
5. Run generated validation and review `ai/READINESS.md` for the next action.

The supporting scripts retain only generation-contract validation, readiness,
workspace bootstrap/checks, and explicitly enabled Codex hook checks. Thin root,
workspace, and consumer entrypoints still route into the same canonical `ai/*`
policy layer.

## Expanded Profile Inventory

The expanded profile retains the prior full generated surface: architecture and
design guidance, model overlays, contracts and manifests, task and issue
templates, review skills, plans, quality tracking, decisions, worktree helpers,
and read-only HTML views.

## Deletion Test

A surface belongs in focused only when removing it would scatter a required
first-session responsibility or break the canonical route, population flow,
readiness evidence, validation, or workspace pointers. Specialized surfaces that
can remain grouped behind their existing directory and validators belong in
expanded. This reduces default cognitive load without deleting capability or
copying policy into entrypoints.

Consumer repo entrypoints are separate thin pointers. They route agents from a
consumer repo back to the generated harness and may include minimal repo-local
facts, such as purpose and validation commands.

Generated files are local files. Structor does not initialize git, create
remotes, publish branches, or mutate external services.
