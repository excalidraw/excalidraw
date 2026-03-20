# Schema Migration Guidelines

## Contract

Each migration entry must declare:
- `version`: integer schema version (monotonic)
- `title`: short label
- `description`: required plain-language explanation of what changed
- `scope`: one or more scopes (`scene`, `library`, `clipboard`, `api`)
- `apply`: pure element transform

## Versioning Rules

- Use integer versions only (`2`, `3`, `4`, ...).
- `SCHEMA_VERSIONS.latest` must match the latest migration version.
- Add a new migration when behavior changes.

## Scope Rules

- Prefer explicit scopes.
- Use `ALL_SCOPES` only when the same transform is required for every boundary.
- If a migration was missing a scope but transform is unchanged, widening scope is allowed.

## Field Stability

Migrations must only rely on stable, persisted schema fields.
Do not read or write temporary/PR-only fields.
