# Structor Product Context

Structor is early infrastructure for Harness Engineering. It generates
Repository-local AI Engineering Harnesses for consumer repositories.

## Product Model

- **Structor** is the Harness Engineering Framework and CLI.
- **Harness Engineering** is the practice of shaping durable AI guidance,
  contracts, routing, and validation for software work.
- **AI Engineering Harnesses** are sibling repositories that own guidance,
  contracts, review templates, and validators for a project workspace.
- **Consumer repositories** own implementation, runtime behavior, tests, and
  deployment-specific details.
- **Structor Self-Harness** is a Repository-local AI Engineering Harness whose
  consumer repository is Structor itself.

## User Promise

Structor should help contributors and teams make agent work more reliable by
turning guidance into versioned local files plus mechanical checks. It should
stay local, deterministic, inspectable, and conservative.

## Non-Goals

- Do not turn Structor into a runner or orchestrator.
- Do not add polling, PR automation, auto-merge, dashboards, or external writes
  to core Structor.
- Do not put Structor-specific product content into active generic templates.
- Do not build the future `structor contribute structor` command until the
  self-harness guidance is worth showing.

## Source Evidence

Use `../structor/README.md`, `../structor/CONTEXT.md`, and
`../structor/CONTRIBUTING.md` as the current terminology sources.
