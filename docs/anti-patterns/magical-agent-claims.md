# Magical Agent Claims

Anti-pattern: claiming Structor automatically understands a project, migrates
guidance, validates architectural truth, or makes generated harnesses ready for
real work without review.

Structor can complete deterministic setup while still requiring project-
specific guidance population:

```text
setup_complete: true
guidance_ready: false
```

Keep claims grounded in current behavior. Interpretive repo understanding
belongs in the reviewed post-init population workflow, not in deterministic
setup.

See [populating a harness](../guides/populating-a-harness.md).
