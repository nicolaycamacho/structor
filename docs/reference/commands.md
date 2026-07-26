# Commands

The current CLI supports `init`, `agent`, `generate`, `contribute structor`,
and `doctor`. It does not include a runner command.

## `structor init`

Guided local setup for a Structor workspace:

```sh
npx @structor-dev/cli init
```

Useful options include:

- `--workspace <path>`
- `--config <path>`
- `--yes`
- `--preserve-existing-guidance`

`--yes` is not permission to replace existing non-matching root guidance. Use
`--preserve-existing-guidance` only when preserve-then-replace is explicitly intended.
## `structor agent`

Produce, hash, and apply the immutable Agent-Native Setup contract:

```sh
structor agent plan --workspace <path> --config-draft <path> \
  --plan-id <id> --source-revision <40-character-sha>
structor agent hash --plan <installation-plan.json>
structor agent apply --workspace <path> --config-draft <path> \
  --plan <installation-plan.json> --approval <approval-receipt.json>
```

The plan command emits JSON without mutating the selected workspace. Apply
requires an approval receipt bound to the exact canonical plan hash. See
[Install Structor With An Agent](../../INSTALL_WITH_AGENT.md) for the complete
model-neutral protocol.


## `structor generate`

Render a generated harness from an existing config:

```sh
npx @structor-dev/cli generate --config harness.config.json --dry-run
npx @structor-dev/cli generate --config harness.config.json --install-consumer-entrypoints
```

Use it when you already have a reviewed `harness.config.json` or need to
preview the rendered file plan.

## `structor doctor`

Inspect local Structor workspace drift:

```sh
npx @structor-dev/cli doctor --workspace .
```

`doctor` reports local setup and guidance-readiness signals. It is not a repair
loop, workflow runner, or agent coordinator.

## `structor contribute structor`

Create or refresh a local Structor contributor workspace:

```sh
npx @structor-dev/cli contribute structor
```

See [contributor setup](contributor-setup.md) for the manual fallback.
