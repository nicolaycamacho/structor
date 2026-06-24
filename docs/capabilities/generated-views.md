# Generated Views

Read-only generated Harness Cockpit views under `ai/views/*` are allowed when
they are derived from canonical local files and do not execute workflows.

Views can help summarize local policy, contracts, tasks, quality signals, or
decisions. They must not become dashboards that poll live systems, control
agent sessions, mutate state, run validation, or coordinate work.

If a view needs behavior beyond read-only summaries, that belongs outside the
generated harness and outside Structor's generator scope.
