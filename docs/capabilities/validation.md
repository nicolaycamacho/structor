# Validation

Structor validation is split between this package and generated harnesses.

## Structor Package Checks

Run:

```sh
npm run check:ci
npm run validate
```

`npm run check:ci` runs fast structural checks for local iteration and CI
hygiene, including config examples, shipped schemas, template files, task
template structure, contract manifests, placeholder hygiene, public hygiene,
model overlay thinness, the docs manifest, and the source-repo map.

`npm run validate` runs `check:ci`, the Node test suite, and smoke-tested local
generation flows.

## Generated Harness Checks

Generated harness files are declared by Structor's generated harness contract.
Generated validation can include governance checks, workspace bootstrap checks,
workspace routing checks, model overlay drift checks, Codex hook checks, and
Claude compatibility checks when those surfaces are enabled.

Validation detects structural drift. It does not certify that all
project-specific guidance is complete or correct.

## Validate A Concrete Issue Or Task

Both profiles include read-only submission validators. From the generated
harness, pass a Markdown file explicitly; relative input paths resolve from the
current working directory:

```sh
node scripts/check-issue-template.mjs --file ../issue.md
node scripts/check-task-template.mjs --file ../task.md
```

A successful check exits 0. Invalid submissions, unreadable files and invalid
arguments exit 1 with the input filename and field or section diagnostics.
Concrete files must replace unresolved angle-bracket or double-brace markers,
starter identifiers and unfinished-text markers. Required sections must contain
text, and Validation must include a concrete command in backticks.

Without arguments, expanded harnesses still check the shipped task starter and
issue starter/positive and negative fixtures. Focused harnesses omit those
starters and report that `--file` is needed; the existing focused governance
checks remain unchanged. Package `npm run check:task-template` still checks the
source starter template. Existing generated projects are not changed unless
explicitly regenerated.

### Task Size

`task_size` is additive metadata accepted by both submission validators. Omit it
for the existing `standard` shape, or set it to `standard` explicitly. Standard
retains the substantive sections of the existing task/issue starters, including
Path Contract, Bootstrap Requirements, Success Criteria, Validation Evidence
Required and Review Routing.

For a tiny brief, set `task_size: tiny` and provide four substantive sections:
Goal, Scope, Acceptance and Validation. Other metadata is optional for tiny
briefs and checked when supplied. Omitted metadata grants no authority. Size
selects document shape only; it is not risk, permission, autonomy or effort.
Existing approval rules still apply regardless of size. For example:

```markdown
---
task_size: tiny
---
# Correct a guide command

## Goal
Correct the guide's command spelling.

## Scope
Only the command example in the guide.

## Acceptance
The example matches the existing package script.

## Validation
Run `npm test`.
```

### Metadata Compatibility

Existing names remain unchanged: `id`, `status`, `risk`, `autonomy`,
`model_policy`, `repos`, `allowed_paths`, `forbidden_paths`, and
`requires_human_approval`. Standard tasks also retain `model`, defaulting in
the starter to `runtime-selected`. Concrete tasks may use a provider-specific
selector when explicitly required by the task owner, as the existing starter
documents. No-argument starter checks still require a runtime-neutral selector.
Issue statuses keep their
existing title-case spellings (for example `Ready for Agent`); tasks also accept
lowercase underscore spellings, including the starter's `backlog`.

`autonomy: auto_merge` remains valid future-facing metadata, subject to the
existing rejection of `risk: high` with `auto_merge`. It does not execute or
authorize a merge. Standard briefs retain the explicit protected-surfaces and
future-facing-metadata statements. Task list fields retain `[]` compatibility;
standard issues retain nonempty allowed/forbidden path lists. Repository names
must match the generated harness or its configured consumers. These structural
checks do not implement ownership or repository-fit evidence enforcement.

The shared reader supports a bounded flat front-matter subset: unquoted
single-line strings, single/double-quoted strings, literal `true`/`false`,
indented string lists, and JSON string arrays (including `[]`). Use quotes for
strings containing YAML punctuation, and JSON syntax for inline lists. Blank
lines, whole-line comments and CRLF files are accepted. Duplicate keys,
nested mappings, malformed quotes/lists, scalar/list mixing and missing
front-matter delimiters fail explicitly. This is not a general YAML parser.

Validation is static preparation evidence. It does not prove agent behavior,
confine tools, execute validation commands, or grant permission to edit files.
