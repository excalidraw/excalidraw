# Implementation Plan: Double-Headed Arrow

**Branch**: `001-double-headed-arrow` | **Date**: 2025-12-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-double-headed-arrow/spec.md`

## Summary

Add support for bidirectional arrows with arrow heads at both endpoints. Users can draw, persist, and convert double-headed arrows through existing line/arrow tooling. Implementation leverages existing `startArrowhead` and `endArrowhead` properties already present in arrow elements - no new properties or data model changes required. Changes limited to UI controls and default arrow head assignment logic.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict mode enabled)
**Primary Dependencies**: React 19.x, Vite 5.x, RoughJS (for hand-drawn rendering), Jotai (state management)
**Storage**: Browser LocalStorage + .excalidraw JSON file format (existing serialization)
**Testing**: Vitest (unit/integration tests), `yarn test:app` command
**Target Platform**: Modern browsers (Chrome, Firefox, Safari, Edge) - Web application
**Project Type**: Web application (monorepo: `excalidraw-app`, `packages/*`)
**Performance Goals**: 60fps rendering, <100ms interaction response time, maintain existing arrow performance
**Constraints**: Zero bundle size regression, no new dependencies, backward compatible with existing .excalidraw files
**Scale/Scope**: Affects arrow element type system, toolbar UI, properties panel, save/load serialization

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality & Type Safety ✅ PASS
- All code will be TypeScript with strict mode
- Arrow element types already exist (`ExcalidrawArrowElement`, `Arrowhead` type union)
- Leverages existing `startArrowhead` and `endArrowhead: Arrowhead | null` properties
- No new types required, only logic changes to support both heads being non-null
- Naming follows existing conventions (camelCase for properties, PascalCase for types)

**Verification**: No new type definitions needed. Existing `Arrowhead` type supports all arrow head styles.

### II. Performance First ✅ PASS
- Zero allocation changes - uses existing arrow rendering pipeline
- No additional properties stored per element (uses existing `startArrowhead`/`endArrowhead`)
- Rendering reuses existing `getArrowheadShapes()` function - already optimized
- Bundle size impact: ~1KB for UI controls only
- Performance identical to single-headed arrows (same rendering code path, just called twice)

**Verification**: Existing arrow performance benchmarks apply. Rendering two arrow heads vs one has negligible perf impact (<0.1ms per arrow at 60fps budget).

### III. User Experience Consistency ✅ PASS
- Uses existing arrow properties panel UI pattern
- Toolbar integration follows existing tool selection model
- CSS modules for any new styles (matches project standard)
- No new interaction patterns - leverages existing arrow creation flow
- Error boundaries not required (no new error scenarios introduced)

**Verification**: Feature uses existing UI components (`IconPicker`, arrowhead selectors). No new UX patterns.

### IV. Test-Driven Development ✅ PASS
- Will write tests before implementation (vitest)
- Tests will verify: toolbar interaction, arrow head rendering, save/load persistence, conversion operations
- Follows existing test patterns in `packages/excalidraw/actions/actionFlip.test.tsx`
- `yarn test:app` will be run after implementation
- Math operations use existing `Point` types from `packages/math/src/types.ts`

**Verification**: Test structure follows existing arrow test patterns. Integration tests for collaboration already exist.

**GATE STATUS**: ✅ **ALL CHECKS PASS** - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/001-double-headed-arrow/
├── plan.md              # This file
├── research.md          # Phase 0: Research existing arrow implementation
├── data-model.md        # Phase 1: Element property schema (minimal - no changes)
├── quickstart.md        # Phase 1: Developer guide for double-headed arrows
├── contracts/           # Phase 1: TypeScript interfaces (existing types)
└── tasks.md             # Phase 2: Implementation task breakdown
```

### Source Code (repository root)

```text
excalidraw-app/
└── (no changes - uses excalidraw package)

packages/
├── excalidraw/
│   ├── actions/
│   │   └── actionProperties.tsx         # Modify: arrow head selection logic
│   ├── components/
│   │   ├── App.tsx                      # Modify: default arrow head state
│   │   └── LayerUI.tsx                  # Verify: toolbar rendering
│   ├── element/
│   │   └── newElement.ts                # Review: arrow element creation
│   └── tests/
│       └── arrowhead.test.tsx           # New: double-headed arrow tests
│
├── element/
│   ├── src/
│   │   ├── types.ts                     # No changes: types already support this
│   │   ├── comparisons.ts               # No changes: canHaveArrowheads() already correct
│   │   └── shape.ts                     # Review: arrow head rendering logic
│   └── __tests__/
│       └── doubleHeadedArrow.test.ts    # New: element-level tests
│
└── common/
    └── (no changes)

vitest.config.mts                         # Existing test configuration
```

**Structure Decision**: Web application (Option 2 variant - monorepo). Feature touches:
1. **packages/excalidraw**: UI controls, actions, toolbar
2. **packages/element**: Element types (already support feature), rendering
3. **Tests**: New test files in both packages

No backend changes - all client-side. Existing collaboration/persistence infrastructure handles double-headed arrows automatically via existing `startArrowhead`/`endArrowhead` serialization.

## Complexity Tracking

No constitutional violations. All gates pass without justification required.
