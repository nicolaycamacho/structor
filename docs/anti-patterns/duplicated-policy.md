# Duplicated Policy

Anti-pattern: copying the same canonical policy into root entrypoints, model
overlays, consumer pointer files, and generated harness docs.

Duplicated policy drifts. Agents may follow whichever copy they see first, and
validators can no longer prove where the canonical rule lives.

Keep canonical shared policy in generated harness `ai/*`. Keep model overlays
and consumer entrypoints thin, with links or routing instructions back to the
harness.

See [context routing](../capabilities/context-routing.md).
