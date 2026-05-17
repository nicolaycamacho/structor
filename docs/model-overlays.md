# Model Overlays

Model overlays are thin compatibility layers for specific model or agent
systems.

Canonical policy belongs in generated `ai/*` docs. Overlay files should only:

- route agents into canonical docs
- describe model-specific tool usage differences
- avoid duplicating policy
- stay short enough to review manually

The template supports OpenAI/Codex and Anthropic/Claude overlay files by
default.
