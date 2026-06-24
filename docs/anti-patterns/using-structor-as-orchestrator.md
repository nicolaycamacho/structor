# Using Structor As An Orchestrator

Anti-pattern: treating Structor as the system that runs agents, opens pull
requests, shepherds CI, auto-repairs code, polls sessions, or manages work over
time.

Structor is a generator and guidance layer. It creates local files and
validators. It does not run agent sessions, coordinate workflows, or mutate
external systems.

Keep orchestration behavior out of active Structor templates and generated
harness policy. If a project needs orchestration, build it as a separate runner
or control plane with its own contracts.

See [harness vs runner](../concepts/harness-vs-runner.md).
