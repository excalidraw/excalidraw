# Research Summary: Upgrade NodeJS to LTS v24

## Decision

Upgrade all project references, documentation, CI/CD, and Docker images to NodeJS v24 (latest secure LTS).

## Rationale

NodeJS v24 provides the latest security patches, performance improvements, and long-term support. Upgrading ensures compatibility with ecosystem tools and reduces vulnerability risk.

## Alternatives Considered

- Remain on NodeJS v18 or v20: Rejected due to end-of-life and lack of latest security fixes.
- Upgrade only CI/CD or Docker: Rejected due to risk of environment drift and inconsistent developer experience.
- Upgrade to non-LTS version: Rejected due to stability and support concerns.

All clarifications resolved. No open unknowns remain for this feature.
