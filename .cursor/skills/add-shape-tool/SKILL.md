---
name: add-shape-tool
description: Adds a new Excalidraw polygon-like shape tool such as a pentagon or hexagon as a first-class tool and element. Use when implementing new shape tools, polygon tools, toolbar shape entries, canvas element types, bindable shape geometry, or restore/export support in Excalidraw.
---

# Add Shape Tool

## Objective

Add one concrete polygon-like shape, such as `hexagon`, as a first-class Excalidraw tool and element. Make it behave like the existing generic shapes: `rectangle`, `diamond`, and `ellipse`.

Default behavior unless the user says otherwise:

- `shapeId`: lowercase string literal, for example `hexagon`
- `ShapePascal`: PascalCase name, for example `Hexagon`
- `ElementType`: `Excalidraw${ShapePascal}Element`
- Fillable: yes
- Bindable: yes
- Text container: yes
- Desktop toolbar: yes
- Mobile toolbar shape picker: yes
- Numeric shortcut: no, do not renumber existing toolbar shortcuts
- Letter shortcut: choose an unused key; add it to `packages/common/src/keys.ts` if missing

Do not create a reusable polygon framework unless the user explicitly asks for it. Add one small shape-specific helper, such as `getHexagonPoints()`.

## Required Plan Before Editing

Before changing files, state the exact values:

- Shape id: `shapeId`
- Display label: `ShapePascal`
- Icon source or new icon name
- Shortcut key or `null`
- Whether it is fillable, bindable, and a text container
- Whether it is desktop, mobile, or both

Then say this implementation will touch only the specific file groups below.

## Exact Implementation Order

Follow this order. Do not skip ahead.

### 1. Tool And Type Surface

Update these first:

1. `packages/common/src/keys.ts`
   - If using a new letter shortcut, add it to `KEYS`.
   - Example: `N: "n"`.

2. `packages/common/src/constants.ts`
   - Add `TOOL_TYPE.shapeId: "shapeId"`.

3. `packages/excalidraw/types.ts`
   - Add `"shapeId"` to `ToolType`.

4. `packages/element/src/types.ts`
   - Add:
     ```ts
     export type ExcalidrawShapePascalElement = _ExcalidrawElementBase & {
       type: "shapeId";
     };
     ```
   - Add the element to `ExcalidrawGenericElement`.
   - If bindable, add it to `ExcalidrawBindableElement`.
   - If it can contain bound text, add it to `ExcalidrawTextContainer`.
   - If it should work as a flowchart node, add it to `ExcalidrawFlowchartNodeElement`.
   - Add it to `ConvertibleGenericTypes` if shape conversion should include it.

5. `packages/excalidraw/scene/types.ts`
   - Add `shapeId: Drawable;` to `ElementShapes`.

### 2. Toolbar, Icon, Labels

1. `packages/excalidraw/components/icons.tsx`
   - Add `ShapePascalIcon` near `RectangleIcon`, `DiamondIcon`, and `EllipseIcon`.
   - Use `createIcon(...)` and `tablerIconProps` when adding a Tabler-style shape icon.

2. `packages/excalidraw/components/shapes.tsx`
   - Import `ShapePascalIcon`.
   - Add a `SHAPES` entry after `ellipse` and before `arrow` unless the user specified another placement:
     ```ts
     {
       icon: ShapePascalIcon,
       value: "shapeId",
       key: KEYS.<LETTER> or null,
       numericKey: null,
       fillable: true,
       toolbar: true,
     },
     ```
   - Do not renumber `numericKey` values for existing tools.

3. `packages/excalidraw/components/Actions.tsx`
   - Inspect the `ShapesSwitcher` shortcut string.
   - If the new shape has a letter shortcut but no numeric shortcut, make sure it displays just the letter, not `N or null`.
   - Use this safe pattern:
     ```ts
     const shortcut = letter
       ? numericKey
         ? `${letter} ${t("helpDialog.or")} ${numericKey}`
         : letter
       : `${numericKey}`;
     ```

4. `packages/excalidraw/components/MobileToolBar.tsx`
   - Import `ShapePascalIcon`.
   - Add `{ type: "shapeId", icon: ShapePascalIcon, title: capitalizeString(t("toolBar.shapeId")) }` to `SHAPE_TOOLS`.
   - Add `"shapeId"` to `lastActiveGenericShape` type.
   - Add `activeTool.type === "shapeId"` to the sync `useEffect`.
   - Add `toolBar.shapeId` to the title ternary.
   - Add `type === "shapeId"` to `onToolChange`.

5. `packages/excalidraw/locales/en.json`
   - Add `toolBar.shapeId`.
   - Add `element.shapeId`.

6. `packages/excalidraw/components/HelpDialog.tsx`
   - Add the shortcut row if there is a keyboard shortcut.

7. `packages/excalidraw/components/ConvertElementTypePopup.tsx`
   - Import the element type and icon.
   - Add the element type to `ExcalidrawConvertibleElement`.
   - Add `"shapeId"` to `GENERIC_TYPES`.
   - Add `["shapeId", ShapePascalIcon]` to the generic `SHAPES` list.

### 3. Geometry Helpers

1. `packages/element/src/bounds.ts`
   - Import the new element type.
   - Add `getShapePascalPoints(element, offset = 0)`.
   - Return local points, not global points.
   - For a regular polygon, derive points from `element.width` and `element.height`.
   - If supporting offset, scale each point away from the local center.
   - Add rotated-bounds handling in `ElementBounds.calculateBounds`:
     - Map local points to global `element.x + x`, `element.y + y`.
     - Rotate around element center.
     - Return `getBoundsFromPoints(rotatedPoints)`.
   - Add line segment extraction in `getElementLineSegments`.

2. `packages/element/src/utils.ts`
   - Import `getShapePascalPoints`.
   - Add `deconstructShapePascalElement(element, offset = 0)`.
   - Return `[LineSegment<GlobalPoint>[], Curve<GlobalPoint>[]]`.
   - Build sides by converting local points to global points and linking each point to the next point, wrapping the final point to the first.
   - Cache using `getElementShapesCacheEntry()` and `setElementShapesCacheEntry()`.
   - Update `getSnapOutlineMidPoint()` to return side midpoints for the new shape.

3. `packages/utils/src/shape.ts`
   - Import `ExcalidrawShapePascalElement`.
   - Add it to the local `RectangularElement` union.
   - Add a branch in `getPolygonShape()` returning the rotated polygon points.

### 4. RoughJS Rendering

1. `packages/element/src/shape.ts`
   - Import `getShapePascalPoints`.
   - Add `"shapeId"` to `generateRoughOptions()` with rectangle/diamond/ellipse so background fill works.
   - Add a `_generateElementShape` case:
     ```ts
     case "shapeId": {
       const points = getShapePascalPoints(element);
       const shape: ElementShapes[typeof element.type] = generator.polygon(
         points as unknown as RoughPoint[],
         generateRoughOptions(element, false, isDarkMode),
       );
       return shape;
     }
     ```
   - If `canChangeRoundness()` includes the shape, implement rounded polygon rendering with a local path helper and `generator.path(...)`.
   - Add `"shapeId"` to `getElementShape()` with rectangle/diamond polygon shapes.

2. `packages/element/src/renderElement.ts`
   - Add `"shapeId"` to `drawElementOnCanvas()` with rectangle/diamond/ellipse.
   - Add `"shapeId"` to `renderElement()` with rectangle/diamond/ellipse.

3. `packages/excalidraw/renderer/staticSvgScene.ts`
   - Add `"shapeId"` to the rectangle/diamond/ellipse SVG branch.

4. `packages/excalidraw/renderer/interactiveScene.ts`
   - Import `deconstructShapePascalElement` and `getShapePascalPoints`.
   - Add `"shapeId"` cases wherever binding outlines switch on `diamond` and `ellipse`.
   - Draw each line segment using the deconstructed sides.
   - Add midpoint indicator logic using side midpoints.

### 5. Hit Testing, Distance, Binding

1. `packages/element/src/collision.ts`
   - Import `ExcalidrawShapePascalElement`, `getShapePascalPoints`, and `deconstructShapePascalElement`.
   - Add `"shapeId"` to `intersectElementWithLineSegment()`.
   - Implement `intersectShapePascalWithLineSegment()` by inverse-rotating the segment, testing against deconstructed sides, then rotating intersections back.
   - Add shape points to `isBindableElementInsideOtherBindable()` corner-point logic.

2. `packages/element/src/distance.ts`
   - Import the new element type and deconstructor.
   - Add `"shapeId"` to `distanceToElement()`.
   - Implement distance as the minimum `distanceToLineSegment()` over the deconstructed sides after inverse rotation.

3. `packages/element/src/typeChecks.ts`
   - Add `"shapeId"` to:
     - `isBindableElement()` if bindable
     - `isTextBindableContainer()` if text container
     - `isExcalidrawElement()`
     - `isFlowchartNodeElement()` if flowchart node
     - `isEligibleFrameChildType()`
   - Add to `isUsingProportionalRadius()` if the shape uses proportional rounded corners.
   - Do not add polygon shapes to `isRectangularElement()` unless they should be treated as true rectangles.

4. `packages/element/src/comparisons.ts`
   - Add `"shapeId"` to `hasBackground`, `hasStrokeColor`, `hasStrokeWidth`, and `hasStrokeStyle`.
   - Add it to `canChangeRoundness` only if rounded geometry is implemented.

5. `packages/element/src/binding.ts`
   - Add the shape to `ShapeType`.
   - Add the shape to `getShapeType()`.
   - Add `SHAPE_CONFIGS.shapeId`.
   - Add a `getBindingSideMidPoint()` branch returning sensible side midpoints, rotated around the element center.

6. `packages/element/src/textElement.ts`
   - Add `"shapeId"` to `VALID_CONTAINER_TYPES` if text container.
   - Add `getContainerCoords()` offsets if the usable text area differs from a rectangle.
   - Add shape-specific handling in:
     - `computeContainerDimensionForBoundText()`
     - `getBoundTextMaxWidth()`
     - `getBoundTextMaxHeight()`

7. `packages/element/src/transform.ts`
   - Add `"shapeId"` to the generic element creation cases for skeleton conversion and bound start/end elements.

8. `packages/excalidraw/snapping.ts`
   - Add `"shapeId"` to non-linear snappable tool logic.
   - Add it to any diamond/ellipse midpoint branch when the shape should snap by outline midpoints.

### 6. Restore And App Creation

1. `packages/excalidraw/data/restore.ts`
   - Add `"shapeId": true` to `AllowedExcalidrawActiveTools`.
   - Add `"shapeId"` to the generic restore switch.

2. `packages/excalidraw/components/App.tsx`
   - Add `"shapeId"` to the `getCurrentItemRoundness()` element type union.

### 7. Test Helpers

1. `packages/excalidraw/tests/helpers/api.ts`
   - Add `"shapeId"` to the generic `newElement()` branch.

2. `packages/excalidraw/tests/helpers/ui.ts`
   - Import `ExcalidrawShapePascalElement`.
   - Map `T extends "shapeId"` to `ExcalidrawShapePascalElement`.

## Required Tests

Add focused tests:

1. `packages/excalidraw/tests/dragCreate.test.tsx`
   - Add an `it("shapeId", ...)` next to rectangle/diamond/ellipse.
   - Click toolbar by `getByToolName("shapeId")`.
   - Drag from `(30, 20)` to `(60, 70)`.
   - Assert one element with `type`, `x`, `y`, `width`, and `height`.

2. `packages/excalidraw/tests/multiPointCreate.test.tsx`
   - Add an `it("shapeId", ...)` to the non-linear short-drag removal group.
   - Assert no element is created for the short drag.

3. `packages/excalidraw/tests/regressionTests.test.tsx`
   - Add the shape to `draw every type of shape`.
   - Add shortcut coverage to the key selection table if there is a shortcut.
   - Update snapshots only when this intentionally changes snapshot output.

## Verification Commands

Use non-watch commands:

```bash
yarn test:typecheck
yarn test:app --run packages/excalidraw/tests/dragCreate.test.tsx packages/excalidraw/tests/multiPointCreate.test.tsx
yarn test:app --run packages/excalidraw/tests/regressionTests.test.tsx
```

If regression snapshots intentionally change:

```bash
yarn test:app --run -u packages/excalidraw/tests/regressionTests.test.tsx
```

Then rerun:

```bash
yarn test:typecheck
```

## Final Manual Checklist

Before finishing, verify:

- The desktop toolbar shows the new shape with the expected label and shortcut.
- The mobile shape picker includes the new shape.
- `activeTool.type` becomes `"shapeId"` after toolbar click and shortcut press.
- Drag-create produces an element with `type: "shapeId"`.
- Fill, stroke, roughness, rounded edges, selection, hit testing, snapping, binding, bound text, restore, SVG export, and undo/redo follow the generic-shape expectations.
- No unrelated refactors or renumbered numeric shortcuts were introduced.
