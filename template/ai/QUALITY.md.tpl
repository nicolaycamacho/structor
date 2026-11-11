# Harness Quality Evidence

Review the four independent evidence dimensions in `ai/READINESS.md`.
That file is canonical for scope, source evidence, observation date, method,
result and limitations. Do not duplicate observations or assign overall grades.
Run `node scripts/check-readiness.mjs` to check the record contract only.

## Review Expectations

- Structural validity: inspect saved deterministic check results at the recorded
  snapshot; generated files and passing static checks prove only their scope.
- Verified knowledge: compare project context, routes, commands and contracts
  with the bounded source evidence. Separate stable policy from source facts.
- Installation/adoption: inspect evidence of installation or actual use for the
  named client and sample. Hook configuration alone does not prove adoption.
- Observed effectiveness: inspect the bounded comparison log and its limitations.
  A complete record may report failure or an inconclusive result.
- Keep missing evidence unassessed. Never infer adoption or effectiveness from
  successful generation, configured clients or passing governance checks.

Use the optional manual comparison protocol in `ai/READINESS.md` only when
separately performing authorized observations. Generation and validation require
no live-agent evaluation, model invocation or telemetry. Static tests do not
prove agent behavior.
