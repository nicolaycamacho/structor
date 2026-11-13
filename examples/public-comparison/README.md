# Synthetic public comparison

This example is a manual pilot for [#147](https://github.com/nicolaycamacho/structor/issues/147),
under [#148](https://github.com/nicolaycamacho/structor/issues/148).
It contains no private source or real customer material.

- [Preregistered protocol](PROTOCOL.md): tasks, conditions, time bound and rubric.
- [Observed results](RESULTS.md): measured outcomes, limitations and evidence links.
- [Seed repositories](seed/): a frontend library and its API/schema owner.
- [Population source map](population-context.md): the assisted context addition.
- [Evaluator checks](evaluator/acceptance.mjs): kept outside attempt contexts.

To inspect a fresh starting state, run from this directory:

```sh
node prepare.mjs /tmp/example-comparison
cd /tmp/example-comparison/example-frontend
npm test
cd ../example-api
npm test
```

Use a new destination each time. Preparation initializes two local Git repos
with fixed synthetic author/date metadata; it never runs an agent. The existing
smoke checks pass before either task; evaluator task checks fail before work.
No dependencies, service, browser or network are needed for the example.
The manual attempts are separate from Structor's deterministic CI. Do not give
attempt agents this directory: copy only the materialized seed workspace and
the condition-specific guidance described in the protocol.
