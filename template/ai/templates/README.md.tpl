# Templates

Templates define reusable task and planning shapes.

## Index

- `task-brief-template.md`: canonical task brief shape
- `issue-template.md`: issue-ready implementation brief shape
- `fixtures/issues/`: validator fixtures for valid and invalid briefs

## Rule

Templates may contain placeholders. Ready task briefs must use concrete values.

## Concrete Submissions

Validate a real file without editing a starter:

```sh
node scripts/check-issue-template.mjs --file ../issue.md
node scripts/check-task-template.mjs --file ../task.md
```

Input paths resolve from the current working directory. Invalid files exit 1
with field or section diagnostics. No arguments retain starter/fixture checks.

Omitted `task_size` defaults to `standard`, preserving the sections and metadata
in these starters. `task_size: tiny` instead requires substantive `## Goal`,
`## Scope`, `## Acceptance`, and `## Validation` sections. Validation includes a
command in backticks. Tiny briefs may omit other metadata; supplied fields are
still checked and omitted fields grant no authority. Size is document shape,
not risk, permission, autonomy or effort.

Standard briefs also require `## Repository Fit`, with nonempty level-three
headings `Guidance`, `Analogues`, `Callers and Ownership`, `Conventions`,
`Departures`, and `Validation and Browser Evidence`. Follow `ai/WORKFLOW.md` for
the evidence to record and architecture-review routing before coding. Explain
absent analogues or unavailable/inapplicable browser evidence explicitly. The
validators check structure, not the correctness of architectural judgment or
whether inspection actually happened; no particular evidence prose is required.
Tiny briefs keep focused local inspection without this section.

Existing metadata names remain supported. Task `status: backlog`, task empty lists `[]`,
and `model: runtime-selected` remain supported. Concrete tasks may specify a
provider model when the task owner explicitly requires one; starter checks
still require a runtime-neutral selector. Standard issues keep title-case
statuses and nonempty allowed/forbidden path lists for implementation; report-only
issues use empty allowed paths. `auto_merge` remains
future-facing metadata only, never execution authority; high risk with
`auto_merge` is still rejected. Standard briefs retain substantive sections and
explicit protected-surfaces and future-facing-metadata statements.

Use flat scalar values or indented string lists in front matter. Quoted strings,
literal booleans and JSON string arrays are supported; nested YAML, duplicate
keys, malformed values and scalar/list mixing are rejected. Replace unresolved
markers and starter identifiers in concrete files. These checks do not enforce
tool access or prove agent behavior.

## Ownership and Intent

`repos` remains the editable-owner list. Add `read_only_repos` for repositories
inspected as dependencies, including report-only investigations. Both lists use
canonical configured consumer names or the generated harness repository name.
Reject unknown names, duplicates within either list and overlap between lists.
Omitted `read_only_repos` means no declared inspections.

`execution_intent` accepts `implementation` or `report_only`. When omitted,
`autonomy: report_only` implies report intent; otherwise implementation is the
compatibility default. When both intent and autonomy are supplied, report intent
requires report autonomy and implementation cannot use report autonomy.
Report-only submissions of either size declare no editable owners or allowed
write paths and must identify inspected repositories in `read_only_repos`.
Use `repos: []` and `allowed_paths: []`; omitted tiny scope lists mean empty.
Legacy reports that listed inspected repos in `repos` must move them to
`read_only_repos`. Other legacy task empty lists remain accepted when the
single-owner policy is disabled; empty scope grants no write authority.

The generated `taskPolicy.singleOwnerImplementation` option defaults to false.
When enabled, every concrete implementation submission (including tiny ones)
requires exactly one editable owner; read-only dependencies remain unlimited.
Starter checks still allow unfinished scope. Task size, risk and model selection
do not change ownership or execution authority.

## Path Contracts

Use repository-relative POSIX paths and simple globs: `src/**`, `docs/*.md`,
`file?.[jt]s`, or `README.md`. Quote glob strings in metadata lists. Supported
patterns include `*`, `**`, `?` and character classes. Braces and extglobs are
deliberately unsupported; write separate list entries instead. Absolute paths,
drive paths, backslashes, control characters and `..` segments are rejected.

An optional `repo:path` qualifier targets one canonical repository. Allowed
paths can name only editable owners, never a read-only dependency. Unqualified
allowed paths apply within each declared editable owner, preserving existing
multi-repository behavior when the single-owner option is disabled. A nonempty
allowed-path list requires an editable owner. Forbidden paths use the same safe
grammar and may qualify any canonical repository, including read-only ones.

Keep Scope and Path Contract prose consistent with these metadata lists. The
validator checks declarations only: it never expands globs, resolves symlinks,
constrains runtime tools or grants implementation permission. Current user
authorization and repository policy remain necessary.
