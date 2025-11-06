# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link] **Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

**Language/Version**: TypeScript (strict mode), Node.js >= 18, React 18+  
**Primary Dependencies**: React, TypeScript, Vite, Sentry, Docusaurus (docs), Crowdin (i18n)  
**Storage**: Local-first (browser), optional external services (pluggable), persistent storage via external interfaces  
**Testing**: Vitest, Jest, Playwright (E2E), CI: typecheck, lint, unit/integration/security scans  
**Target Platform**: Linux server/container, browser (PWA), air-gapped/single-container deploys  
**Project Type**: Single-container web app (default), supports modular packaging  
**Performance Goals**: Fast startup, low latency, minimal bundle size, responsive real-time collaboration  
**Constraints**: <200ms p95 latency, <100MB memory for container, offline-capable, WCAG 2.1 AA accessibility  
**Scale/Scope**: 10k+ concurrent users, large diagrams, multi-team collaboration

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Security: Threat model documented, secrets managed via env/secret provider, CI vulnerability scan required
- Single-Container Deployability: Plan must specify how feature/package will work in default container image, config via env/files, health endpoints
- Test-First: Automated tests required for new features/bugfixes, CI gates for typecheck/lint/unit/integration/security
- Performance: Explicit perf goals and budgets for user-facing features, CI enforcement if practical
- UX/Accessibility: Must meet WCAG 2.1 AA for primary flows, robust under conflict/merge scenarios
- Observability/Versioning: Structured logs, changelog, migration notes for breaking changes

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
excalidraw-app/         # Main application (React, TypeScript)
packages/               # Shared libraries: element, excalidraw, math, utils, common
examples/               # Example integrations (Next.js, browser script)
scripts/                # Build, release, CI/CD scripts
dev-docs/               # Documentation site (Docusaurus)
public/                 # Static assets
```

**Structure Decision**: [Document the selected structure and reference the real directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
