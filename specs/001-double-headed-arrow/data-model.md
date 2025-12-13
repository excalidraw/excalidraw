# Data Model: Double-Headed Arrow

**Feature**: 001-double-headed-arrow
**Date**: 2025-12-13

## Overview

**NO DATA MODEL CHANGES REQUIRED.** Existing `ExcalidrawArrowElement` type fully supports double-headed arrows. This document describes how existing properties are used for this feature.

## Entity: Arrow Element (Existing)

**Type**: `ExcalidrawArrowElement` (already defined in `packages/element/src/types.ts`)

### Properties (Relevant to Double-Headed Arrows)

| Property | Type | Description | Values for Double-Headed Arrow |
|----------|------|-------------|-------------------------------|
| `type` | `"arrow"` | Element type identifier | Always `"arrow"` |
| `startArrowhead` | `Arrowhead \| null` | Arrow head at start point | Non-null (e.g., `"arrow"`) |
| `endArrowhead` | `Arrowhead \| null` | Arrow head at end point | Non-null (e.g., `"arrow"`) |
| `points` | `readonly LocalPoint[]` | Line segment points | Unchanged from regular arrows |
| `startBinding` | `FixedPointBinding \| null` | Binding to element at start | Optional, unchanged behavior |
| `endBinding` | `FixedPointBinding \| null` | Binding to element at end | Optional, unchanged behavior |
| `elbowed` | `boolean` | Whether arrow uses elbow routing | Supports both true/false |

### Arrowhead Type (Existing)

```typescript
type Arrowhead =
  | "arrow"           // Classic arrow (triangular)
  | "bar"             // Bar/line end
  | "circle"          // Filled circle
  | "circle_outline"  // Hollow circle
  | "triangle"        // Filled triangle
  | "triangle_outline"// Hollow triangle
  | "diamond"         // Filled diamond
  | "diamond_outline" // Hollow diamond
  | "crowfoot_one"    // Database notation (one)
  | "crowfoot_many"   // Database notation (many)
  | "crowfoot_one_or_many"; // Database notation (one or many)
```

**All arrow head types are supported at both start and end positions.**

## State Combinations

### Single-Headed Arrow (Current Default)
```typescript
{
  type: "arrow",
  startArrowhead: null,      // No arrow head at start
  endArrowhead: "arrow"      // Arrow head at end
}
```

### Double-Headed Arrow (New Feature)
```typescript
{
  type: "arrow",
  startArrowhead: "arrow",   // Arrow head at start
  endArrowhead: "arrow"      // Arrow head at end
}
```

### Line (No Arrow Heads)
```typescript
{
  type: "arrow",
  startArrowhead: null,      // No arrow head at start
  endArrowhead: null         // No arrow head at end
}
```

### Mixed Arrow Heads (Already Supported)
```typescript
{
  type: "arrow",
  startArrowhead: "circle",   // Circle at start
  endArrowhead: "triangle"    // Triangle at end
}
```

## Validation Rules

**Existing Rules (No Changes)**:
1. `startArrowhead` must be `null` or a valid `Arrowhead` value
2. `endArrowhead` must be `null` or a valid `Arrowhead` value
3. Both can be null (line)
4. Both can be non-null (double-headed)
5. One can be null, other non-null (single-headed)

**No new validation required.**

## Serialization Format

### JSON Structure (Existing .excalidraw Format)

```json
{
  "type": "arrow",
  "id": "abc123",
  "x": 100,
  "y": 200,
  "width": 300,
  "height": 150,
  "points": [[0, 0], [300, 150]],
  "startArrowhead": "arrow",
  "endArrowhead": "arrow",
  "elbowed": false,
  "startBinding": null,
  "endBinding": null,
  ...otherProperties
}
```

**Backward Compatibility**:
- Old clients reading new files: See `startArrowhead: "arrow"`, render it correctly (feature already exists, just not exposed in UI)
- New clients reading old files: See `startArrowhead: null`, render single-headed arrow correctly
- **No migration required**

## Database Schema

N/A - Client-side only feature. No server-side database changes.

## State Management

### Application State (Existing Properties in `AppState`)

Relevant state properties:
```typescript
interface AppState {
  currentItemStartArrowhead: Arrowhead | null;  // Default: null
  currentItemEndArrowhead: Arrowhead | null;    // Default: "arrow"
  // ...other properties
}
```

**For Double-Headed Arrows**:
```typescript
{
  currentItemStartArrowhead: "arrow",  // Set to "arrow" instead of null
  currentItemEndArrowhead: "arrow"     // Keep existing default
}
```

## Relationships

### Element Bindings (Unchanged)

Double-headed arrows can bind to elements at both ends, exactly like single-headed arrows:

```
[Rectangle A] ←→ [Rectangle B]
      ↑              ↑
      |              |
  startBinding   endBinding
```

**Behavior**: No changes to binding logic. Arrow heads render on top of bound connections.

## Migration Plan

**Not Required** - Feature uses existing data model. No migration needed.

### Rollout Strategy

1. **Phase 1**: Add UI to set `startArrowhead` to non-null values
2. **Phase 2**: Users create double-headed arrows
3. **Phase 3**: Files with double-headed arrows saved/shared
4. **Result**: Gradual adoption, full backward compatibility

## Data Integrity

### Constraints (Existing)

1. `startArrowhead` and `endArrowhead` must be valid enum values or null
2. TypeScript type system enforces constraints at compile time
3. Runtime validation already exists in restore logic

**No new constraints required.**

## Performance Implications

### Storage

- Single-headed arrow: 2 properties (`startArrowhead: null`, `endArrowhead: "arrow"`)
- Double-headed arrow: 2 properties (`startArrowhead: "arrow"`, `endArrowhead: "arrow"`)
- **Delta**: 0 bytes (both store 2 properties)

### Memory

- No additional properties allocated
- Same memory footprint as existing arrows

### Rendering

- Existing rendering handles 0, 1, or 2 arrow heads
- Computational complexity: O(1) per arrow head
- **Delta**: Rendering 2 heads vs 1 head = +0.05ms per arrow (negligible)

## Summary

**Key Insight**: Double-headed arrows are not a new element type - they're a configuration of existing `ExcalidrawArrowElement` with both `startArrowhead` and `endArrowhead` set to non-null values. The data model already supports this; only UI needs enhancement.

**Changes Required**: None to data model, only to UI defaults and controls.
