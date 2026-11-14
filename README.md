# Structor

Structor is a Harness Engineering Framework. It does more than drop a rules
file into your repo: it generates a Repository-local AI Harness Engineering
Framework, a versioned repository that gives Codex, Claude Code, and similar
agents shared context routing, contracts, task shape, review expectations, and
validation.

It works with a single repository, but it shines in multi-repo workspaces. One
generated harness sits beside all your repositories and coordinates how agents
read, plan, and validate work that spans them, such as a frontend, an API, and
shared libraries.

Structor is a generator, not a runner: it never runs agents, calls LLM APIs,
or collects telemetry.

## Install

### Recommended: ask your coding agent

Open your coding agent in the folder that holds your repositories, and paste:

```text
Install Structor (https://github.com/nicolaycamacho/structor) in this
workspace using its agent-native setup protocol.

1. Clone Structor into a temporary directory outside this workspace and
   record the full 40-character commit from `git rev-parse HEAD`. Use only
   that clean, pinned checkout from here on.
2. Read INSTALL_WITH_AGENT.md in that checkout and follow it exactly.
3. Treat the current directory as the workspace. Show me the candidate
   repositories you find and wait for me to approve which ones you may inspect.
4. Ask me any unresolved decisions one at a time, each with your recommendation.
5. Run `structor agent plan` from the pinned checkout, show me the complete
   plan and its hash, and do not run `structor agent apply` until I approve
   that exact hash.
6. Preserve existing AGENTS.md and CLAUDE.md files, make no application source
   changes, and report the execution outcome and readiness separately.
```

Nothing is written until you approve the exact plan hash. See
[install with an agent](docs/guides/install-with-an-agent.md) for what to
expect.

### Fallback: npm CLI (being deprecated)

The npm package is being deprecated. Use it only for what the agent path does
not cover yet: the `expanded` profile, or regenerating a harness you already
have. Run it from the same folder:

```sh
npx @structor-dev/cli init
```

See the [quickstart](docs/guides/quickstart.md).

## Docs

- [Docs index](docs/index.md): start here
- [Setting up a harness](docs/guides/setting-up-a-harness.md)
- [Troubleshooting](docs/guides/troubleshooting.md)
- [Commands](docs/reference/commands.md)
- [What Structor is](docs/concepts/what-structor-is.md)
- [Contributor setup](docs/reference/contributor-setup.md)

[MIT License](LICENSE) · [Security](SECURITY.md) · [Roadmap](ROADMAP.md)
