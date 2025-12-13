<!--
SYNC IMPACT REPORT
==================
Version Change: 1.0.0 → 1.1.0
Constitution Type: MINOR (new principle added)

Modified/Added Principles:
- NEW: V. Specification-Implementation Synchronization (NON-NEGOTIABLE)

Rationale for Version Bump:
- MINOR: New principle added requiring spec updates before implementation changes
- Adds material governance requirement without breaking existing principles
- Expands development workflow with backward-compatible constraint

Added Sections:
- New Core Principle V on spec-implementation alignment

Templates Requiring Updates:
✅ plan-template.md - Add spec update step before implementation phase
✅ tasks-template.md - Add spec synchronization task type
⚠ spec-template.md - Add "Implementation Changes" tracking section

Follow-up Actions:
- Update plan-template.md to include spec verification step
- Add spec-sync validation to PR checklist
- Document spec amendment procedure in contributing guidelines
-->

<!--
PREVIOUS SYNC IMPACT REPORT (v1.0.0)
=====================================
Version Change: Initial → 1.0.0
Constitution Type: MINOR (initial constitution creation)

Modified/Added Principles:
- NEW: I. Code Quality & Type Safety
- NEW: II. Performance First
- NEW: III. User Experience Consistency
- NEW: IV. Test-Driven Development (NON-NEGOTIABLE)

Added Sections:
- Core Principles (4 principles)
- Technical Standards
- Development Workflow
- Governance

Templates Requiring Updates:
✅ plan-template.md - Constitution Check section aligns with principles
✅ spec-template.md - User scenarios align with UX consistency principle
✅ tasks-template.md - Test-first workflow matches TDD principle
-->

# Excalidraw Constitution

## Core Principles

### I. Code Quality & Type Safety

**ALL code MUST be written in TypeScript** with strict type checking enabled. Code quality is non-negotiable:

- TypeScript MUST be used for all new code
- Prefer immutable data structures (`const`, `readonly`)
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Implementations MUST avoid unnecessary allocations
- Code MUST follow naming conventions: PascalCase (components, interfaces, types), camelCase (variables, functions, methods), ALL_CAPS (constants)
- Components MUST remain small, focused, and independently testable

**Rationale**: Type safety prevents runtime errors, improves maintainability, and enables better tooling. Memory-efficient implementations ensure smooth performance on all devices.

### II. Performance First

### IV. Test-Driven Development (NON-NEGOTIABLE)

**Tests MUST be written before implementation**:

- Run `yarn test:app` after modifications are complete
- Fix all reported issues before considering work done
- Tests MUST fail before implementation begins
- Integration tests required for: component interactions, state management, collaborative features
- Math operations MUST use `packages/math/src/types.ts` Point type (never raw `{ x, y }`)

**Rationale**: TDD ensures specifications are clear before coding starts. Failing tests first proves tests work. Type consistency (Point) prevents geometric calculation bugs.

### V. Specification-Implementation Synchronization (NON-NEGOTIABLE)

**Specifications MUST be updated BEFORE implementing any feature change**:

- Bug fixes MUST update spec's Edge Cases section with root cause and resolution
- Feature enhancements MUST update relevant User Stories, Functional Requirements, and Success Criteria
- Implementation discoveries (e.g., data model clarifications, UX behavior changes) MUST be documented in spec immediately
- No code change is complete until corresponding spec sections are amended
- Spec amendments MUST include rationale for why implementation differs from original spec (if applicable)
- Spec version MUST be incremented following semantic versioning (MAJOR: breaking changes, MINOR: new requirements, PATCH: clarifications)

**Rationale**: Specifications are the source of truth. When implementation diverges from spec without updates, knowledge is lost, onboarding becomes impossible, and future changes break assumptions. Spec-code synchronization prevents documentation drift and ensures team alignment.

## Technical Standards be consistent, intuitive, and delightful**:

- React functional components with hooks (no class components)
- Follow React hooks rules strictly (no conditional hooks)
- CSS modules for component styling (scoped styles)
- Implement proper error boundaries for graceful degradation
- Use try/catch for async operations
- Log errors with contextual information
- Hand-drawn aesthetic MUST be preserved in all UI elements

**Rationale**: Users expect consistency. A single UX violation breaks trust. Error boundaries prevent cascade failures that ruin the experience.

### IV. Test-Driven Development (NON-NEGOTIABLE)

**Tests MUST be written before implementation**:

- Run `yarn test:app` after modifications are complete
- Fix all reported issues before considering work done
- Tests MUST fail before implementation begins
- Integration tests required for: component interactions, state management, collaborative features
- Math operations MUST use `packages/math/src/types.ts` Point type (never raw `{ x, y }`)

**Rationale**: TDD ensures specifications are clear before coding starts. Failing tests first proves tests work. Type consistency (Point) prevents geometric calculation bugs.

## Technical Standards

**TypeScript Configuration**:
- Strict mode enabled
- No implicit any
- Strict null checks

**React Standards**:
- Functional components only
- Hooks for state management
- CSS modules for styling

**Error Handling**:
- Try/catch for all async operations
- Error boundaries in React component trees
- Contextual error logging

**During Implementation**:
1. **Update specification FIRST** when discoveries require changes to requirements, edge cases, or data model
2. Implement to make tests pass
3. Follow type-safe patterns
4. Optimize for performance
5. Include `packages/math/src/types.ts` in context for math code

**Before Completing Work**:
**Before Starting Implementation**:
1. Read specifications thoroughly
2. Write tests that capture requirements
3. Verify tests fail
4. Run `yarn test:app` to establish baseline

**During Implementation**:
1. Implement to make tests pass
2. Follow type-safe patterns
3. Optimize for performance
4. Include `packages/math/src/types.ts` in context for math code
**Before Completing Work**:
1. **Verify specification is synchronized** with all implementation changes (bug fixes, enhancements, discoveries)
2. Run `yarn test:app` in project root
3. Fix all reported issues
4. Verify performance impact
5. Check bundle size impact
**Code Review Requirements**:
- All PRs MUST pass type checking
- All tests MUST pass
- Specifications MUST be updated to reflect implementation changes
- Performance regression analysis required
- UX consistency verified

## Governancency verified

## Governance

This constitution supersedes all other development practices. All code changes, feature additions, and architectural decisions MUST comply with these principles.

**Amendment Process**:
- Proposed changes MUST be documented with rationale
- Breaking changes require major version bump
- Amendments require team approval
- Migration plan required for changes affecting existing code

**Compliance Verification**:
- All PRs/reviews MUST verify constitutional compliance
- Complexity deviating from principles MUST be justified and documented
- Use `.github/copilot-instructions.md` for runtime development guidance
**Versioning**:
- MAJOR: Principle removal, redefinition, or backward-incompatible governance changes
- MINOR: New principles added, material expansions
- PATCH: Clarifications, wording improvements, non-semantic refinements

**Version**: 1.1.0 | **Ratified**: 2025-12-13 | **Last Amended**: 2025-12-13

**Version**: 1.0.0 | **Ratified**: 2025-12-13 | **Last Amended**: 2025-12-13
