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

Metadata names remain unchanged. Task `status: backlog`, task empty lists `[]`,
and `model: runtime-selected` remain supported. Standard issues keep title-case
statuses and nonempty allowed/forbidden path lists. `auto_merge` remains
future-facing metadata only, never execution authority; high risk with
`auto_merge` is still rejected. Standard briefs retain substantive sections and
explicit protected-surfaces and future-facing-metadata statements.

Use flat scalar values or indented string lists in front matter. Quoted strings,
literal booleans and JSON string arrays are supported; nested YAML, duplicate
keys, malformed values and scalar/list mixing are rejected. Replace unresolved
markers and starter identifiers in concrete files. These checks do not enforce
tool access or prove agent behavior.
