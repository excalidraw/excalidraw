# API Contracts: Double-Headed Arrow

**Feature**: 001-double-headed-arrow
**Date**: 2025-12-13

## Overview

Double-headed arrows use existing TypeScript interfaces. This document specifies the type contracts for clarity and reference.

## Type Contracts

### Arrowhead Type

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
```

**Contract**:
- **Input**: Any of the string literal values above
- **Output**: Type-safe union type
- **Validation**: TypeScript enforces at compile time

### ExcalidrawArrowElement Interface

**Location**: `packages/element/src/types.ts`

```typescript
export type ExcalidrawArrowElement = ExcalidrawLinearElement &
  Readonly<{
    type: "arrow";
    elbowed: boolean;
  }>;

export type ExcalidrawLinearElement = _ExcalidrawElementBase &
  Readonly<{
    type: "line" | "arrow";
    points: readonly LocalPoint[];
    startBinding: FixedPointBinding | null;
    endBinding: FixedPointBinding | null;
    startArrowhead: Arrowhead | null;
    endArrowhead: Arrowhead | null;
  }>;
```

**Contract for Double-Headed Arrows**:
```typescript
{
  type: "arrow",
  startArrowhead: Arrowhead,  // Must be non-null
  endArrowhead: Arrowhead,    // Must be non-null
  // ...other properties from ExcalidrawLinearElement
}
```

**Validation**:
- `startArrowhead !== null` AND `endArrowhead !== null` = double-headed arrow
- Both must be valid `Arrowhead` values
- Runtime: Validated by TypeScript and existing restore logic

### AppState Interface (Arrow Head Defaults)

**Location**: `packages/excalidraw/types.ts`

```typescript
interface AppState {
  currentItemStartArrowhead: Arrowhead | null;
  currentItemEndArrowhead: Arrowhead | null;
  // ...other state properties
}
```

**Contract for Double-Headed Arrow Tool**:
```typescript
{
  currentItemStartArrowhead: "arrow",  // Non-null for double-headed
  currentItemEndArrowhead: "arrow"     // Non-null for double-headed
}
```

**Default Values**:
- Single-headed arrow (current): `{ startArrowhead: null, endArrowhead: "arrow" }`
- Double-headed arrow (new): `{ startArrowhead: "arrow", endArrowhead: "arrow" }`

## Function Signatures

### newArrowElement (Existing)

**Location**: `packages/element/src/newElement.ts`

```typescript
export const newArrowElement = <T extends boolean>(
  opts: {
    type: ExcalidrawArrowElement["type"];
    startArrowhead?: Arrowhead | null;
    endArrowhead?: Arrowhead | null;
    points?: ExcalidrawArrowElement["points"];
    elbowed?: T;
    // ...other options
  } & ElementConstructorOpts,
): T extends true
  ? NonDeleted<ExcalidrawElbowArrowElement>
  : NonDeleted<ExcalidrawArrowElement>;
```

**Usage for Double-Headed Arrows**:
```typescript
const doubleHeadedArrow = newArrowElement({
  type: "arrow",
  startArrowhead: "arrow",  // Set to non-null
  endArrowhead: "arrow",    // Set to non-null
  // ...other properties
});
```

**Contract**:
- **Input**: Optional `startArrowhead` and `endArrowhead` (defaults to `null` and `"arrow"` respectively)
- **Output**: New arrow element with specified arrow heads
- **Validation**: TypeScript ensures only valid `Arrowhead` values

### getArrowheadShapes (Existing, No Changes)

**Location**: `packages/element/src/shape.ts`

```typescript
function getArrowheadShapes(
  element: ExcalidrawLinearElement,
  shape: Drawable[],
  position: "start" | "end",
  arrowhead: Arrowhead,
  generator: RoughGenerator,
  options: Options,
  canvasBackgroundColor: string,
): Drawable[];
```

**Contract**:
- **Input**:
  - `position`: `"start"` or `"end"`
  - `arrowhead`: Valid `Arrowhead` value (not null)
- **Output**: Array of `Drawable` shapes for RoughJS
- **Usage**: Called twice for double-headed arrows (once for start, once for end)

**Validation**:
- Called only when `arrowhead !== null`
- Existing function, no modifications required

## Action Contracts

### changeArrowhead Action

**Location**: `packages/excalidraw/actions/actionProperties.tsx`

```typescript
// Action handler signature (simplified)
type ChangeArrowheadAction = {
  execute: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    value: { position: "start" | "end"; type: Arrowhead | null }
  ) => {
    elements: ExcalidrawElement[];
    appState: AppState;
  };
};
```

**Contract**:
- **Input**:
  - `position`: `"start"` or `"end"`
  - `type`: `Arrowhead | null` (null removes arrow head)
- **Output**: Updated elements with new arrow head values
- **Validation**: Enforced by TypeScript type system

**Example Usage**:
```typescript
// Set both arrow heads to create double-headed arrow
changeArrowhead(elements, appState, { position: "start", type: "arrow" });
changeArrowhead(elements, appState, { position: "end", type: "arrow" });
```

## Serialization Contract

### JSON Schema (.excalidraw files)

```typescript
interface SerializedArrowElement {
  type: "arrow";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  points: [number, number][];
  startArrowhead: string | null;  // Arrowhead value or null
  endArrowhead: string | null;    // Arrowhead value or null
  elbowed: boolean;
  startBinding: FixedPointBinding | null;
  endBinding: FixedPointBinding | null;
  // ...other ExcalidrawElement properties
}
```

**Contract**:
- **Serialization**: Arrow elements serialize to JSON with `startArrowhead` and `endArrowhead` properties
- **Deserialization**: JSON parsed back to `ExcalidrawArrowElement` type
- **Validation**: Existing `restoreElement` function validates and migrates old formats
- **Backward Compatibility**:
  - Missing `startArrowhead` defaults to `null`
  - Missing `endArrowhead` defaults to `"arrow"`

### Migration Contract (Existing)

**Location**: `packages/excalidraw/data/restore.ts`

```typescript
case "arrow": {
  const { startArrowhead = null, endArrowhead = "arrow" } = element;
  // Restore logic...
}
```

**Contract**:
- Old files without `startArrowhead`: Default to `null`
- Old files without `endArrowhead`: Default to `"arrow"`
- New files with both properties: Use as-is
- **No migration code required for double-headed arrows**

## Error Handling

### Invalid Arrowhead Value

**Scenario**: User provides invalid arrow head type (shouldn't happen with TypeScript)

```typescript
// TypeScript prevents this at compile time
const invalid = newArrowElement({
  startArrowhead: "invalid" as Arrowhead, // TypeScript error!
});
```

**Contract**: TypeScript type system prevents invalid values. Runtime validation not required.

### Null Safety

**Scenario**: Rendering with null arrow head

```typescript
// Existing code handles null gracefully
if (element.startArrowhead !== null) {
  // Render start arrow head
}
if (element.endArrowhead !== null) {
  // Render end arrow head
}
```

**Contract**:
- Null values are valid (represent no arrow head)
- Rendering logic checks for null before rendering
- No errors thrown for null arrow heads

## Testing Contracts

### Test Helper Contract

```typescript
// Test helper for creating double-headed arrows
function createDoubleHeadedArrow(
  options?: Partial<ExcalidrawArrowElement>
): ExcalidrawArrowElement {
  return API.createElement({
    type: "arrow",
    startArrowhead: "arrow",
    endArrowhead: "arrow",
    ...options,
  });
}
```

**Contract**:
- **Input**: Optional overrides for arrow element properties
- **Output**: Arrow element with both arrow heads set to `"arrow"`
- **Usage**: Simplifies test setup for double-headed arrow scenarios

## Summary

**No new contracts required.** All interfaces, types, and functions already support double-headed arrows:

- ✅ `Arrowhead` type supports all arrow head styles
- ✅ `ExcalidrawArrowElement` has `startArrowhead` and `endArrowhead` properties
- ✅ `newArrowElement` accepts both arrow head parameters
- ✅ Rendering functions handle both arrow heads independently
- ✅ Serialization preserves both properties
- ✅ Type system enforces contracts at compile time

**Implementation requires only setting existing properties to non-null values.**
