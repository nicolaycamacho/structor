# Evidence index

All observations are from 2026-11-13 and concern synthetic public source only.
`EVIDENCE` replaces the worker's report-directory prefix; `ARTIFACTS` replaces
the artifacts checkout prefix. These are redaction labels, not runnable paths.
No source/result text is intentionally changed by that normalization. Terminal
blank lines in the rehearsal failure log are trimmed. Saved unified diffs are
wrapped in JSON under `patch`, preserving their exact diff text, including blank
context lines, without introducing whitespace errors in repository review.

- [Package identity](package-identity.json), [pinned validation excerpts](pinned-validation.txt)
  and [condition manifests](conditions.json) bind the experiment to one source
  commit and tarball. The tarball itself and generated harness directories are
  not committed. All 182 package files matched both pinned source and installed
  files byte-for-byte. The source validation also exercises package smoke.
- Setup: [first missing-consent failure](a-assisted-setup.log),
  [generation followed by missing workspace pointer](a-assisted-rehearsal-bootstrap.log),
  and final successful setup logs for each condition. See the results report
  for which log names identify rehearsals versus measured workspaces.
- Each `*-attempt.json` contains observed model/effort, child-run timestamps,
  tool-call count, assistant messages and tool requests/results. System/developer
  instructions, encrypted dispatch records and private reasoning are excluded.
  Requests are retained even when their output was truncated by the original
  client. No transcript is synthesized from a desired solution.
- Each `*-acceptance.json` contains the evaluator's commands, exit statuses,
  output and complete changed-file list relative to its pre-attempt snapshot.
  The corresponding `*-before-files.json` records every non-Git source/guidance
  file's SHA-256 before the attempt; `*-after-files.json` permits an independent
  hash comparison after it. `*-before.patch.json`/`.status` capture setup
  changes; `*-after.patch.json`/`.status` include the final consumer state and must be
  compared with the before records. They are not all attempt-authored changes.

The dispatch text is the protocol's common briefing with its task and condition
substitutions, exactly as described there; only the absolute workspace path
varied. All child contexts were fresh. Native children inherited the same
system/developer environment, tool catalog, general memories and initial artifacts
checkout directory; no parent conversation history was forked. This is scoped
instructional isolation, not operating-system or credential confinement. The
evaluator reviewed the visible calls for out-of-workspace reads, answer reads,
network access and external assistance. No such access was observed. Absence
from this trace is not proof of runtime confinement or hidden model internals.
