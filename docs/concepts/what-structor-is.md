# What Structor Is

Structor is a local Harness Engineering Framework. It generates a
Repository-local AI Harness Engineering Framework for one workspace: a plain
file policy layer that helps agent clients share context routing, contracts,
task templates, review guidance, and validation expectations.

Structor is independently developed as a generalized, organization-agnostic
tool. Public templates, validators, examples, and documentation should avoid
proprietary implementation details, organization-specific workflows,
confidential architecture, secrets, and client- or employer-specific artifacts.

## What It Creates

`structor init` creates a sibling generated harness repo beside your consumer
repos. That generated harness owns canonical `ai/*` policy, thin model
entrypoints, contracts, task templates, review guidance, and local validation
scripts.

Consumer repos keep their implementation code. Optional consumer root
entrypoints route agents back to the generated harness.

## What It Does Not Do

Structor does not run agents, coordinate sessions, open pull requests, host
services, call LLM APIs, install packages, collect telemetry, mutate external
systems, or manage deployments.

For the boundary in detail, see [harness vs runner](harness-vs-runner.md).
