# Double-Headed Arrow Tool Implementation Plan

## Overview

Add a new "Double-headed arrow" toolbar button (hotkey `B`) that creates standard arrow elements with both `startArrowhead` and `endArrowhead` set to `"arrow"`. This reuses the existing `ExcalidrawArrowElement` type, avoiding changes to serialization/deserialization logic.

## Current State Analysis

### Key Discoveries:
- Arrows already support `startArrowhead` and `endArrowhead` properties ([types.ts#L320-328](packages/element/src/types.ts#L320-328))
- The `SHAPES` array in [shapes.tsx](packages/excalidraw/components/shapes.tsx) defines toolbar tools with their icons and hotkeys
- Hotkey `B` is currently unassigned in [keys.ts](packages/common/src/keys.ts)
- Arrow creation happens in `App.tsx` around line 8636, using `newArrowElement()` with `startArrowhead` and `endArrowhead` from app state
- Arrow type cycling (sharp→round→elbow) is handled in `App.tsx` lines 4910-4918 when pressing `A` while arrow tool is active
- `ToolType` in [types.ts](packages/excalidraw/types.ts#L143-159) defines available tool types
- `AllowedExcalidrawActiveTools` in [restore.ts](packages/excalidraw/data/restore.ts) controls which tools can be active

### Existing Pattern:
The arrow tool creates arrows with arrowheads determined by `currentItemStartArrowhead` and `currentItemEndArrowhead` from app state. The double-headed arrow tool will follow the same pattern but always set both arrowheads.

## Desired End State

After implementation:
1. A new "Double-headed arrow" button appears in the toolbar between Arrow and Line
2. Pressing `B` or clicking the button activates the double-headed arrow tool
3. Drawing creates standard arrows with both `startArrowhead="arrow"` and `endArrowhead="arrow"`
4. All arrow subtypes (sharp, round, elbow) work with double-headed arrows
5. Pressing `B` while double-headed arrow tool is active cycles through arrow subtypes (sharp→round→elbow)
6. Existing tests continue to pass
7. New tests verify the double-headed arrow functionality

### Verification:
- Draw a double-headed arrow → both ends have arrowheads
- Save and reload → arrowheads persist on both ends
- Change arrow type (sharp/round/elbow) → works correctly
- All arrowhead types can be applied to either end via properties panel

## What We're NOT Doing

- NOT creating a new element type (`ExcalidrawDoubleHeadedArrowElement`)
- NOT modifying serialization/deserialization logic
- NOT changing the `ExcalidrawArrowElement` type definition
- NOT adding new properties to elements
- NOT creating separate app state for double-headed arrow arrowhead types (reuses existing)

## Implementation Approach

Add `"doubleArrow"` as a new tool type that creates `ExcalidrawArrowElement` with both arrowheads set. The tool behaves identically to the arrow tool except it forces both arrowheads to be non-null.

---

## Phase 1: Add Tool Type and Hotkey

### Overview
Register the new `doubleArrow` tool type and assign it the `B` hotkey.

### Changes Required:

#### 1. Add `B` key constant
**File**: `packages/common/src/keys.ts`
**Changes**: Add `B` key to KEYS constant

```typescript
  K: "k",
  W: "w",
  B: "b",  // ADD THIS LINE
```

#### 2. Add `doubleArrow` to ToolType
**File**: `packages/excalidraw/types.ts`
**Changes**: Add `doubleArrow` to the ToolType union

```typescript
export type ToolType =
  | "selection"
  | "lasso"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "doubleArrow"  // ADD THIS LINE
  | "line"
  | "freedraw"
  // ... rest unchanged
```

#### 3. Allow `doubleArrow` as active tool
**File**: `packages/excalidraw/data/restore.ts`
**Changes**: Add `doubleArrow` to `AllowedExcalidrawActiveTools`

```typescript
export const AllowedExcalidrawActiveTools: Record<
  AppState["activeTool"]["type"],
  boolean
> = {
  selection: true,
  lasso: true,
  text: true,
  rectangle: true,
  diamond: true,
  ellipse: true,
  line: true,
  image: true,
  arrow: true,
  doubleArrow: true,  // ADD THIS LINE
  freedraw: true,
  // ... rest unchanged
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `yarn typecheck`
- [ ] Linting passes: `yarn lint`

#### Manual Verification:
- [ ] N/A for this phase (tool not yet functional)

---

## Phase 2: Add Toolbar Button and Icon

### Overview
Create an icon for double-headed arrow and add it to the toolbar SHAPES array.

### Changes Required:

#### 1. Add DoubleArrowIcon
**File**: `packages/excalidraw/components/icons.tsx`
**Changes**: Add new icon near ArrowIcon (around line 357)

```tsx
export const DoubleArrowIcon = createIcon(
  <g strokeWidth={1.5}>
    <path d="M5 12 L19 12" />
    <path d="M5 12 L9 8" />
    <path d="M5 12 L9 16" />
    <path d="M19 12 L15 8" />
    <path d="M19 12 L15 16" />
  </g>,
  tablerIconProps,
);
```

#### 2. Add to SHAPES array
**File**: `packages/excalidraw/components/shapes.tsx`
**Changes**: Import icon and add doubleArrow entry after arrow

```tsx
import {
  SelectionIcon,
  RectangleIcon,
  DiamondIcon,
  EllipseIcon,
  ArrowIcon,
  DoubleArrowIcon,  // ADD THIS IMPORT
  LineIcon,
  // ...
} from "./icons";

// In SHAPES array, add after arrow entry:
  {
    icon: ArrowIcon,
    value: "arrow",
    key: KEYS.A,
    numericKey: KEYS["5"],
    fillable: true,
  },
  {
    icon: DoubleArrowIcon,
    value: "doubleArrow",
    key: KEYS.B,
    numericKey: null,  // No numeric key assigned
    fillable: true,
  },
  // ... line entry follows
```

#### 3. Add translation key
**File**: `packages/excalidraw/locales/en.json`
**Changes**: Add toolbar label for doubleArrow

```json
  "toolBar": {
    // ... existing entries
    "arrow": "Arrow",
    "doubleArrow": "Double-headed arrow",
    "line": "Line",
    // ...
  }
```

#### 4. Add to HelpDialog
**File**: `packages/excalidraw/components/HelpDialog.tsx`
**Changes**: Add shortcut entry after arrow

```tsx
            <Shortcut
              label={t("toolBar.arrow")}
              shortcuts={[KEYS.A, KEYS["5"]]}
            />
            <Shortcut
              label={t("toolBar.doubleArrow")}
              shortcuts={[KEYS.B]}
            />
            <Shortcut
              label={t("toolBar.line")}
              shortcuts={[KEYS.L, KEYS["6"]]}
            />
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `yarn typecheck`
- [ ] Linting passes: `yarn lint`

#### Manual Verification:
- [ ] Double-headed arrow button visible in toolbar
- [ ] Pressing `B` selects the tool (button highlights)
- [ ] Tooltip shows "Double-headed arrow — B"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the toolbar button appears correctly before proceeding to the next phase.

---

## Phase 3: Implement Tool Drawing Logic

### Overview
Make the double-headed arrow tool create arrows with both arrowheads set.

### Changes Required:

#### 1. Handle doubleArrow in element creation
**File**: `packages/excalidraw/components/App.tsx`
**Changes**: 

First, update the element type check for linear elements (around line 8620):

```typescript
// Find this condition:
if (
  elementType === "arrow" ||
  elementType === "line"
) {

// Change to:
if (
  elementType === "arrow" ||
  elementType === "doubleArrow" ||
  elementType === "line"
) {
```

Then update the arrow creation logic (around line 8630):

```typescript
      const { currentItemStartArrowhead, currentItemEndArrowhead } = this.state;
      const [startArrowhead, endArrowhead] =
        elementType === "arrow"
          ? [currentItemStartArrowhead, currentItemEndArrowhead]
          : elementType === "doubleArrow"
          ? [currentItemEndArrowhead || "arrow", currentItemEndArrowhead || "arrow"]
          : [null, null];

      const element =
        elementType === "arrow" || elementType === "doubleArrow"
          ? newArrowElement({
              type: "arrow",  // Always create "arrow" type element
              // ... rest of properties unchanged
```

#### 2. Handle hotkey cycling for doubleArrow
**File**: `packages/excalidraw/components/App.tsx`
**Changes**: Update the arrow type cycling logic (around line 4910)

```typescript
        if (shape === "arrow" && this.state.activeTool.type === "arrow") {
          this.setState((prevState) => ({
            currentItemArrowType:
              prevState.currentItemArrowType === ARROW_TYPE.sharp
                ? ARROW_TYPE.round
                : prevState.currentItemArrowType === ARROW_TYPE.round
                ? ARROW_TYPE.elbow
                : ARROW_TYPE.sharp,
          }));
        }
        // ADD THIS BLOCK:
        if (shape === "doubleArrow" && this.state.activeTool.type === "doubleArrow") {
          this.setState((prevState) => ({
            currentItemArrowType:
              prevState.currentItemArrowType === ARROW_TYPE.sharp
                ? ARROW_TYPE.round
                : prevState.currentItemArrowType === ARROW_TYPE.round
                ? ARROW_TYPE.elbow
                : ARROW_TYPE.sharp,
          }));
        }
```

#### 3. Update isLinearElementType check
**File**: `packages/element/src/typeChecks.ts`
**Changes**: Include doubleArrow in linear element checks

```typescript
export const isLinearElementType = (
  elementType: ElementOrToolType,
): boolean => {
  return (
    elementType === "arrow" || 
    elementType === "doubleArrow" ||
    elementType === "line"
  );
};
```

#### 4. Update isBindingElementType check  
**File**: `packages/element/src/typeChecks.ts`
**Changes**: Include doubleArrow in binding element checks (since it creates arrows which bind)

```typescript
export const isBindingElementType = (
  elementType: ElementOrToolType,
): boolean => {
  return elementType === "arrow" || elementType === "doubleArrow";
};
```

#### 5. Update toolIsArrow helper
**File**: `packages/element/src/typeChecks.ts`
**Changes**: Add or update helper for arrow tool checks

```typescript
// Find or add near other tool type checks:
export const toolIsArrow = (
  toolType: ElementOrToolType,
): boolean => {
  return toolType === "arrow" || toolType === "doubleArrow";
};
```

Note: Need to verify if `toolIsArrow` exists and where it's defined. Search and update accordingly.

#### 6. Update scene helpers
**File**: `packages/excalidraw/scene/index.ts` or similar
**Changes**: Update `canHaveArrowheads` if needed

```typescript
// Verify and update if needed:
export const canHaveArrowheads = (type: ElementOrToolType): boolean => {
  return type === "arrow" || type === "doubleArrow";
};
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `yarn typecheck`
- [ ] Linting passes: `yarn lint`
- [ ] Existing arrow tests pass: `yarn test packages/element/tests/linearElementEditor.test.tsx`

#### Manual Verification:
- [ ] Select double-headed arrow tool and draw → arrow has arrowheads on both ends
- [ ] Arrow subtypes work (sharp/round/elbow)
- [ ] Pressing B while tool active cycles arrow types
- [ ] Arrow binds to shapes correctly

**Implementation Note**: After completing this phase, pause for manual verification that drawing works correctly before proceeding.

---

## Phase 4: Update Mobile Toolbar

### Overview
Add double-headed arrow to the mobile toolbar's linear element tools.

### Changes Required:

#### 1. Add to LINEAR_ELEMENT_TOOLS
**File**: `packages/excalidraw/components/MobileToolBar.tsx`
**Changes**: Import icon and add to tools array

```tsx
import {
  // ... existing imports
  ArrowIcon,
  DoubleArrowIcon,  // ADD THIS
  LineIcon,
  // ...
} from "./icons";

const LINEAR_ELEMENT_TOOLS = [
  {
    type: "arrow",
    icon: ArrowIcon,
    title: capitalizeString(t("toolBar.arrow")),
  },
  {
    type: "doubleArrow",
    icon: DoubleArrowIcon,
    title: capitalizeString(t("toolBar.doubleArrow")),
  },
  { type: "line", icon: LineIcon, title: capitalizeString(t("toolBar.line")) },
] as const;
```

#### 2. Update lastActiveLinearElement state
**File**: `packages/excalidraw/components/MobileToolBar.tsx`
**Changes**: Update the state type and sync effect

```typescript
  const [lastActiveLinearElement, setLastActiveLinearElement] = useState<
    "arrow" | "doubleArrow" | "line"
  >("arrow");

  // Update the useEffect:
  useEffect(() => {
    if (
      activeTool.type === "arrow" ||
      activeTool.type === "doubleArrow" ||
      activeTool.type === "line"
    ) {
      setLastActiveLinearElement(activeTool.type);
    }
  }, [activeTool.type]);
```

#### 3. Update onToolChange handler
**File**: `packages/excalidraw/components/MobileToolBar.tsx`
**Changes**: Handle doubleArrow in the tool change callback

```typescript
        onToolChange={(type: string) => {
          if (type === "arrow" || type === "doubleArrow" || type === "line") {
            setLastActiveLinearElement(type);
            app.setActiveTool({ type });
          }
        }}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `yarn typecheck`
- [ ] Linting passes: `yarn lint`

#### Manual Verification:
- [ ] On mobile view, double-headed arrow appears in linear element popover
- [ ] Selecting it works and draws double-headed arrows

---

## Phase 5: Add Tests

### Overview
Add tests for the new double-headed arrow functionality.

### Changes Required:

#### 1. Add toolbar selection test
**File**: `packages/excalidraw/tests/tool.test.tsx` (or create new test file)
**Changes**: Add tests for double-headed arrow tool

```typescript
describe("Double-headed arrow tool", () => {
  it("should select double-headed arrow tool with B key", async () => {
    const { h } = await render(<Excalidraw />);
    Keyboard.keyPress(KEYS.B);
    expect(h.state.activeTool.type).toBe("doubleArrow");
  });

  it("should create arrow with both arrowheads", async () => {
    const { h } = await render(<Excalidraw />);
    UI.clickTool("doubleArrow");
    
    const arrow = UI.createElement("doubleArrow", {
      x: 0,
      y: 0,
      width: 100,
      height: 0,
    });
    
    expect(arrow.type).toBe("arrow");
    expect(arrow.startArrowhead).not.toBeNull();
    expect(arrow.endArrowhead).not.toBeNull();
  });

  it("should cycle arrow types when pressing B while active", async () => {
    const { h } = await render(<Excalidraw />);
    
    Keyboard.keyPress(KEYS.B);
    expect(h.state.currentItemArrowType).toBe("round"); // default
    
    Keyboard.keyPress(KEYS.B);
    expect(h.state.currentItemArrowType).toBe("elbow");
    
    Keyboard.keyPress(KEYS.B);
    expect(h.state.currentItemArrowType).toBe("sharp");
  });

  it("should support all arrow subtypes", async () => {
    const { h } = await render(<Excalidraw />);
    
    // Test sharp
    h.setState({ currentItemArrowType: "sharp" });
    UI.clickTool("doubleArrow");
    const sharpArrow = UI.createElement("doubleArrow", { x: 0, y: 0, width: 100, height: 0 });
    expect(sharpArrow.roundness).toBeNull();
    expect(sharpArrow.elbowed).toBe(false);
    
    // Test round
    h.setState({ currentItemArrowType: "round" });
    const roundArrow = UI.createElement("doubleArrow", { x: 0, y: 100, width: 100, height: 0 });
    expect(roundArrow.roundness).not.toBeNull();
    
    // Test elbow
    h.setState({ currentItemArrowType: "elbow" });
    const elbowArrow = UI.createElement("doubleArrow", { x: 0, y: 200, width: 100, height: 0 });
    expect(elbowArrow.elbowed).toBe(true);
  });
});
```

#### 2. Add serialization test
**File**: `packages/excalidraw/tests/data/restore.test.ts`
**Changes**: Verify double-headed arrows serialize/deserialize correctly

```typescript
describe("Double-headed arrow serialization", () => {
  it("should restore arrow with both arrowheads", () => {
    const arrowWithBothHeads = {
      type: "arrow",
      startArrowhead: "arrow",
      endArrowhead: "arrow",
      // ... other required props
    };
    
    const restored = restoreElements([arrowWithBothHeads], null);
    expect(restored[0].startArrowhead).toBe("arrow");
    expect(restored[0].endArrowhead).toBe("arrow");
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] All new tests pass: `yarn test`
- [ ] Existing tests still pass: `yarn test packages/element/tests/linearElementEditor.test.tsx packages/excalidraw/tests/flip.test.tsx packages/excalidraw/tests/data/restore.test.ts packages/element/src/__tests__/transform.test.ts`
- [ ] TypeScript compiles: `yarn typecheck`
- [ ] Linting passes: `yarn lint`

#### Manual Verification:
- [ ] Test coverage includes all new functionality

---

## Phase 6: Final Integration and Edge Cases

### Overview
Handle remaining integration points and edge cases.

### Changes Required:

#### 1. Update Actions.tsx toolIsArrow usage
**File**: `packages/excalidraw/components/Actions.tsx`
**Changes**: Ensure arrow-specific UI shows for doubleArrow tool

The `toolIsArrow` import from `@excalidraw/element` is already used. Verify it includes `doubleArrow` after Phase 3 changes.

#### 2. Verify ConvertElementTypePopup
**File**: `packages/excalidraw/components/ConvertElementTypePopup.tsx`
**Changes**: If element type conversion is supported, verify double-headed arrows can be converted to/from other linear types (they're just arrows, so should work automatically)

#### 3. Handle hasBackground/hasStrokeWidth helpers
**File**: `packages/excalidraw/scene/comparisons.ts` or similar
**Changes**: Verify doubleArrow is included in helper functions if needed

```typescript
// May need to add:
export const hasBackground = (type: ElementOrToolType) =>
  type === "rectangle" ||
  type === "ellipse" ||
  type === "diamond" ||
  type === "line" ||
  type === "arrow" ||
  type === "doubleArrow" ||
  type === "freedraw";
```

### Success Criteria:

#### Automated Verification:
- [ ] Full test suite passes: `yarn test`
- [ ] TypeScript compiles: `yarn typecheck`
- [ ] Linting passes: `yarn lint`
- [ ] Build succeeds: `yarn build`

#### Manual Verification:
- [ ] Draw double-headed arrow → both arrowheads visible
- [ ] Change arrowhead types via properties panel → works
- [ ] Copy/paste double-headed arrow → arrowheads preserved
- [ ] Undo/redo → arrowheads preserved
- [ ] Export to PNG/SVG → arrowheads visible
- [ ] Save to file and reload → arrowheads preserved
- [ ] Convert arrow types (sharp/round/elbow) → works
- [ ] Binding to shapes → works on both ends

---

## Testing Strategy

### Unit Tests:
- Tool selection via keyboard (B key)
- Tool selection via toolbar click
- Arrow creation with both arrowheads
- Arrow type cycling
- All arrow subtypes work with double-headed arrows

### Integration Tests:
- Serialization/deserialization preserves arrowheads
- Copy/paste preserves arrowheads
- Undo/redo preserves arrowheads

### Manual Testing Steps:
1. Open Excalidraw, press B → double-headed arrow tool selected
2. Draw an arrow → both ends have arrowheads
3. Press B again → arrow type cycles (check tooltip changes)
4. Draw elbow double-headed arrow → works correctly
5. Select arrow, change arrowhead styles in properties panel → works
6. Save file, reload → arrowheads preserved
7. Test on mobile toolbar → works

## Performance Considerations

None significant. This implementation reuses existing arrow infrastructure with no additional rendering or computation overhead.

## Migration Notes

No migration needed. This adds a new tool that creates standard arrow elements. Existing arrows are unaffected.

## References

- Arrow element type: [packages/element/src/types.ts#L320-328](packages/element/src/types.ts#L320-328)
- Arrow creation: [packages/element/src/newElement.ts#L487-525](packages/element/src/newElement.ts#L487-525)
- Toolbar SHAPES: [packages/excalidraw/components/shapes.tsx#L18-89](packages/excalidraw/components/shapes.tsx#L18-89)
- Tool type handling: [packages/excalidraw/components/App.tsx#L8625-8685](packages/excalidraw/components/App.tsx#L8625-8685)
- Hotkey handling: [packages/excalidraw/components/App.tsx#L4897-4920](packages/excalidraw/components/App.tsx#L4897-4920)
