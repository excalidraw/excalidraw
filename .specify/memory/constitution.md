<!--
SYNC IMPACT REPORT
- Version change: 1.0.0 -> 1.1.0
- Modified principles:
  - Security-First (clarified for mission-critical, added supply-chain and auditability)
  - Single-Container Deployability (clarified for air-gapped/mission-critical teams)
  - Quality & Test-First (emphasized non-negotiable, clarified CI gates)
  - Performance & Efficiency (explicit measurable goals, CI enforcement)
  - User Experience & Accessibility (clarified for reliability, inclusivity, and mission-critical scenarios)
  - Observability & Versioning (traceability, changelogs, migration notes)
- Added sections:
  - None (all major sections present)
- Removed sections:
  - None
- Templates requiring updates:
  - .specify/templates/plan-template.md: ⚠ pending — update "Constitution Check" to require security, single-container, and test-first gates
  - .specify/templates/spec-template.md: ⚠ pending — add mandatory fields for security, performance, packaging
  - .specify/templates/tasks-template.md: ⚠ pending — ensure task categories reflect new/clarified principles
  - .specify/templates/commands/*.md: ⚠ pending — ensure commands reference generic agent and single-container workflows
- Other runtime docs to review:
  - README.md: ⚠ pending — clarify deployment, security, and containerization instructions
  - dev-docs/**: ⚠ pending — add CI, security scanning, release, and compliance guidance
- Deferred items / TODOs:
  - TODO(RATIFICATION_DATE): if a prior ratification date exists, replace 2025-11-06 with the original adoption date. Current ratification set to 2025-11-06 because this is the first formalization.
-->

# Excalidraw Constitution

## Core Principles

### Security-First

All design, development, and operational decisions MUST prioritize security. This is non-negotiable for services that support mission-critical collaboration.

Rules:

- The team MUST maintain a minimal, explicit threat model for Excalidraw (client, server, integrations, users) and review it at least annually or when major features are added.
- Secrets and credentials MUST never be checked into source control. Secrets MUST be supplied at runtime via environment variables or a secrets provider.
- All dependencies MUST be scanned automatically for vulnerabilities during CI. Known-critical vulnerabilities MUST be remediated or mitigated before release.
- Transport-layer encryption (TLS) MUST be enforced for all external and internal network traffic. Sensitive data at rest SHOULD be encrypted where practical.
- Authentication and Authorization MUST follow least-privilege principles. Sensitive operations MUST be auditable.
- Supply-chain protections (signed releases, pinned dependencies, reproducible builds) MUST be applied to any production build pipeline.

Rationale: A collaborative whiteboard is a high-surface-area target. Explicit, automated security measures reduce risk and enable trust for teams doing mission-critical work.

### Single-Container Deployability

Excalidraw MUST be packageable and runnable as a single container image for straightforward packaging and predictable deployments.

Rules:

- The default production deliverable MUST be a single OCI-compliant container image that contains the application, its static assets, and the runtime required to run Excalidraw in typical setups.
- Configuration MUST be provided via environment variables, configuration files mounted at runtime, or standard discovery endpoints — not hard-coded.
- The image MUST expose health (liveness/readiness) endpoints and support graceful shutdown (SIGTERM followed by a configurable timeout).
- Where persistent storage or external services are required (optional), interfaces MUST be pluggable so a single-container deploy remains the simplest path for small teams.
- Image size budgets and multi-stage builds SHOULD be used to keep images minimal and secure (no embedded credentials, no build-only artifacts in final image). Images MUST be scanned for vulnerabilities before release.

Rationale: Single-container packaging simplifies distribution, offline/air-gapped deployments, and operational consistency while keeping complexity optional for larger deployments.

### Quality & Test-First (NON-NEGOTIABLE)

Quality gates are mandatory. Tests are not optional documentation — they are the primary contract for behavior.

Rules:

- New features and bug fixes MUST include automated tests: unit tests for logic, integration tests for interactions, and end-to-end tests for critical user flows where applicable.
- Code changes MUST pass CI gates that include: type-checking, linting, unit tests, integration tests (where practical), and security scans.
- A Test-First mindset is REQUIRED for new public contracts and APIs: write failing tests that define behavior, implement until tests pass, then refactor.
- Minimum code quality thresholds (e.g., coverage goals for critical modules) SHOULD be defined per-component in `spec` documents; CI MUST enforce them where feasible.
- Static typing (TypeScript strict mode) and linting configs MUST be enabled for all TypeScript packages.

Rationale: Mission-critical teams require predictable, auditable behavior. Test-first discipline prevents regressions and improves maintainability.

### Performance & Efficiency

Performance goals are explicit and measurable.

Rules:

- Performance targets (latency, memory usage, bundle size, and startup time) MUST be defined for user-facing features and included in PRs that affect those areas.
- Developers MUST add benchmarks or load tests for features that touch rendering, collaboration, or network paths used in real-time scenarios.
- Bundle size budgets and critical-path performance budgets MUST be established; CI SHOULD enforce basic bundling checks (e.g., warn/fail when budgets are exceeded).
- Profiling and performance telemetry MUST be part of the observability stack for production releases so regressions can be diagnosed quickly.

Rationale: Excalidraw is interactive; poor performance degrades user experience more than missing features. Measurable goals help prioritize improvements.

### User Experience & Accessibility

Design choices MUST favor clarity, reliability, and inclusivity.

Rules:

- User interactions MUST be predictable and robust under intermittent connectivity and merge/conflict scenarios (clear conflict resolution UX).
- Accessibility (WCAG 2.1 AA baseline) MUST be considered for all UI changes. Keyboard navigation, screen-reader support, and sufficient contrast are required for primary flows.
- Onboarding and help within the app MUST make collaboration workflows discoverable. Critical UX flows (sharing, saving, export) MUST have tests covering them.
- Telemetry or feedback mechanisms that capture UX regressions SHOULD be implemented with user privacy and opt-in/consent where needed.

Rationale: Teams rely on clear, accessible interfaces for mission-critical work; UX regressions can break workflows and reduce trust.

### Observability & Versioning

Releases MUST be observable and traceable; versioning MUST be predictable and compatible.

Rules:

- Releases MUST include structured logs, metrics, and traces sufficient to diagnose production incidents. Logs MUST be structured (JSON or similar) and contain correlation IDs for request flows.
- Semantic versioning (MAJOR.MINOR.PATCH) MUST be used for public packages and the main application release. MAJOR bumps denote breaking changes to public contracts or governance.
- Release artifacts MUST include a changelog entry and migration notes for breaking changes.
- Backward compatibility policies MUST be documented for stored document formats and network protocols; migration tooling or fallbacks MUST be provided when breaking changes are unavoidable.

Rationale: Observability shortens incident resolution time. Clear versioning and release notes reduce upgrade risk for teams.

## Additional Constraints

### Packaging, Runtime, and Compliance Requirements

- Runtime baseline for official images: Node >= 18 (as per repository engines) and minimal supporting OS image (e.g., distroless or slim base).
- Builds MUST be reproducible and deterministic where practical; build metadata (commit, build date, artifact checksum) MUST be embedded in release artifacts.
- Container images and release artifacts MUST be scanned for vulnerabilities and signed prior to publishing.
- Licensing and contributor guidelines in `LICENSE` and `CONTRIBUTING.md` MUST be kept current; legal or compliance concerns MUST be documented in the repo.

## Development Workflow

### Review & Quality Gates

- All changes to `main`/`master` or release branches MUST go through PRs with:
  - Passing CI (typecheck, lint, tests, security scans).
  - At least one code review by a domain owner; at least two approvals for major or security-impacting changes.
  - A linked specification or issue describing the change, with acceptance criteria.
- Major changes (new principles, contract changes, breaking API changes) MUST include a migration plan and test strategy.

### Release & Maintenance

- Versioning policy:
  - PATCH: Non-behavioral improvements, typo fixes, test or doc-only changes.
  - MINOR: New features that are backward compatible.
  - MAJOR: Backwards incompatible changes to public APIs, document formats, or governance.
- Releases SHOULD be automated from CI with associated release notes generated from PRs and CHANGELOG entries.
- Regular maintenance tasks (dependency upgrades, security patching) MUST be scheduled and executed with tests.

## Governance

[GOVERNANCE_RULES]

- The constitution supersedes ad-hoc practice. Deviations MUST be documented and approved.
- Amendments:
  - Proposals to amend the constitution MUST be made as a PR that edits `.specify/memory/constitution.md` and references the reason, impact, and migration steps.
  - An amendment PR MUST include a recommended version bump (MAJOR/MINOR/PATCH) with rationale following the semantic rules in this document.
  - Approval requires at least two maintainers' approvals or a majority of active maintainers where the team is larger; CI must pass for the PR to be merged.
  - After merge, the `Last Amended` date MUST be updated to the merge date; `Constitution Version` MUST be updated per the chosen bump.
- Compliance reviews:
  - The project MUST run a governance/compliance review at least annually to ensure the constitution and templates remain aligned with project needs.
  - Any mandatory checks referenced by this constitution (CI gates, scans) SHOULD be implemented in the repository's CI/CD; where that is not yet possible, a timeline and owner MUST be recorded in a follow-up issue.

**Version**: 1.1.0 | **Ratified**: 2025-11-06 | **Last Amended**: 2025-11-06
