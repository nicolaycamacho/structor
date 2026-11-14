# Setting Up A Harness

Start with the recommended [agent install prompt](install-with-an-agent.md).
Structor works from a parent workspace folder that holds your consumer repos:

```text
workspace/
  project-frontend/
  project-api/
```

The agent pins a verified release checkout outside that workspace. It lists
candidate repositories using metadata, then waits for your approval before
inspecting selected repositories. It asks unresolved decisions one at a time.

## What Setup Reads

The exact installation plan lists the selected workspace, approved consumers,
config draft, relevant repository metadata, existing root guidance, and any
reviewed population drafts. Ignored files, credentials, and unrelated source
are outside the inspection scope. See the
[setup protocol](../../INSTALL_WITH_AGENT.md) for the complete boundary.

## What Setup Writes

Only after you approve the exact plan hash, Structor can write the listed:

- generated harness and its durable `harness.config.json`
- thin consumer and workspace entrypoints
- consumer-local backups of existing root guidance
- generated population task, readiness record, and execution evidence

Application source is not changed. Entrypoints route agents back to canonical
policy in the generated harness. A changed source, config, or workspace state
requires a new plan and approval before applying it.

## Existing Root Guidance

Existing top-level `AGENTS.md` and `CLAUDE.md` files are user-owned. The plan
shows how their original bytes will be preserved under
`.structor/preserved-guidance/<run-id>/` before replacement with thin pointers.
Review and approve that plan, or stop setup. Regeneration also lists each
replacement's current-byte hash and backup path before approval.

## Deterministic Generation

For a reviewed config, the Initializer remains available from the same pinned
checkout:

```sh
node /absolute/path/to/structor/bin/structor.mjs generate --config harness.config.json --dry-run
node /absolute/path/to/structor/bin/structor.mjs generate --config harness.config.json --install-consumer-entrypoints
```

This is a rendering interface. The agent plan/apply path owns the complete
approved setup transaction, preservation, validation, and evidence. See
[configuration](../reference/configuration.md) and
[commands](../reference/commands.md).
