# Public Launch Positioning

This is planning material for future external website and article work. It is
not polished marketing copy, not a landing page implementation, and not a
commitment to hosted services, analytics, forms, deployment, commercial assets
inside the open-source core, private policy packs, private templates, or
client-specific deliverables.

Structor should be presented as a local, open-source harness-engineering
toolkit. It generates repository-local AI Harness Engineering Frameworks for consumer
repositories so coding agents share a consistent policy layer for context
routing, contracts, task shape, review, and validation.

## Approved Positioning

- Structor generates a repository-local AI Harness Engineering Framework for your
  project.
- Structor is a generator, not a runtime.
- Structor scaffolds the harness; it does not run agents, poll sessions,
  automate pull requests, auto-merge changes, or touch external services.
- The open-source generator is local-only: no telemetry, no LLM calls, and no
  network calls during `init` or `generate`.
- Structor is MIT-licensed so teams can generate, modify, and use harness
  artifacts inside private or commercial repositories.
- Reliable agentic engineering needs more than prompts. It needs context
  architecture plus mechanical enforcement.

## Audience Split

### Individual Developers

Individual developers should understand Structor as a way to stop rebuilding
agent instructions from scratch in every repo. The promise is practical and
local: generate a repo-shaped harness, keep Codex and Claude guidance
consistent, and use validation to catch policy drift before it becomes review
noise.

The right tone is direct and tool-focused. Avoid implying that Structor replaces
the developer's judgment, runs the agent, hosts an agent workspace, or manages
pull requests.

### Teams And Companies

Teams should understand Structor as a reusable harness layer for private and
commercial codebases. The open-source core can generate and validate local
harness artifacts that teams own in their repositories. This is useful when
multiple agents, models, or contributors need the same contracts, review shape,
and safety boundaries.

The right tone is operational and evidence-based. Emphasize repository-local
policy, deterministic generation, explicit write previews, validation scripts,
and MIT-licensed use in private repositories. Avoid implying hosted dashboards,
telemetry, managed agent execution, deployment checks, forms, analytics, or
private commercial assets bundled into the open-source core.

### Future Commercial Support

Future commercial support can be described as separate from the OSS generator.
Possible paid offerings may include tailored rollout support, commercial policy
packs, private templates, training, audits, or hosted services, but those should
be framed as future or separately licensed work.

The public launch should not imply that these offerings already exist, are
included in the current package, or are required to use Structor. The OSS core
should remain understandable and valuable on its own.

## Future Landing Page Outline

1. Hero
   - Headline: Structor
   - Supporting copy: Generate repository-local AI Harness Engineering Frameworks for
     coding agents.
   - Boundary note: A generator, not a runner.
2. Problem
   - Agent workflows often rely on scattered prompts, local conventions, and
     review memory.
   - Without a harness, guidance drifts across repos, models, and contributors.
3. Product
   - Structor creates a generated harness repo beside the consumer repositories.
   - The harness owns agent guidance, contracts, review templates, validation,
     and model-specific entrypoints.
4. Local Safety Model
   - `init` and `generate` are deterministic and local-only.
   - No telemetry, no LLM calls, no network calls, and no external service
     mutation during generation.
5. Harness, Not Runner
   - Structor does not execute agents, monitor sessions, open pull requests,
     auto-merge, deploy, or manage production systems.
   - Runner or orchestration behavior belongs in a separate layer.
6. For Individuals
   - Make one repo's agent guidance easier to start, inspect, and validate.
7. For Teams
   - Share a consistent local policy layer across models, contributors, and
     private repositories.
8. Open Source Core
   - MIT-licensed generator.
   - Local artifacts that users can inspect, commit, modify, or remove.
9. Future Support
   - Separately licensed support, policy packs, private templates, audits, or
     hosted services may be explored later.
   - Keep this section clearly separate from current OSS behavior.
10. Next Step
    - Point readers to the README and `docs/INIT.md` for the current local setup
      flow.

## Article Outline

Working title: "Your AI coding agents need a harness, not just prompts."

1. The prompt pile problem
   - Most teams start with instructions scattered across READMEs, local notes,
     model-specific files, and review comments.
   - The result is inconsistent context, unclear task shape, and repeated review
     corrections.
2. What a harness adds
   - A harness gives agents a repository-local policy layer.
   - It records contracts, routing, validation, task shape, and review
     expectations as files that can be inspected and versioned.
3. Why local matters
   - Teams need to understand what the tool reads and writes.
   - Local deterministic generation is easier to review than remote automation
     or hidden runtime behavior.
4. Why validation matters
   - Policy files drift.
   - Mechanical checks make the harness more than a folder of advice.
5. Harness is not runner
   - A harness shapes work; it does not execute the work.
   - Running agents, polling sessions, PR automation, deployment, and hosted
     workflows belong in separate systems.
6. Where Structor fits
   - Structor generates the local harness structure and starter policy for a
     consumer workspace.
   - The generated harness can support Codex, Claude Code, contracts, review
     templates, and validation without taking over the user's repository.
7. What comes later
   - Future website material can discuss support, commercial policy packs,
     private templates, training, audits, or hosted services only as separate
     work.
   - Keep the open-source generator's current behavior precise.

## Language To Avoid

- Do not say Structor runs agents, supervises agents, manages sessions, opens
  pull requests, auto-merges, deploys, or repairs repositories.
- Do not imply current hosted services, telemetry, analytics, forms, dashboards,
  private policy packs, private templates, or client-specific assets.
- Do not frame commercial support as part of the open-source package.
- Do not describe the generated harness as a production runtime or CI system.
- Do not replace the harness-engineering story with generic AI productivity
  claims.
