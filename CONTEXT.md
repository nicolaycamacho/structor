# Structor

Structor is a toolkit for creating repository-local AI engineering harnesses for
consumer repositories. This glossary names the core concepts so setup,
generation, and repo-inspection work stay distinct.

## Language

**Setup Wizard**:
An interactive onboarding flow that gathers project facts, prepares harness
configuration, previews planned writes, and guides the user through generation.
_Avoid_: Installer, runner, initializer

**Initializer**:
The deterministic renderer that turns harness configuration and templates into a
generated harness and optional consumer entrypoints.
_Avoid_: Wizard, scanner, runner

**Generated Harness**:
The repository produced by Structor that owns AI guidance, contracts, review
templates, validation scripts, and routing policy for one project workspace.
_Avoid_: Template repo, consumer repo, runner

**Consumer Repository**:
A product or application repository governed by a generated harness while still
owning its implementation, runtime behavior, tests, and deployment checks.
_Avoid_: Harness repo, template repo

**Consumer Entrypoint**:
A thin file inside a consumer repository that points agents back to the generated
harness and records minimal repo-local facts.
_Avoid_: Policy copy, generated harness

**Managed Pointer Block**:
A delimited Structor-owned section inside an existing **Consumer Entrypoint**
that points agents to the generated harness while preserving surrounding user
content verbatim.
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
Generic generated guidance that is useful before project-specific facts,
contracts, and conventions have been reviewed.
_Avoid_: Complete project policy, discovered contracts

**Doctor**:
A diagnostic and repair flow that checks an existing Structor workspace for
drift, stale pointers, unsafe output paths, and missing generated harness
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
