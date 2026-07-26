# Configuration

`harness.config.json` is Structor's project-specific input file. It records:

- workspace root semantics for workspace-relative topology paths
- project name, slug, and generated repo name
- output path
- generated surface profile
- Codex and Claude support flags
- consumer repo paths, purposes, and validation commands

See the package-level [example config](../../harness.config.example.json).

## Harness Profiles

`profile` makes the generated surface choice explicit:

- `focused` is the default for newly created configs. It generates the smallest
  first-session surface for canonical routing, project/repository context,
  workflow and validation guidance, preserved-guidance population, readiness,
  workspace pointers, and explicitly enabled client hooks.
- `expanded` adds contracts, contract manifests, quality tracking, decisions,
  review skills, plans, model overlays, specialized task templates, worktree
  helpers, and generated review views.

Configs created before profiles existed remain compatible: omitting `profile`
selects `expanded`, preserving the prior generated tree. To adopt the smaller
surface, add `"profile": "focused"` and review the generation preview before
regenerating. Structor infers these defaults and does not add a wizard question.

## Path Rules

Consumer repo paths and the durable init `output.path` remain
workspace-relative. The generator rejects absolute consumer paths, `..`
traversal, symlinked consumer paths, and entrypoint writes to directories that
do not look like repositories.

From a template clone at `workspace/structor`, use consumer paths such as
`./project-app`, not `../project-app`.

## Agent Client Support

Default behavior:

- `models.openai: true` generates Codex entrypoints and Codex hook scaffolding.
- `models.anthropic: true` generates Claude entrypoints through `CLAUDE.md`.
- Claude `.claude/*` project memory, settings, hooks, rules, and skills are
  deferred for future opt-in surfaces.

Optional client support:

```json
"clientSupport": {
  "codex": {
    "hooks": true
  },
  "claude": {
    "rules": false,
    "hooks": false,
    "skills": false
  }
}
```
