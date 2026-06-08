# Goal

Migrate useful repo-specific knowledge into the generated Structor harness.

# Boundaries

Do not blindly copy preserved guidance.
Do not duplicate canonical Structor policy.
Do not move consumer application logic into the harness.
Do not invent architecture, scripts, validation commands, contracts, or ownership
boundaries unsupported by repo evidence.
Do not modify application source code unless explicitly required to verify
documentation paths.
Do not make unrelated changes to components, routes, styling, business logic, or
configuration.

# Definition of done

- Relevant repo-specific guidance has been migrated into appropriate harness docs.
- Obsolete or duplicated guidance has been left out.
- Root AGENTS.md and CLAUDE.md remain thin entrypoints.
- Commands, paths, and file references have been checked against the actual repo.
- The app builds successfully.
- There are no linting errors.
