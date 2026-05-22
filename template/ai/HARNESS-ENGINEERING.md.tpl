# Harness Engineering Standard

An engineering harness is the durable, versioned system of context, contracts,
validation, review policy, quality tracking, and feedback loops that makes
AI-assisted engineering reliable and repeatable.

This harness is optimized for agent legibility: future agents should be able to
discover intent, boundaries, and validation paths from repo-local artifacts
instead of chat history or human memory.

## Harness, Not Runner

- The harness defines what must be true.
- A runner decides when and how work executes.
- The harness owns policy, contracts, templates, quality, and validation.
- Runtime state, polling, PR automation, dashboards, auto-merge, and repair
  loops belong outside the canonical docs layer unless explicitly authorized.

## System Of Record

- Repo-local docs under `ai/*` are the system of record.
- Knowledge in chat or external tools is invisible until encoded here.
- Root `AGENTS.md` and `CLAUDE.md` stay short and route into `ai/*`.
- Large always-loaded instruction blobs are prohibited.
- Decisions that explain durable harness changes belong in `ai/DECISIONS.md`.

## Progressive Disclosure

Agents should load:

1. the entrypoint map
2. the current task
3. the routed docs
4. the relevant contract or review skill
5. implementation files after boundaries are clear

The goal is targeted context, not maximum context. If an agent needs to load
the whole repo to understand the task, the harness is under-specified.

## Enforced Invariants

Advisory prose is not enough. Important architecture, safety, and task-shape
rules should be mechanically checked when practical.

Good harness checks:

- validate structure, links, manifests, task metadata, and review-skill shape
- fail with remediation-oriented messages an agent can act on
- prefer narrow static checks over broad fragile interpretation
- keep protected surfaces human-gated
- stay independent of product runtime state unless explicitly documented

## First-Class Artifacts

- Product, architecture, workflow, and design docs explain intent.
- Contracts encode boundaries and compatibility expectations.
- Task briefs carry machine-readable risk, autonomy, model, repo, and path
  metadata.
- Plans capture multi-step work without becoming runtime state.
- Quality grades expose weak areas honestly.
- Review skills define repeatable evaluator behavior.
- Garbage collection converts repeated mistakes into durable rules or checks.

## Consumer Repo Legibility

Consumer repos should expose enough local commands, docs, and checks for agents
to inspect and validate work without guessing:

- install, lint, test, build, dev, and health commands where applicable
- critical smoke paths and safe local validation commands
- required environment variables or local-service prerequisites
- fixture, migration, screenshot, log, and observability expectations
- root `AGENTS.md` and/or `CLAUDE.md` pointers back to this harness

## Long-Running Work Readiness

Long-running work needs handoff artifacts before it needs a runner. Task briefs
must make decomposition, validation, review routing, and recovery expectations
explicit enough that a fresh agent can continue after a context reset.

Before a task is delegated to a runner, the harness should define:

- the path contract and protected contracts
- bootstrap commands and expected context files
- required validation evidence
- evaluator or review-skill routing
- stop conditions and human approval gates
- rollback or recovery path

## Definition Of Done

This harness is production-grade when:

1. Agents can discover the right context without loading the entire repo.
2. Product, architecture, contracts, decisions, and workflow policy are
   versioned in `ai/*`.
3. Task specs are bounded by machine-checkable metadata.
4. Important architecture and safety rules are mechanically enforced where
   practical.
5. Validation evidence is required and structured.
6. Repeated agent mistakes are captured and converted into durable fixes.
7. Quality is graded and updated over time.
8. Consumer repos expose agent-legible validation and observability hooks.
9. Future runner integration can consume the harness without owning policy.
10. Protected surfaces remain human-gated.
11. OpenAI/Codex and Anthropic/Claude Code can start from native entrypoints
    without duplicating canonical policy.
