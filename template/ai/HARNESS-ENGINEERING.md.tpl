# Harness Engineering Standard

An engineering harness is the durable, versioned system of context, contracts,
validation, review policy, quality tracking, and feedback loops that makes
AI-assisted engineering reliable and repeatable.

## System Of Record

- Repo-local docs under `ai/*` are the system of record.
- Knowledge in chat or external tools is invisible until encoded here.
- Root `AGENTS.md` and `CLAUDE.md` stay short and route into `ai/*`.
- Large always-loaded instruction blobs are prohibited.

## Progressive Disclosure

Agents should load:

1. the entrypoint map
2. the current task
3. the routed docs
4. the relevant contract or review skill
5. implementation files after boundaries are clear

## Definition Of Done

The harness is useful when agents can find the right context, understand repo
boundaries, run the right validation, and report evidence without guessing.
