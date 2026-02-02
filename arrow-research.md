# Linear Elements Implementation in Excalidraw

## Core Data Structures

Linear elements (lines and arrows) in Excalidraw use a hierarchical type system:

**Base Type - ExcalidrawLinearElement**: The foundation for both "line" and "arrow" types, containing:

- `points`: Array of `LocalPoint[]` coordinates defining the shape
- `startBinding` and `endBinding`: `FixedPointBinding | null` for connecting to other elements
- `startArrowhead` and `endArrowhead`: `Arrowhead | null` for arrow decorations types.ts:320-328

**ExcalidrawLineElement**: Extends the base type with a `polygon` boolean property to support closed shapes. types.ts:330-334

**ExcalidrawArrowElement**: Extends the base type with an `elbowed` boolean property to distinguish arrow types. types.ts:342-346

**ExcalidrawElbowArrowElement**: A specialized arrow type with `elbowed: true` and additional properties:

- `fixedSegments`: Stores segments that maintain fixed positions
- `startIsSpecial` and `endIsSpecial`: Flags for handling segment visibility during orientation changes types.ts:348-372

### Coordinate System

Linear elements use a **local coordinate system** where the first point must always be at `[0, 0]`. This normalization invariant is enforced throughout the codebase. linearElementEditor.ts:96-115

## Arrow Subtypes Implementation

The three arrow types are distinguished by their properties:

**Sharp Arrow**: `elbowed === false` and `roundness === null` (straight line segments) typeChecks.ts:138-142

**Curved Arrow**: `elbowed === false` and `roundness !== null` (uses ROUNDNESS.PROPORTIONAL_RADIUS) typeChecks.ts:144-150

**Elbow Arrow**: `elbowed === true` (orthogonal routing with A* pathfinding) typeChecks.ts:123-127

The function `getLinearElementSubType` determines which subtype an element belongs to: typeChecks.ts:358-371

### Arrow Type Conversion

Users can switch between arrow types using the `actionChangeArrowType` action. When converting:

- To **round arrow**: Sets `roundness` to `ROUNDNESS.PROPORTIONAL_RADIUS`
- To **elbow arrow**: Sets `elbowed: true`, resets angle to 0, recalculates bindings, and routes the arrow
- To **sharp arrow**: Sets `roundness: null` and `elbowed: false` actionProperties.tsx:1733-1895

### Elbow Arrow Routing

Elbow arrows use an __A_ pathfinding algorithm_* to route around obstacles. The implementation includes:

- Grid generation at bounding box intersections
- Manhattan distance heuristic
- Bend penalty to create aesthetically pleasing routes
- Prevention of backward routing to avoid overlapping segments elbowArrow.ts:907-950

## Arrow Direction Implementation

Arrow direction is determined by the **start and end arrowhead properties**:

- `startArrowhead`: Controls the arrowhead at the beginning of the arrow
- `endArrowhead`: Controls the arrowhead at the end of the arrow newElement.ts:458-485

For arrow elements specifically: newElement.ts:487-525

The direction flows from the first point in the `points` array to the last point. Arrowheads support 12 different styles including arrow, bar, dot, circle, triangle, diamond, and crowfoot variants. types.ts:310-318

## Rendering Logic

### Shape Generation

The rendering system uses **rough.js** to generate hand-drawn style shapes. The main entry point is `ShapeCache.generateElementShape`: shape.ts:118-163

### Line and Arrow Rendering

In `_generateElementShape`, lines and arrows are handled together with type-specific logic:

1. **Elbow arrows**: Use `generateElbowArrowShape` to create orthogonal paths
2. **Sharp arrows/lines**: Use `linearPath` or `polygon` (for filled shapes)
3. **Curved arrows/lines**: Use `curve` method with roundness applied shape.ts:750-834

### Arrowhead Rendering

Arrowheads are added to the shape array after the main line/arrow path is generated: shape.ts:299-318

### Canvas Drawing

The actual drawing to canvas happens in `drawElementOnCanvas`, which uses the RoughCanvas to render the generated shapes: renderElement.ts:403-413

## Editing Behavior

### Linear Element Editor

The `LinearElementEditor` class manages all point-level editing operations: linearElementEditor.ts:124-150

### Point Handle Rendering

During editing, visual handles are rendered at each point. For elbow arrows, only start and end point handles are shown (not intermediate waypoints): interactiveScene.ts:799-864

### Special Elbow Arrow Segment Handles

Elbow arrows also show segment midpoint handles for dragging segments: interactiveScene.ts:866-890

## Key Files and Functions

### Core Files

1. **`packages/element/src/types.ts`** - Type definitions for all linear element types
2. **`packages/element/src/typeChecks.ts`** - Type guard functions (isLinearElement, isArrowElement, isElbowArrow, etc.)
3. **`packages/element/src/linearElementEditor.ts`** - Point editing logic and coordinate transformations
4. **`packages/element/src/elbowArrow.ts`** - Elbow arrow routing and A* pathfinding implementation
5. **`packages/element/src/shape.ts`** - Shape generation with rough.js
6. **`packages/element/src/renderElement.ts`** - Canvas rendering logic
7. **`packages/element/src/newElement.ts`** - Factory functions for creating linear elements
8. **`packages/element/src/bounds.ts`** - Bounding box and arrowhead point calculations
9. **`packages/excalidraw/renderer/interactiveScene.ts`** - Interactive editing handles rendering
10. **`packages/excalidraw/actions/actionProperties.tsx`** - Actions for changing arrow types and properties

### Key Functions

- **`newLinearElement` / `newArrowElement`** - Create new linear/arrow elements
- **`ShapeCache.generateElementShape`** - Generate rough.js shapes
- **`_generateElementShape`** - Low-level shape generation
- **`drawElementOnCanvas`** - Render elements to canvas
- **`renderLinearPointHandles`** - Render editing point handles
- **`getLinearElementSubType`** - Determine arrow subtype
- **`updateElbowArrowPoints`** - Update elbow arrow routing
- **`routeElbowArrow`** - A* pathfinding for elbow arrows
- **`getArrowheadPoints`** - Calculate arrowhead positions
- **`LinearElementEditor.getPointsGlobalCoordinates`** - Convert local to global coordinates
- **`LinearElementEditor.handlePointDragging`** - Handle point drag operations

## Notes

- The points array in linear elements always maintains normalization with the first point at `[0, 0]`
- Elbow arrows store only start and end points; intermediate waypoints are calculated dynamically
- The binding system uses a separate normalized coordinate system (fixedPoint in [0-1] range) distinct from the points array
- Arrow direction is purely visual, controlled by arrowhead placement rather than point order
- The dual-canvas architecture separates static element rendering from interactive overlays like point handles

# UI Buttons for Adding Line and Arrow Elements

## Mobile Toolbar

The mobile toolbar implementation defines line and arrow tools in the `LINEAR_ELEMENT_TOOLS` constant, which contains configuration for both arrow and line tools with their icons and titles: MobileToolBar.tsx:75-82

These tools are then rendered as a `ToolPopover` component that allows users to switch between arrow and line modes: MobileToolBar.tsx:299-326

## Desktop Toolbar

The desktop toolbar uses the `SHAPES` array which defines all toolbar tools including arrow and line, with their associated icons and keyboard shortcuts: shapes.tsx:18-89

The `ShapesSwitcher` component renders these tools as buttons in the main toolbar: Actions.tsx:1041-1150

# Hotkeys Assigned to Line and Arrow Buttons

## Primary Keyboard Shortcuts

- **Arrow tool**: `A` key or numeric `5`
- **Line tool**: `L` key or numeric `6`

These shortcuts are documented in the help dialog: HelpDialog.tsx:163-170

## Keyboard Event Handling

The keyboard shortcuts are handled in the `handleKeyDown` method using the `findShapeByKey` function: App.tsx:4875-4911

## Arrow Type Cycling

When the arrow tool is already active and you press `A` again, it cycles through arrow types (sharp → round → elbow): App.tsx:4895-4904

## Editing Line/Arrow Points

To edit line/arrow points, use `Ctrl+Enter` (or `Cmd+Enter` on Mac): HelpDialog.tsx:191-193

The corresponding action is defined in: actionLinearEditor.tsx:29-110

# Serialization and Deserialization

## Type Definitions

Line and arrow elements share a common base type `ExcalidrawLinearElement`: types.ts:320-328

Line elements extend this with a `polygon` property: types.ts:330-334

Arrow elements extend this with an `elbowed` property: types.ts:342-346

## Element Creation (Serialization)

The `newLinearElement` function creates new line elements: newElement.ts:458-485

The `newArrowElement` function creates new arrow elements with support for arrowheads and elbow arrows: newElement.ts:487-525

## Deserialization (Loading)

When loading saved data, the `restoreElement` function handles deserialization of line elements: restore.ts:403-437

Arrow elements have more complex restoration logic that includes repairing bindings and normalizing points: restore.ts:438-492

## Binding Repair

Arrow bindings to other elements are repaired during deserialization to handle legacy formats and ensure consistency: restore.ts:131-237

# Notes

The serialization format includes all properties defined in the type definitions, including `points` (array of coordinates), `startBinding`/`endBinding` (for arrows connected to other elements), `startArrowhead`/`endArrowhead` (arrowhead styles), and element-specific properties like `polygon` for lines and `elbowed` for elbow arrows. The deserialization process includes migration of old data formats, point normalization, and binding repair to ensure backward compatibility.