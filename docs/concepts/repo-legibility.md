# Repo Legibility

Repo legibility means a human or agent can quickly answer the basic questions
needed to work safely:

- What is this repository for?
- Which files contain canonical guidance?
- Which contracts and boundaries matter?
- Which commands validate local changes?
- Which task shapes are expected?
- Which generated files should stay thin?

Structor improves repo legibility by generating a predictable harness layout
and local validators. It does not infer complete project conventions,
architecture, contracts, or validation expectations from consumer repo code
during deterministic setup.

Repo-specific details belong in the post-init harness population and review
step. See [populating a harness](../guides/populating-a-harness.md).
