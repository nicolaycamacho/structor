# Contracts

Contracts describe important project boundaries in a generated harness. They
help agents understand interfaces, ownership, validation expectations, and
review requirements before changing code.

Structor ships template structure and validators for contract manifests. The
project still owns the actual contract content after harness population.

Use contracts for stable boundaries, not for transient task notes. If a
contract claim cannot be verified against the current repository, keep it out
of canonical harness policy until it has been reviewed.
