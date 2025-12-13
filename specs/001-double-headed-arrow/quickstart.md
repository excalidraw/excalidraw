# Quick Start: Double-Headed Arrow Development

**Feature**: 001-double-headed-arrow
**Date**: 2025-12-13
**For**: Developers implementing or extending double-headed arrow feature

## Overview

Double-headed arrows are a configuration of existing `ExcalidrawArrowElement` where both `startArrowhead` and `endArrowhead` are non-null. No data model changes required - only UI enhancements.

## Architecture

```
User clicks toolbar
    ↓
Sets appState.currentItemStartArrowhead = "arrow"
Sets appState.currentItemEndArrowhead = "arrow"
    ↓
User draws arrow on canvas
    ↓
newArrowElement() creates arrow with both arrow heads
    ↓
Render pipeline calls getArrowheadShapes() twice
    ↓
Both arrow heads rendered at start and end points
```

## Key Files

| File | Purpose | Changes Required |
|------|---------|------------------|
| `packages/element/src/types.ts` | Type definitions | ✅ No changes (types already support this) |
| `packages/excalidraw/components/App.tsx` | Arrow tool defaults | 🔧 Add double-headed arrow tool state |
| `packages/excalidraw/actions/actionProperties.tsx` | Arrow head UI controls | 🔧 Add preset button for double-headed |
| `packages/element/src/shape.ts` | Arrow rendering | ✅ No changes (already renders both) |
| `packages/excalidraw/data/restore.ts` | Serialization | ✅ No changes (already handles both) |

Legend: ✅ No changes | 🔧 Modifications needed

## Development Setup

### 1. Start Development Server

```bash
cd /path/to/excalidraw-master
yarn install
yarn start
```

Access at `http://localhost:3000`

### 2. Run Tests

```bash
# Run all tests
yarn test:app

# Run specific test file
yarn test:app packages/excalidraw/actions/actionFlip.test.tsx

# Run in watch mode
yarn test:app --watch
```

### 3. Type Checking

```bash
yarn test:typecheck
```

## Code Examples

### Creating Double-Headed Arrow (Programmatic)

```typescript
import { newArrowElement } from "@excalidraw/element";

const doubleHeadedArrow = newArrowElement({
  type: "arrow",
  x: 100,
  y: 100,
  startArrowhead: "arrow",  // Key: set to non-null
  endArrowhead: "arrow",    // Key: set to non-null
  strokeColor: "#000000",
  backgroundColor: "transparent",
});
```

### Setting AppState for Double-Headed Tool

```typescript
// In App.tsx or action handler
this.setState({
  currentItemStartArrowhead: "arrow",  // Default: null
  currentItemEndArrowhead: "arrow",    // Default: "arrow"
  activeTool: { type: "arrow" },
});
```

### Testing Double-Headed Arrows

```typescript
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

describe("Double-headed arrows", () => {
  it("should create arrow with heads at both ends", () => {
    const arrow = API.createElement({
      type: "arrow",
      startArrowhead: "arrow",
      endArrowhead: "arrow",
    });

    expect(arrow.startArrowhead).toBe("arrow");
    expect(arrow.endArrowhead).toBe("arrow");
  });

  it("should render both arrow heads", () => {
    const arrow = API.createElement({
      type: "arrow",
      startArrowhead: "arrow",
      endArrowhead: "arrow",
      points: [[0, 0], [100, 100]],
    });

    API.setElements([arrow]);

    // Rendering happens automatically
    // Verify via snapshot or visual testing
  });

  it("should persist double-headed arrows in save/load", () => {
    const arrow = API.createElement({
      type: "arrow",
      startArrowhead: "arrow",
      endArrowhead: "arrow",
    });

    API.setElements([arrow]);

    // Export
    const exported = API.getSceneElements();

    // Import
    API.clearElements();
    API.setElements(exported);

    const restored = API.getElements()[0] as ExcalidrawArrowElement;
    expect(restored.startArrowhead).toBe("arrow");
    expect(restored.endArrowhead).toBe("arrow");
  });
});
```

## Common Tasks

### Task 1: Add Toolbar Button for Double-Headed Arrow

**File**: `packages/excalidraw/components/App.tsx`

**Goal**: Add button that sets both arrow heads to "arrow"

**Steps**:
1. Locate toolbar section with arrow tool
2. Add new tool button with icon (duplicate existing arrow icon, modify)
3. On click, set state: `{ currentItemStartArrowhead: "arrow", currentItemEndArrowhead: "arrow" }`
4. Follow existing patterns for other tool buttons

**Example pattern** (simplified):
```typescript
<ToolButton
  type="button"
  icon={DoubleHeadedArrowIcon}
  title="Double-headed arrow"
  onClick={() => {
    this.setState({
      activeTool: { type: "arrow" },
      currentItemStartArrowhead: "arrow",
      currentItemEndArrowhead: "arrow",
    });
  }}
/>
```

### Task 2: Add Properties Panel Preset

**File**: `packages/excalidraw/actions/actionProperties.tsx`

**Goal**: Add "Double-headed" preset button in arrow head section

**Steps**:
1. Locate `PanelComponent` in `actionChangeArrowhead`
2. Add button above/below existing `IconPicker` components
3. On click, update both start and end arrow heads to "arrow"

**Example**:
```typescript
<button
  onClick={() => {
    updateData({ position: "start", type: "arrow" });
    updateData({ position: "end", type: "arrow" });
  }}
>
  Double-headed
</button>
```

### Task 3: Add Keyboard Shortcut

**File**: `packages/excalidraw/actions/actionProperties.tsx`

**Goal**: Add shortcut (e.g., Shift+D) for double-headed arrow

**Steps**:
1. Register action with `keyTest` function
2. Check for modifier keys (Shift) + key (D)
3. Execute: Set both arrow heads to "arrow"

**Pattern**:
```typescript
keyTest: (event) =>
  event.shiftKey && event.key.toLowerCase() === "d",
```

## Debugging Tips

### Issue: Arrow heads not rendering

**Check**:
1. Verify `startArrowhead` and `endArrowhead` are non-null
2. Check element type is `"arrow"` (not `"line"`)
3. Ensure points array has at least 2 points
4. Check rendering pipeline in `packages/element/src/shape.ts`

**Debug**:
```typescript
console.log("Arrow element:", {
  type: element.type,
  startArrowhead: element.startArrowhead,
  endArrowhead: element.endArrowhead,
  points: element.points,
});
```

### Issue: Arrow heads not persisting

**Check**:
1. Verify serialization includes both properties
2. Check `restore.ts` migration logic
3. Test save/load cycle

**Debug**:
```typescript
// Before save
console.log("Before save:", element);

// After load
const restored = JSON.parse(savedJson);
console.log("After load:", restored);
```

### Issue: Performance degradation

**Check**:
1. Measure rendering time: `console.time("render")` / `console.timeEnd("render")`
2. Compare with single-headed arrows
3. Profile with browser DevTools

**Expected**: Double-headed arrows should be <2x rendering time of single-headed (typically <0.1ms difference).

## Testing Checklist

Before submitting PR:

- [ ] Run `yarn test:app` - all tests pass
- [ ] Run `yarn test:typecheck` - no type errors
- [ ] Visual test: Draw double-headed arrow, verify both heads render
- [ ] Save/load test: Create arrow, save to file, reload, verify persistence
- [ ] Collaboration test: Create arrow in one client, verify syncs to other client
- [ ] Backward compat: Load old file (single-headed), verify still works
- [ ] Forward compat: Save new file (double-headed), load in old version (should render correctly)
- [ ] Performance: Verify no regression (<16ms per frame at 60fps)

## Common Pitfalls

### Pitfall 1: Modifying element types

**Wrong**:
```typescript
// DON'T create new element type
export type ExcalidrawDoubleHeadedArrowElement = ...
```

**Right**:
```typescript
// DO use existing element type with both arrow heads set
const arrow: ExcalidrawArrowElement = {
  type: "arrow",
  startArrowhead: "arrow",
  endArrowhead: "arrow",
  // ...
};
```

### Pitfall 2: Separate rendering logic

**Wrong**:
```typescript
// DON'T add special case for double-headed arrows
if (element.type === "double-headed-arrow") {
  renderDoubleHeadedArrow(element);
}
```

**Right**:
```typescript
// DO reuse existing rendering (already handles both)
if (element.startArrowhead !== null) {
  renderArrowhead(element, "start");
}
if (element.endArrowhead !== null) {
  renderArrowhead(element, "end");
}
```

### Pitfall 3: Not testing edge cases

**Test these scenarios**:
- Zero-length arrow (start === end)
- Very short arrow (arrow heads overlap)
- All arrow head combinations (arrow/circle/triangle/etc at start/end)
- Elbow arrows with double heads
- Bound arrows with double heads

## Resources

- [Type definitions](../contracts/types.ts.md)
- [Data model](../data-model.md)
- [Research findings](../research.md)
- [Constitution](.specify/memory/constitution.md)

## Getting Help

1. Check existing arrow tests in `packages/excalidraw/actions/actionFlip.test.tsx`
2. Review arrow rendering code in `packages/element/src/shape.ts`
3. Ask in Excalidraw Discord #development channel
4. File issue on GitHub with reproducible test case

## Next Steps

After completing basic implementation:

1. Add internationalization (i18n) for "Double-headed arrow" label
2. Add icon for double-headed arrow tool
3. Add documentation to user-facing docs
4. Consider adding to keyboard shortcuts overlay
5. Measure and optimize performance if needed
