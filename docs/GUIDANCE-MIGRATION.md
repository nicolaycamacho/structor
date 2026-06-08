# Guidance Migration

Guidance migration exists because Structor must install root entrypoints that
route agents through the generated harness, while existing repo-specific
guidance may still contain useful local knowledge.

## Trust Boundaries

Preserved guidance is source material, not trusted canonical policy. Verify
paths, commands, architecture claims, ownership rules, and workflow expectations
against the current consumer repo before moving anything into the harness.

## Existing Root Guidance

When Codex support is enabled, `structor init` checks consumer `AGENTS.md`.
When Claude support is enabled, it checks consumer `CLAUDE.md`.

If an existing root file already matches the expected Structor-generated
entrypoint for the selected harness, Structor verifies it and does not create
migration debt for that file.

If an existing root file does not match, Structor offers only preserve and
replace, or abort. There is no skip mode for required root entrypoints.

## Preserved Guidance

Preserved root guidance is copied inside the consumer repo:

```text
.structor/preserved-guidance/<timestamp>/
  AGENTS.md
  CLAUDE.md
  README.md
  manifest.json
```

Structor does not upload, analyze, merge, reinterpret, or delete the preserved
files. The manifest may list additional guidance candidates from known local
guidance folders, but those files are not copied automatically.

## What Structor Will Not Do

- call an LLM or remote service
- preserve `.claude/*`, `.cursor/*`, `.codex/*`, or `.ai/*` wholesale
- merge preserved guidance into canonical harness docs
- certify guidance readiness mechanically
- use `--force` as consent to take over existing root guidance

## Root Entrypoint Replacement

After preservation consent, Structor replaces root `AGENTS.md` and `CLAUDE.md`
with thin generated entrypoints. Canonical policy remains in the generated
harness.

## `--yes` Behavior

`structor init --yes` is not permission to replace existing non-matching root
guidance. It aborts when that guidance is found.

Use `structor init --yes --preserve-existing-guidance` only when the
preserve-then-replace flow is explicitly intended.

## Required Post-Init Migration

A successful setup means routing and bootstrap files are installed and generated
checks pass:

```text
setup_complete: true
guidance_ready: false
```

Guidance is not ready until a human or local agent reviews preserved guidance
and repo evidence, then migrates still-relevant knowledge into canonical harness
docs.

## Running The Generated Migration Task

Open the generated harness task:

```text
ai/tasks/guidance-migration.md
```

Use it with:

```text
ai/templates/guidance-migration-prompt.md
```

Review the resulting harness doc changes before treating the harness as
guidance-ready.
