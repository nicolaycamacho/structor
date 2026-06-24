# Setting Up A Harness

Structor works best when run from a parent workspace folder:

```text
workspace/
  project-frontend/
  project-api/
```

It suggests sibling folders as consumer repos when it finds strong local
signals such as `.git`, `package.json`, `pyproject.toml`, `go.mod`,
`Cargo.toml`, `pom.xml`, `build.gradle`, `Gemfile`, or `composer.json`.

The detected list is only a suggestion. The user confirms selected repos before
any config is written. If the detected repos are rejected, the wizard falls
back to manual consumer repo path entry.

## What Init Reads

- the current workspace folder, or the folder passed with `--workspace`
- sibling folder names and local repo signals
- existing `harness.config.json`, if present
- local package metadata needed to suggest validation commands
- existing root `AGENTS.md` and `CLAUDE.md` files in selected consumer repos
- broader local guidance candidates that may need later human review

## What Init Writes

Only after confirmation, Structor can write:

- `harness.config.json` inside the generated harness
- a generated Structor harness repo at the configured `output.path`
- required consumer entrypoint pointer files
- required workspace entrypoint pointer files
- preserved root guidance under `.structor/preserved-guidance/<timestamp>/`
  inside the consumer repo after explicit consent
- a local populate-generated-harness task describing guidance review still
  required after deterministic setup

Consumer entrypoints are thin pointer files. They route Codex and Claude Code
back to the generated harness; they are not copies of canonical harness policy.

## Existing Root Guidance

Root guidance means top-level `AGENTS.md` and `CLAUDE.md` files in a consumer
repo. Structor treats them as user-owned unless the user consents to
replacement.

If existing root guidance is found, Structor offers only two outcomes:

- preserve existing guidance as consumer-local source material and generate
  Structor entrypoints
- abort setup

There is no silent skip path for required root guidance takeover.

## Manual Path

If you prefer the conservative manual path, create `harness.config.json` and
run:

```sh
npx @structor-dev/cli generate --config harness.config.json --dry-run
npx @structor-dev/cli generate --config harness.config.json --install-consumer-entrypoints
```

See [configuration](../reference/configuration.md) and
[commands](../reference/commands.md) for details.
