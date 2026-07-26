# Goal

Populate the generated Structor harness from the current consumer workspace.

This is a one-time post-init setup pass. The objective is to transform the
freshly generated generic Structor harness into a repository-specific AI Harness
Engineering Framework grounded entirely in the actual consumer repository or
repositories.

Before populating the harness, verify that the generated Structor output is healthy, internally consistent, and functioning as intended.

# Scope

Inspect the generated Structor harness and all configured consumer repositories.

Use repository evidence to populate, update, or refine harness content wherever appropriate.

This process includes:

- Bootstrap verification
- Consumer repository verification
- Structor health validation
- Product context generation
- Architecture context generation
- Consumer repository analysis
- Multi-repository relationship mapping
- Contract discovery and contract matrix generation
- Validation command discovery
- Ownership and routing documentation
- Preserved guidance migration
- Navigation and index generation
- Review and risk documentation
- Manual follow-up identification

Guidance migration is only one part of the overall harness population process.

# Context

The Structor harness has already been generated.

The harness currently contains generic starter content, placeholders, examples, and routing documents.

Your responsibility is to inspect the actual repositories and replace generic content with repository-specific context wherever sufficient evidence exists.

The generated harness should remain deterministic, factual, evidence-based, and consistent with Structor principles.

Do not invent information.

# Bootstrap Verification

Before populating the harness, verify that the generated Structor harness is healthy and internally consistent.

Use `scripts/generated-harness-contract.mjs` and the actual generated filesystem as the authority for required generated paths.

Confirm that required generated files and directories exist.

Do not report optional root-level folders as missing unless they are required by the generated harness contract.

Do not create missing folders merely because this prompt mentions a conceptual surface.

Report only actual contract violations, broken references, invalid configured consumer repo paths, empty required files, or inconsistent generated artifacts.

Identify:

- Missing generated files
- Missing generated folders
- Broken references
- Broken links
- Incorrect paths
- Empty required files
- Unexpected generation artifacts
- Generation inconsistencies
- Placeholder content that appears incomplete, generic, or intentionally awaiting population

Do not silently work around bootstrap issues.

Document all discovered bootstrap problems.

# Consumer Repository Verification

Before population, verify that configured consumer repositories are accessible.

Confirm:

- Configured paths exist
- Repositories are readable
- Repositories contain expected source material
- Repository references in `harness.config.json` resolve correctly

Report inaccessible repositories.

Do not populate context for repositories that cannot be inspected.

# Structor Health Check

Validate that the generated harness behaves as intended.

Confirm:

- `AGENTS.md` routes correctly
- `CLAUDE.md` routes correctly
- The generated hub/navigation artifact is reachable
- Context documentation is reachable
- Contract documentation is reachable
- Validation documentation is reachable
- Review documentation is reachable when present
- Repository references resolve correctly
- Cross-document navigation works
- Internal references remain valid
- No duplicate governance sources exist
- No conflicting guidance sources exist
- No required documents are missing
- No required generated placeholder remains unclassified

Report all inconsistencies.

Do not modify Structor templates.

Do not regenerate the harness.

Do not attempt to redesign Structor.

Validate the generated output as it currently exists.

# Required Inspection

Before making changes, inspect:

## Structor Files

First inspect the generated harness contract and the actual generated harness tree.

Use `scripts/generated-harness-contract.mjs` and the filesystem as the source of truth for required generated paths.

Inspect all generated files and directories defined by the generated harness contract.

Do not assume any particular directory structure beyond what is present in the generated harness.

Examples of generated surfaces may include:

- Hub/navigation artifacts
- Product context artifacts
- Repository context artifacts
- Contract artifacts
- Skill artifacts
- Overlay artifacts
- Review artifacts
- Validation artifacts
- Preserved guidance artifacts
- Workspace artifacts
- Generated examples
- Generated TODO files

Examples are illustrative only.

Only inspect optional root-level surfaces if they exist.

Optional surfaces may include:

- `docs/**`
- `contracts/**`
- `.ai/**`
- `agents/**`
- `skills/**`
- `overlays/**`
- `reviews/**`
- `contexts/**`
- `validation/**`
- ADRs

Do not treat absent optional root-level folders as bootstrap failures.

Do not create non-canonical root-level harness folders unless the generated contract explicitly expects them.

## Consumer Repository Evidence

Inspect relevant sources including:

- README files
- `package.json`
- `pyproject.toml`
- `Cargo.toml`
- Dockerfiles
- Docker Compose files
- Source tree structure
- Application entrypoints
- CI configuration
- Scripts
- Tests
- Environment examples
- API definitions
- OpenAPI specifications
- Database schemas
- Migration files
- Architecture documentation
- Deployment documentation
- Contribution guides
- Issue templates
- Engineering guidance

Determine repository relationships from evidence.

Do not assume a single-repository workspace.

# Harness Population Surface

Inspect the generated harness tree and identify every placeholder, generic document, example file, starter document, TODO item, or partially populated artifact.

Populate all applicable harness files that can be improved through repository evidence.

Required artifacts are the generated harness artifacts corresponding to:

- Hub/navigation
- Product context
- Repository context
- Validation context
- Contract matrix, when the selected profile includes one

Resolve their actual paths from the generated harness contract and filesystem.

Optional artifacts should only be populated when sufficient repository evidence exists.

Examples of optional artifacts may include:

- Architecture context
- Review context
- Security context
- Risk documentation
- Glossary documentation
- Ownership maps
- Routing documentation
- Contract records
- Preserved guidance notes
- Model overlays
- Agent overlays
- Codex guidance
- Claude guidance
- Command registries
- ADR indexes
- Manual review notes

Do not assume this list is exhaustive.

The generated harness tree is the source of truth for what may be populated.

For every generated file encountered, determine one of:

- Populate
- Update
- Leave generic because evidence is insufficient
- Leave placeholder and create manual-review note
- Mark as intentionally unchanged

Document decisions in the final report.

# Product Context Requirements

Generate or update the generated product context artifact using repository evidence.

Include:

- Product purpose
- Intended users
- Primary workflows
- Domain terminology
- Core capabilities
- Important constraints
- Major dependencies
- Non-goals
- Current maturity level
- Known risks

Do not write marketing copy.

Write operational context useful for engineers and AI agents.

# Hub Requirements

Generate or update the generated hub/navigation artifact as the primary navigation document.

It should route users and agents to:

- Product context
- Architecture context
- Validation guidance
- Available contract documentation
- Available ownership documentation
- Available review guidance
- Preserved guidance notes
- Risk documentation
- Manual follow-up items

The hub should function as a navigation layer.

It should not become a dumping ground for content.

# Consumer Repository Analysis

Identify:

- All consumer repositories
- Repository responsibilities
- Repository ownership boundaries
- Repository relationships
- Shared dependencies
- Shared contracts
- Cross-repository workflows

If multiple repositories exist:

- Document each repository individually
- Document interactions between repositories
- Document dependency direction where possible

# Architecture Context Requirements

Document:

- High-level architecture
- Major subsystems
- Key integration points
- Data flows
- Service boundaries
- External dependencies
- Architectural constraints

Only use repository evidence.

Do not invent architecture.

# Ownership And Routing Requirements

Document:

- Repository ownership boundaries
- Important areas of responsibility
- Sensitive locations
- Areas requiring special care
- Natural routing paths for future work

The goal is to improve human and agent navigation.

# Validation Requirements

Discover and document:

- Build commands
- Test commands
- Lint commands
- Type-check commands
- Validation scripts
- Contract validation commands
- CI validation steps

Verify commands where possible.

Never invent commands.

# Contract Matrix Requirements

Contracts may be inferred from code, configuration, interfaces, schemas, imports, API definitions, generated artifacts, or validation rules.

Only document contracts that have observable repository evidence.

Do not create speculative contracts.

Examples include:

- Frontend ↔ Backend
- Application ↔ Database
- Application ↔ External API
- Service ↔ Service
- Package ↔ Package
- CLI ↔ Generated Output
- Config Schema ↔ Consumers
- Documentation ↔ Validation Scripts

For each contract include:

- Producer
- Consumer
- Description
- Source locations
- Validation method
- Failure impact
- Confidence level

If a contract cannot be verified, explicitly note uncertainty.

Do not invent contracts.

# Preserved Guidance Migration

Treat existing guidance as preserved guidance.

Examples include:

- `AGENTS.md`
- `CLAUDE.md`
- `.claude/**`
- `.cursor/**`
- `docs/**`
- Internal engineering guidance

Preserved guidance is source material.

It is not automatically authoritative.

Classify guidance as:

- Repository knowledge
- Architecture context
- Validation guidance
- Workflow convention
- Ownership information
- Duplicate Structor policy
- Obsolete guidance
- Manual review required

Only migrate durable, repository-specific knowledge.

Do not blindly copy files.

Do not duplicate Structor policy.

# Security And Trust Boundary Documentation

Document repository-specific security and trust boundaries when supported by evidence.

Examples:

- Authentication systems
- Authorization boundaries
- Secrets handling
- External integrations
- Privileged workflows
- Operational constraints

Do not perform security audits.

Document only what is supported by repository evidence.

# Risk Documentation

Document meaningful engineering risks discovered during inspection.

Examples:

- Missing validation
- Unclear ownership
- Fragile integrations
- Unverified contracts
- Architectural ambiguity
- Documentation gaps

Avoid speculation.

# ADR Handling

Inspect existing ADRs if present.

Document:

- Existing architectural decisions
- Missing context
- Relevant references

Do not create fictional ADRs.

Do not rewrite ADR history.

# Boundaries

Do not modify application source code.

Do not modify business logic.

Do not modify routes.

Do not modify components.

Do not modify styling.

Do not modify deployment behavior.

Do not modify package dependencies.

Do not modify runtime configuration.

Do not invent:

- Architecture
- Product claims
- Ownership boundaries
- Validation commands
- Contracts
- Workflows
- Deployment procedures

Do not duplicate canonical Structor policy.

Do not turn the harness into application documentation.

Do not introduce orchestration systems, autonomous workflows, runtime agents, CI behavior, or deployment logic.

# Validation

Before completion:

- Verify referenced files exist
- Verify referenced paths exist
- Verify referenced commands exist
- Verify scripts exist
- Verify repository references exist
- Verify harness navigation remains valid
- Verify internal routing remains valid

Run available validation commands when reasonably scoped:

- Build
- Lint
- Type-check
- Tests

If validation cannot be executed, explain why.

# Final Report

Provide a concise report containing:

## Bootstrap Verification Results

- Missing files
- Missing folders
- Broken references
- Generation inconsistencies
- Required follow-up items

## Consumer Repository Verification Results

- Configured repositories
- Accessible repositories
- Inaccessible repositories
- Path or configuration issues

## Structor Health Check Results

- Routing validation
- Navigation validation
- Reference validation
- Governance validation

## Repositories Inspected

List all analyzed repositories.

## Harness Files Updated

List modified harness files.

## Product Context Added

Summarize major additions.

## Architecture Context Added

Summarize major additions.

## Contract Entries Added

Summarize discovered contracts.

## Guidance Migrated

Summarize preserved guidance that was incorporated.

## Guidance Ignored

Summarize intentionally excluded guidance.

## Validation Performed

List commands executed.

## Validation Failures

List failures and skipped checks.

## Manual Follow-Up Items

List unresolved issues requiring human review.

# Definition Of Done

- Bootstrap verification has been completed.
- Consumer repository verification has been completed.
- Structor health validation has been completed.
- The generated Structor harness has been populated using repository evidence.
- Generic starter content has been replaced where sufficient evidence exists.
- The generated product context accurately reflects the actual product.
- The generated hub/navigation artifact acts as a useful routing layer.
- Consumer repositories are represented explicitly.
- Multi-repository relationships are documented when applicable.
- Architecture context has been populated where evidence exists.
- Ownership and routing documentation has been populated where evidence exists.
- Validation guidance has been populated where evidence exists.
- Contract documentation and contract matrixes have been updated from repository evidence.
- Preserved guidance has been analyzed and migrated where appropriate.
- Duplicate governance has been avoided.
- Root `AGENTS.md` and `CLAUDE.md` remain thin entrypoints.
- Commands, paths, scripts, and references have been verified.
- Harness routing and navigation remain valid.
- Validation results have been documented.
- No required generated placeholder remains unclassified.
- No unrelated application code has been changed.
- The application builds successfully where a build command exists.
- Linting passes where linting is configured.
