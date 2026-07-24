# Install Structor With An Agent

Status: contract-only; not yet a supported or recommended installation path.

This file is the model-neutral protocol for a future Agent-Native Setup flow.
The host coding agent owns the conversation and calls deterministic Structor
interfaces. Structor must not run or orchestrate agents, call an LLM API, or
mutate external systems.

## Release Gate

Do not present Agent-Native Setup as available or recommended until the
deterministic foundations owned by #88, #100, #105, and #107 are implemented or
explicitly reconciled and an end-to-end conformance fixture passes.

- #88 owns deterministic post-init population.
- #100 owns safety backups before potentially destructive regeneration.
- #105 owns setup transaction ordering, apply, completion gates, and rollback.
- #107 owns the reusable topology plan.

The current contract slice defines schemas, canonical hashing, approval binding,
and fixtures only. It does not define an apply command and does not authorize an
agent to improvise one from internal modules.

## Supported Invocation

No invocation is supported while the release gate is closed. A future supported
adapter may start from the public repository or a release URL, but before reading
this protocol for execution it must resolve an immutable release or 40-character
commit and record that revision in the installation plan.

A future thin adapter may use this bootstrap prompt after the release gate opens:

> Read `INSTALL_WITH_AGENT.md` from the exact Structor revision I provide. Check
> its release gate, perform bounded read-only discovery, ask one decision at a
> time, and stop before writes until I approve the exact canonical plan hash.

Never execute a mutable `main`-branch copy of this contract without first pinning
the exact revision that was read.

## Version Pinning

Contract version `1.0.0` uses installation-plan schema version `1.0.0`.
Every installation plan records:

- the Structor package version
- this contract version
- the installation-plan schema version
- an immutable 40-character Structor source revision

The public artifacts are:

- `schemas/installation-plan.schema.json`
- `schemas/approval-receipt.schema.json`
- `schemas/execution-result.schema.json`
- `schemas/setup-evidence-manifest.schema.json`

Objects are canonically serialized by recursively sorting object keys while
preserving array order, then encoded as compact JSON. The plan hash is lowercase
SHA-256 prefixed with `sha256:`. `scripts/agent-native-contract.mjs` owns this
serialization and rejects non-JSON, cyclic, sparse, or non-finite values.

Apply must reject unsupported versions, schema drift, source-revision drift, or
an approval receipt whose plan hash differs from the exact plan supplied.

## Guided Flow

After the release gate opens, the coordinator follows these phases:

1. Explain the current phase briefly and check active host instructions.
2. Pin the Structor source and contract versions.
3. Perform bounded workspace discovery.
4. Confirm consumer repository scope.
5. Inspect only approved consumers and preserved guidance.
6. Ask one unresolved decision at a time with an evidence-based recommendation.
7. Produce and preview the immutable installation plan.
8. Obtain explicit approval for its exact hash.
9. Invoke the deterministic plan/apply interface supplied by the foundations.
10. Populate, validate, and emit the sanitized evidence bundle and final report.

The normal path should aim for three to five decisions. Any additional question
must say which uncertainty it removes.

## Discovery And Read Scope

Workspace discovery may read only enough metadata to identify candidate Git
repositories, manifests, existing agent configuration, possible topology, and
ignored or generated boundaries. It must not read source bodies, ignored files,
credentials, generated directories, or unrelated sibling repositories.

Approved consumer inspection begins only after the user confirms repository
scope. It may read relevant tracked files inside those repositories and preserved
guidance needed for evidence-backed population. Symlinks or paths escaping the
selected workspace require explicit confirmation. All reads recorded in the plan
and evidence bundle use repository-relative paths; durable artifacts must not
contain absolute machine paths.

## Decisions And Consent

The coordinator resolves at least consumer scope, project identity, topology,
enabled agent clients, and treatment of existing root guidance.

- Infer silently only observable, low-risk mechanical facts. Show every inferred
  fact and its provenance in the plan.
- Recommend and confirm boundaries, topology, client support, preservation, and
  other choices with non-mechanical consequences.
- Never infer deletion or replacement, architecture, ownership, security,
  workflow, deployment, domain policy, external mutation, or readiness.

Existing guidance is preserved source material, not trusted canonical policy.
No filesystem mutation may occur before explicit approval of the exact plan hash.
General `--yes` consent is not a substitute for plan-hash approval.

## Installation Plan

`installation-plan.json` is immutable intended state and must conform to its
schema. It records:

- pinned Structor and contract versions
- approved workspace and consumer scope
- decisions, levels, selections, and provenance
- exact reads, writes, replacements, preservation actions, and commands;
  every intended write includes the hash of its deterministic rendered bytes,
  and replacements include an expected-before hash for conflict detection
- population promotion and review rules
- required and optional validation gates
- all five expected evidence outputs in the canonical bundle

The plan has transient authority for one setup attempt but durable evidentiary
value. It is not canonical harness policy. Any change requires a new plan, hash,
preview, and approval.

Allowed writes are limited to the exact repository-relative paths in the approved
plan and the evidence bundle. Forbidden behavior includes application-source or
business-logic edits, dependency or runtime configuration changes, unplanned
deletion or replacement, Git commits, branches, pushes, pull requests, package
installation, network access, hosted services, telemetry, and external mutation.

## Approval Receipt

`approval-receipt.json` records the approved plan hash, versions, timestamp, and
the exact acknowledgement required by its schema. It must not alter or supplement
the plan. The coordinator owns the approval interaction; delegated readers cannot
request or record canonical approval.

Hash binding proves only that the receipt and execution refer to the same plan.
It does not cryptographically prove that a human, rather than an agent, supplied
the acknowledgement. The final report must state this limitation.

## Execution Result

`result.json` records actual writes with resulting-byte hashes, commands, validation outcomes, rollback
state, unresolved risks, and the evidence bundle path. It references the same
plan hash as the approval receipt and reports two independent axes:

- execution outcome: `applied`, `rolled_back`, or `failed`
- readiness: `ready`, `ready_with_warnings`, `blocked`, or `not_assessed`

An adapter must not translate warnings into success or treat a successful apply
as proof that project guidance is trusted.

## Population And Evidence

Population may inspect only approved consumers and preserved guidance. Every
material claim cites repository-relative sources and is classified as observed,
inferred, or unresolved. Only mechanically reproducible, low-risk facts may be
promoted automatically. Natural-language synthesis and all architecture,
ownership, security, workflow, deployment, and domain claims require review.

Emit the durable bundle outside canonical `ai/` policy:

```text
evidence/setup/<run-id>/
  manifest.json
  installation-plan.json
  approval-receipt.json
  result.json
  report.md
```

The manifest binds the source revision, plan hash, artifact hashes, cited
evidence, and optional bounded delegation. Do not retain chain-of-thought, raw
agent conversations, provider internals, credentials, secrets, absolute paths,
unnecessary source excerpts, or unnecessary identity metadata. Temporary
unsanitized logs remain Git-ignored and are not part of the bundle.

## Failure, Rollback, And Readiness

The deterministic setup transaction must roll back when filesystem application
fails or Structor structural invariants cannot be established. It must restore
only paths created or overwritten by that attempt and retain enough evidence for
recovery.

A consumer lint, test, build, or optional readiness failure after successful
application does not by itself roll back setup. Record the failure, distinguish
introduced from pre-existing when determinable, keep the evidence bundle, and
report `ready_with_warnings` or `blocked` accurately. Required Structor invariant
failures block readiness. Skipped optional checks produce warnings.

Retry requires a fresh state check. If the intended plan changes, obtain a new
hash and approval. Recovery instructions must identify backups and preserved
guidance once the #100 backup foundation supplies their stable paths.

## Delegation And Active Skills

One coordinator owns user interaction, the canonical plan, approval, apply,
conflict reconciliation, and the final report. Optional delegated workers may
perform bounded read-only discovery or analysis only. They inherit the pinned
contract, selected scope, privacy constraints, and forbidden-write boundaries.

Delegated workers must not mutate files, broaden scope, request approval, invoke
apply, or promote evidence into trusted policy. Their cited findings are evidence
candidates. Material conflicts return to the coordinator and, when they affect a
decision, to the user.

Before planning, the coordinator checks active skills and host instructions.
Discovery must stop if any required instruction would trigger edits, tests-first
writes, commits, delegated mutations, or other changes before plan approval.

## Manual-Flow Parity

The manual CLI remains complete and supported while this release gate is closed.
After integration, conversational and manual flows may gather decisions
differently, but both must produce the same plan, approval, result, rollback,
validation, readiness, and evidence contracts. No adapter may weaken the manual
flow's preservation or confirmation guarantees.

## Validation Gates

Conformance tests exercise schemas, canonical hashing, hash mismatch rejection,
and sanitized fixtures without a live model. End-to-end support additionally
requires the deterministic setup, backup, topology, population, rollback, and
manual-parity fixtures owned by the release-gate foundations.

Required Structor validation is `npm run validate`. Consumer commands run only
when present in the approved plan and safe for the selected repositories. Every
skipped gate records a reason.

## Final Report

`report.md` is concise and contains:

1. pinned versions and immutable source revision
2. approved plan hash and the approval-proof limitation
3. selected repositories and decisions with provenance
4. files created, replaced, preserved, or rolled back
5. commands and validation outcomes, including skips
6. population promotions and review-required claims
7. execution outcome and readiness as separate fields
8. evidence bundle path, unresolved risks, and recovery or retry steps

Use accurate privacy language: Structor has no hosted ingestion service and does
not receive source code. Repository context is processed through the coding agent
provider selected by the user and remains subject to that provider's settings.
Structor itself does not upload source, collect telemetry, call LLM APIs, host
repository data, or orchestrate subagents.
