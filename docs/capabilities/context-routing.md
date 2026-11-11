# Context Routing

Structor-generated harnesses route agent clients from thin entrypoints into
canonical policy files.

Typical routing:

```text
consumer repo AGENTS.md or CLAUDE.md
  -> generated harness AGENTS.md or CLAUDE.md
  -> ai/HUB.md
  -> task, contract, review, and quality guidance
```

Consumer entrypoints may include minimal repo-local facts such as purpose and
validation commands. They should not copy canonical harness policy.

Model overlays stay thin. Shared guidance belongs in `ai/*`; client-specific
entrypoints should point there instead of becoming independent policy sources.

The hub offers primary routes for implementation, diagnosis, review and
security-sensitive tasks, with additional review and contract guidance in the
expanded profile. Load the smallest relevant set. Missing guidance triggers a
bounded check of the entrypoint, hub and repository conventions before asking
the task owner about the unresolved boundary.

`node scripts/check-knowledge-manifest.mjs` validates the internal guidance graph
in both profiles and runs through generated governance. Consumer pointer checks
remain separate: they identify the expected harness root using the shared
resolver; internal navigation resolves within that root.

The generated `ai/knowledge-manifest.json` declares:

- `routingSurfaces`: navigation file, `base` (`root` or `source`), and exact
  heading names in `sections`. Only inline code paths and Markdown link targets
  in these sections form edges. Fenced examples, external URLs, anchor-only
  links and arbitrary prose do not. This is a bounded navigation reader, not a
  general Markdown parser.
- `canonicalDocs`: required targets, including direct `linkedFrom` edges.
  Every required target must be reachable from each enabled root entrypoint
  and each enabled expanded model overlay.
- `dynamicReferences`: exact `source`, exact `reference`, and a nonempty
  `reason`. Only a single filename wildcard with an `.md`, `.json` or `.html`
  suffix in an existing safe directory is accepted. Directory wildcards,
  parent traversal, unused exceptions and reasonless exceptions fail.
  An exemption never creates a reachability edge.

Root-based references resolve from the harness root, including `./ai/...`.
Source-based references resolve from the navigation file's directory. A trailing
slash resolves to that directory's `README.md`; file anchors select the same
file. There is no basename search. Missing files, disabled-client targets,
absolute paths, traversal outside the root and symlink escapes fail. Focused
manifests contain only generated guidance; expanded output adds optional routes.

These checks are static reachability evidence. They do not prove model document
selection or behavior, enforce tool access, or require reading every reachable
document. Existing generated projects are preserved until explicit regeneration
after review.
