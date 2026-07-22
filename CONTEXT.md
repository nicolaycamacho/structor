# Structor

Structor is a Harness Engineering Framework for creating Repository-local AI
Harness Engineering Frameworks for consumer repositories. This glossary names
the core concepts so setup, generation, and repo-inspection work stay distinct.

## Language

**Setup Wizard**:
An interactive onboarding flow that gathers project facts, prepares harness
configuration, previews planned writes, and guides the user through generation.
_Avoid_: Installer, runner, initializer

**Agent-Native Setup**:
A guided setup experience where the user works through an existing coding agent,
while Structor remains responsible only for deterministic planning, filesystem
mutation, preservation, validation, and reporting.
_Avoid_: Runner, hosted agent, LLM integration, autonomous setup

**Initializer**:
The deterministic renderer that turns harness configuration and templates into a
Repository-local AI Harness Engineering Framework and optional consumer entrypoints.
_Avoid_: Wizard, scanner, runner

**Generated AI Harness Engineering Framework**:
The repository produced by Structor that owns AI guidance, contracts, review
templates, validation scripts, and routing policy for one project workspace.
_Avoid_: Template repo, consumer repo, runner

**Harness Cockpit**:
A read-only generated review view under `ai/views/*` that visualizes workspace
wiring, AI Harness Engineering Framework surfaces, consumer entrypoints, contracts, and
validation/readiness expectations from canonical local files.
_Avoid_: Live dashboard, control plane, runner

**Topology Diagram**:
A static generated SVG view showing how the AI Harness Engineering Framework, consumer
repositories, client surfaces, consumer entrypoints, contract groups, and
validation expectations relate.
_Avoid_: Runtime diagram, Mermaid dependency, live status map

**Consumer Repository**:
A product or application repository governed by a Repository-local AI Harness
Engineering Framework while still owning its implementation, runtime behavior,
tests, and deployment checks.
_Avoid_: Harness repo, template repo

**Structor Self-Harness**:
A Repository-local AI Harness Engineering Framework whose **Consumer Repository** is the
Structor source repository itself. It teaches agents how to contribute to
Structor without changing what AI Harness Engineering Frameworks mean for other
projects.
_Avoid_: Core template, runner, fork

**Contributor Workspace**:
The local workspace used by Structor contributors, containing the Structor source
repository and its sibling **Structor Self-Harness**.
_Avoid_: Generated AI Harness Engineering Framework, consumer project, remote fork

**Contributor Bootstrap**:
The future onboarding flow for Structor contributors. It should become
`npx @structor-dev/cli contribute structor`, may clone local repositories into
the contributor workspace, and must not fork, push, open pull requests, mutate
external services, or become a runner.
_Avoid_: Initializer, setup wizard, runner

**Manual Contributor Setup**:
The clone-first fallback path for Structor contributors who want the
conventional workflow:
`git clone https://github.com/nicolaycamacho/structor.git && cd structor && npm run setup:contributor`.
_Avoid_: Contributor bootstrap, AI Harness Engineering Framework setup, target-repo init

**Consumer Entrypoint**:
A thin file inside a consumer repository that points agents back to the AI
Harness Engineering Framework and records minimal repo-local facts.
_Avoid_: Policy copy, AI Harness Engineering Framework

**Managed Pointer Block**:
A delimited Structor-owned section inside an existing **Consumer Entrypoint**
that points agents to the AI Harness Engineering Framework while preserving surrounding
user content verbatim.
_Avoid_: Rewrite, full merge, policy replacement

**Consumer Repo Scan**:
An optional setup phase that inspects consumer repositories to draft
project-specific harness content from evidence.
_Avoid_: Autofill, migration, runner

**Light Scan**:
A conservative **Consumer Repo Scan** mode that extracts setup facts and obvious
repo signals without drafting broad policy or architecture claims.
_Avoid_: Starter only, deep scan, full analysis

**Deep Scan**:
A more thorough **Consumer Repo Scan** mode that drafts richer project-specific
harness candidates while still producing reviewable drafts, not approved policy.
_Avoid_: Autogeneration, final policy, runner

**LLM-Assisted Deep Scan**:
A **Deep Scan** that uses a frontier coding model such as Codex or Claude to
synthesize candidate harness content from local evidence for later review.
_Avoid_: Autonomous approval, source of truth, unattended generation

**Consumer Scan Draft**:
A reviewable artifact produced from a **Consumer Repo Scan** that captures
evidence-backed candidate facts before they become canonical harness content.
_Avoid_: Generated policy, final docs, approved content

**Scan Confidence**:
A confidence label on each scan candidate that communicates how strongly local
evidence supports it before human review.
_Avoid_: Truth score, approval status, quality grade

**Scan Review Flow**:
The post-scan review path where users inspect and approve candidate harness
content after setup, outside the time-sensitive **Setup Wizard** path.
_Avoid_: Wizard review, automatic promotion, inline doc approval

**Scan Promotion**:
The controlled step that moves high-confidence, low-risk scan candidates into
canonical starter harness docs while leaving risky or uncertain candidates in the
**Consumer Scan Draft**.
_Avoid_: Auto-approval, overwrite, finalization

**Starter Harness Content**:
Generic AI Harness Engineering Framework guidance that is useful before project-specific
facts, contracts, and conventions have been reviewed.
_Avoid_: Complete project policy, discovered contracts

**Doctor**:
A diagnostic and repair flow that checks an existing Structor workspace for
drift, stale pointers, unsafe output paths, and missing AI Harness Engineering Framework
wiring.
_Avoid_: Wizard, initializer, runner

## Example Dialogue

Developer: "Should the wizard generate contracts from my app?"

Maintainer: "The setup wizard can offer a consumer repo scan that drafts
contract candidates, but the initializer should stay deterministic and render
only reviewed configuration and templates."

Developer: "Should I review all scan output during setup?"

Maintainer: "No. Init should stay quick: apply safe setup facts, save a
consumer scan draft, and leave deeper review for a post-init refinement flow."
