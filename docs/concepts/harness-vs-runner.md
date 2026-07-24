# Harness Vs Runner

Structor creates files and validation scripts. A runner executes or coordinates
agent work over time.

Structor does not start agent sessions, poll threads, assign tasks, open pull
requests, shepherd CI, auto-repair code, merge branches, host dashboards, or
operate a control plane. Those behaviors belong in a separate runner or
orchestration layer.

Generated Codex hooks are local policy guardrails. They are not a general
execution runtime or a complete security boundary. They can catch common
high-risk operations and provide contextual reminders, but they do not replace
sandboxing, permission controls, code review, CI policy, or secret management.

Read-only generated Harness Cockpit views under `ai/views/*` are allowed when
they summarize canonical local files and do not execute validation, mutate
state, or control workflows.

See also [using Structor as an orchestrator](../anti-patterns/using-structor-as-orchestrator.md).
