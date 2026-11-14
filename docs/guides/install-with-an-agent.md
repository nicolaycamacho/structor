# Install With An Agent

This is the recommended way to install Structor. Your coding agent (Codex,
Claude Code, or a similar tool) runs the setup with you. It follows the
model-neutral protocol in
[INSTALL_WITH_AGENT.md](../../INSTALL_WITH_AGENT.md) and calls Structor's
deterministic `structor agent plan|hash|apply` commands. Nothing in your
workspace is written until you approve one exact plan hash.

## Before You Start

- Node.js 20 or newer and Git. No npm installation is needed.
- A coding agent that can run shell commands in your workspace.
- A workspace folder that holds the repositories you want Structor to cover:

  ```text
  workspace/
    my-app-frontend/
    my-app-backend/
  ```

Open your agent in that workspace folder.

## Paste This Prompt

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

## What Happens

1. The agent selects the latest qualifying [release tag](../reference/releases.md),
   verifies its metadata, and pins its commit. Every command comes from that
   checkout; no global CLI installation or npm download is needed.
2. It lists candidate repositories in the workspace using metadata only. It
   does not read source files, ignored files, or credentials.
3. You choose which repositories it may inspect.
4. It asks three to five decisions, such as project identity, topology, and
   agent clients, and gives a recommendation for each.
5. It shows you the full installation plan, including every write, and its
   `sha256:` hash.
6. You approve that hash. If anything changes after that, it needs a new plan
   and a new approval.
7. It applies the plan, runs the validation gates, and writes an evidence
   bundle under `evidence/setup/<run-id>/` in the workspace.
8. It reports two results: whether the setup was applied, and whether the
   harness is ready.

## Current Limits

- Both `focused` and `expanded` profiles support new harnesses and regeneration.
  Regeneration lists every replacement, its current-byte hash, and its backup
  path before you approve. Existing consumer-root guidance is preserved too.
- Use a fresh plan ID for each attempt. If files change after planning, create
  and approve a new plan. A failed structural check restores the previous files
  and removes new backup files; the failure report remains in the workspace's
  `evidence/setup/<run-id>/` directory.
- Consumer commands whose side effects cannot be constrained are skipped and
  reported as warnings. Review populated guidance before relying on it.
- The hash shows that the approval matches the plan. It cannot prove whether a
  person or an agent wrote the approval, so approve the hash yourself.

## After Setup

The generated harness starts with starter guidance. Setup finishing and the
guidance being ready are separate states. Before relying on the harness for
real work, see [populating a harness](populating-a-harness.md) and
[reviewing generated files](reviewing-generated-files.md).
