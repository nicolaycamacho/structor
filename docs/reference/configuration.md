# Configuration

`harness.config.json` is Structor's project-specific input file. It records:

- workspace root semantics for workspace-relative topology paths
- project name, slug, and generated repo name
- output path
- generated surface profile
- Codex and Claude support flags
- consumer repo paths, purposes, and validation commands

See the package-level [example config](../../harness.config.example.json).

## Task Ownership Policy

```json
"taskPolicy": {
  "singleOwnerImplementation": true
}
```

This opt-in policy requires exactly one editable repository in concrete
implementation submissions, including tiny tasks. Omitted `taskPolicy`, an empty
object, or `singleOwnerImplementation: false` preserves multi-repository
implementation and legacy empty task scope. Profiles and client support do not
change this policy. Existing generated projects are not silently rewritten;
review configuration and regeneration before adopting it.

Generated task metadata retains `repos` for editable owners and adds
`read_only_repos` for inspected dependencies. Names must be canonical, unique
within each list and non-overlapping. `execution_intent` is `implementation` or
`report_only`; when omitted it follows `autonomy: report_only`, otherwise it
defaults to implementation. Explicit intent and autonomy must agree. Report-only
submissions declare no editable owners or allowed paths and identify inspected
repositories in `read_only_repos`. Legacy reports must move inspection-only names
out of `repos`; missing read-only metadata otherwise means no inspections.

Allowed and forbidden paths use repository-relative POSIX paths or simple globs
(`*`, `**`, `?`, character classes). An optional `repo:path` qualifier targets a
canonical repository; allowed paths may target only editable owners. Unqualified
allowed patterns apply inside each declared owner. Absolute paths, drive paths,
parent traversal, backslashes, controls, braces and extglobs are rejected. Split
brace alternatives into separate list entries. Forbidden paths can also name
read-only repositories. Scope prose must match metadata; it is not parsed for
additional authority.

These static declarations do not confine runtime tools, resolve symlinks,
authorize implementation, or prove agent behavior. Existing risk, human-approval
and future-facing `auto_merge` semantics remain in effect.

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
