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

1. Clone Structor with all tags into a temporary directory outside this
   workspace. Select the highest stable vX.Y.Z annotated tag reachable from
   origin/main; stop if none exists. Check out that tag in detached mode.
2. Run `node scripts/check-release.mjs --tag <selected-tag>` in that checkout.
   Stop if it fails. Record the tag and full 40-character commit from
   `git rev-parse HEAD`, then read INSTALL_WITH_AGENT.md and follow it exactly.
3. Treat the current directory as the workspace. Show me the candidate
   repositories you find and wait for me to approve which ones you may inspect.
4. Ask me any unresolved decisions one at a time, each with your recommendation.
5. Invoke every command with `node /path/to/pinned/structor/bin/structor.mjs`.
   Run `agent plan` with the recorded commit as --source-revision, show me the
   complete plan and hash, and wait for my approval of that hash before apply.
6. Preserve existing AGENTS.md and CLAUDE.md files, make no application source
   changes, and report the execution outcome and readiness separately.
```

Nothing is written until you approve the exact plan hash. See
[install with an agent](docs/guides/install-with-an-agent.md) for what to
expect.

## Docs

- [Docs index](docs/index.md) · [Quickstart](docs/guides/quickstart.md)
- [Setting up a harness](docs/guides/setting-up-a-harness.md)
- [Troubleshooting](docs/guides/troubleshooting.md)
- [Commands](docs/reference/commands.md)
- [What Structor is](docs/concepts/what-structor-is.md)
- [Contributor setup](docs/reference/contributor-setup.md)

[MIT License](LICENSE) · [Security](SECURITY.md) · [Roadmap](ROADMAP.md)
