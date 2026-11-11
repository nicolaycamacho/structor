# {{PROJECT_NAME}} Harness Hub

This is the canonical navigation layer for the {{PROJECT_NAME}} AI Harness
Engineering Framework.

## First Session

1. Read `./ai/context.md` and `./ai/PRODUCT-SUMMARY.md` to verify the project
   and repository facts.
2. If existing guidance was preserved, follow
   `./ai/tasks/populate-generated-harness.md` and review every proposed change.
3. Record the real work and validation flow in `./ai/WORKFLOW.md`.
4. Run `node scripts/validate-governance.mjs`, then use `./ai/READINESS.md`
   to identify the next manual review.

## Baseline

Always read:

{{ENABLED_BASELINE_ENTRYPOINTS}}
- `./ai/AGENTS.md`
- `./ai/context.md`

## Routing

- Implement a change: `./ai/context.md`, `./ai/WORKFLOW.md`
- Diagnose a defect: `./ai/context.md`, `./ai/WORKFLOW.md`
- Review a change: `./ai/WORKFLOW.md`, `./ai/READINESS.md`
- Security-sensitive work: `./ai/WORKFLOW.md`; identify the owner and approval boundary before editing.
- Product or repository context: `./ai/PRODUCT-SUMMARY.md`, `./ai/context.md`
- Workflow or validation guidance: `./ai/WORKFLOW.md`, `./ai/READINESS.md`
- Implementation planning and repository-fit preparation: `./ai/WORKFLOW.md`,
  then repo-local entrypoints, routed guidance, analogues and affected callers
- Preserved-guidance population: `./ai/tasks/populate-generated-harness.md`

{{EXPANDED_PROFILE_ROUTING}}

## Load Rules

- Load the smallest doc set that can answer the task.
- Add topical docs only when the task clearly needs them.
- Do not load every doc by default.

## Missing Guidance

If a route is missing or stale, check the local entrypoint and this hub once,
then inspect the repository's own documented conventions. Record the missing
path and ask the task owner for the smallest necessary clarification before
changing a protected or unclear surface. Do not guess policy or load every doc.

Routes are navigation choices, not a requirement to read all reachable files.
Governance proves static reachability only, not that a model reads or follows it.

## Route Maintenance

Declare navigation files and exact heading names in `ai/knowledge-manifest.json`
under `routingSurfaces`. Only inline code paths and Markdown link destinations
in those sections form edges; fenced examples, URLs and anchors are ignored.
`base: root` resolves paths from the harness root, including `./ai/...`;
`base: source` resolves from the navigation file's directory. A trailing slash
selects that directory's `README.md`. There is no basename search. File anchors
do not change the target file. Absolute paths and lexical or symlink escapes fail.

Every `canonicalDocs` target must exist and be reachable from each enabled root
entrypoint and, in expanded output, each enabled model overlay. `linkedFrom`
requires a direct exact edge from a declared surface. Reachable leaves need no
surface declaration unless they also route onward. Disabled clients do not
contribute entrypoints and must not be routing targets.

Dynamic filename patterns require `dynamicReferences` entries with an exact
`source`, exact `reference` and nonempty `reason`. Only one filename wildcard
with a Markdown, JSON or HTML suffix in an existing safe directory is allowed;
parent traversal and directory wildcards are rejected. Exceptions never satisfy
required reachability. Remove stale exceptions. Run
`node scripts/validate-governance.mjs` after reviewed navigation changes.
