# Generated Views

Read-only generated Harness Cockpit views under `ai/views/*` are allowed when
they are derived from canonical local files and do not execute workflows.

Views can help summarize local policy, contracts, tasks, quality signals, or
decisions. They must not become dashboards that poll live systems, control
agent sessions, mutate state, run validation, or coordinate work.

Expanded readiness and quality views display the four canonical evidence rows
from `ai/READINESS.md`, including scope, source, observation date, method, result
and limitations. The views label observations as unverified and keep unassessed
dimensions visible. Script existence and configured hooks do not establish
adoption or effectiveness. Refresh views after editing canonical records with
`node scripts/generate-html-views.mjs`; the views do not update records.

If a view needs behavior beyond read-only summaries, that belongs outside the
generated harness and outside Structor's generator scope.
