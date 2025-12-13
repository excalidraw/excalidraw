# Research: Double-Headed Arrow Implementation

**Feature**: 001-double-headed-arrow
**Date**: 2025-12-13
**Purpose**: Research existing arrow implementation to inform design decisions

## Executive Summary

Double-headed arrows require **NO** data model changes. Existing `ExcalidrawArrowElement` type already has `startArrowhead` and `endArrowhead` properties that can both be non-null simultaneously. Implementation requires only UI/interaction changes to support setting both arrow heads.

## Key Findings

### 1. Existing Arrow Type System

**Location**: `packages/element/src/types.ts`

```typescript
export type Arrowhead =
  | "arrow"
  | "bar"
  | "circle"
  | "circle_outline"
  | "triangle"
  | "triangle_outline"
  | "diamond"
  | "diamond_outline"
  | "crowfoot_one"
  | "crowfoot_many"
  | "crowfoot_one_or_many";

export type ExcalidrawLinearElement = _ExcalidrawElementBase &
  Readonly<{
    type: "line" | "arrow";
    startArrowhead: Arrowhead | null;  // ← Can be non-null
    endArrowhead: Arrowhead | null;    // ← Can be non-null
  }>;
```

**Decision**: Use existing types. No modifications required.
**Rationale**: Both properties already support null or any `Arrowhead` value independently. Double-headed arrow is simply `startArrowhead !== null && endArrowhead !== null`.

### 2. Arrow Rendering Pipeline

**Location**: `packages/element/src/shape.ts` (lines 739-780)

```typescript
// Simplified rendering logic
if (element.type === "arrow") {
  const { startArrowhead = null, endArrowhead = "arrow" } = element;

  if (startArrowhead !== null) {
    const shapes = getArrowheadShapes(element, shape, "start", startArrowhead, ...);
    shape.push(...shapes);
  }

  if (endArrowhead !== null) {
    const shapes = getArrowheadShapes(element, shape, "end", endArrowhead, ...);
    shape.push(...shapes);
  }
}
```

**Decision**: No rendering changes needed.
**Rationale**: Rendering already handles both start and end arrow heads independently. When both are non-null, both render automatically.

### 3. Arrow Creation Defaults

**Location**: `packages/excalidraw/components/App.tsx` (line 8531+)

Current behavior:
- `startArrowhead`: defaults to `null` (no arrow head)
- `endArrowhead`: defaults to `"arrow"` (arrow head at end)

**Decision**: Add UI control to set `startArrowhead` to non-null value.
**Rationale**: Currently only `endArrowhead` has default non-null. User must explicitly set `startArrowhead` via properties panel (already works, just not discoverable).

### 4. Arrow Head Selection UI

**Location**: `packages/excalidraw/actions/actionProperties.tsx` (lines 1555-1700)

Existing UI:
- Two `IconPicker` components for start/end arrow heads
- Keyboard shortcuts (q/w/e/r/a/s/d/f/z/x/c for different arrow head types)
- Already supports independent start/end selection

**Decision**: No UI component changes needed. Add preset/quick-select for double-headed arrows.
**Rationale**: Existing UI already allows setting both. Enhancement: add single-click option to set both to "arrow" simultaneously.

### 5. Serialization & Persistence

**Location**: `packages/excalidraw/data/restore.ts` (lines 363-395)

```typescript
case "arrow": {
  const { startArrowhead = null, endArrowhead = "arrow" } = element;
  // ... serialization logic
}
```

**Decision**: No serialization changes required.
**Rationale**: Both properties already serialize/deserialize correctly. Old files with `startArrowhead: null` continue working. New files with `startArrowhead: "arrow"` deserialize correctly.

### 6. Collaboration Sync

**Findings**:
- Arrow elements sync via existing element update mechanism
- `startArrowhead` and `endArrowhead` are part of element state
- No special handling needed for collaboration

**Decision**: No collaboration code changes.
**Rationale**: Properties already sync. Double-headed arrows propagate automatically.

### 7. Best Practices from Codebase

**Performance**:
- Prefer const/readonly (existing code follows this)
- Avoid allocations in hot paths (arrow rendering is hot path)
- Use existing RoughJS generator instances

**Type Safety**:
- Strict null checks already enforced
- Arrowhead type is union of string literals (safe)

**Testing**:
- Tests in `packages/excalidraw/actions/actionFlip.test.tsx` show pattern
- Test both startArrowhead and endArrowhead independently
- Test flip behavior (swaps arrow heads)

## Implementation Strategy

### Minimal Changes Approach

1. **No Type Changes**: Use existing `Arrowhead` type and element properties
2. **No Rendering Changes**: Existing rendering already supports double heads
3. **No Serialization Changes**: Properties already persist correctly
4. **UI Enhancement Only**: Add quick-select option for double-headed arrows

### Proposed UI Enhancement

**Option 1: Toolbar Button** (Recommended)
- Add "double-headed arrow" button next to existing arrow tool
- On select: Sets `currentItemStartArrowhead: "arrow"` and `currentItemEndArrowhead: "arrow"`
- Uses existing arrow creation logic

**Option 2: Properties Panel Preset**
- Add "Double-headed" preset button in arrow head section
- On click: Sets both start and end to "arrow" simultaneously
- Simpler but less discoverable

**Decision**: Implement Option 1 (toolbar) for P1, Option 2 (preset) for P3.

## Technology Decisions

**No New Dependencies Required**:
- React 19.x (existing)
- TypeScript 5.9.3 (existing)
- RoughJS (existing for rendering)
- Vitest (existing for tests)

**Performance Targets**:
- Rendering: <16ms per frame (60fps) ← Already achieved by existing arrows
- Interaction: <100ms response ← Existing arrow tool meets this
- Bundle: +1KB max ← Only UI button code

**Backward Compatibility**:
- ✅ Old files with single-headed arrows continue working
- ✅ New files with double-headed arrows load in old versions (render correctly)
- ✅ Collaboration between old/new clients works (properties already exist)

## Unknowns Resolved

1. ~~How are arrow heads stored?~~ → Answered: Two separate properties (`startArrowhead`, `endArrowhead`)
2. ~~Do we need new types?~~ → Answered: No, existing types support this
3. ~~How does rendering work?~~ → Answered: Independent rendering of start/end heads
4. ~~Will old files break?~~ → Answered: No, backward compatible
5. ~~Performance impact?~~ → Answered: Negligible (same code path, just called twice)

## References

- `packages/element/src/types.ts`: Type definitions
- `packages/element/src/shape.ts`: Rendering logic
- `packages/excalidraw/actions/actionProperties.tsx`: Arrow head UI
- `packages/excalidraw/components/App.tsx`: Arrow creation defaults
- `packages/excalidraw/actions/actionFlip.test.tsx`: Test patterns
