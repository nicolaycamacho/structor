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

**Consumer Repo Scan**:
An optional setup phase that inspects consumer repositories to draft
project-specific harness content from evidence.
_Avoid_: Autofill, migration, runner

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
