# Challenge: Implement a Lasso Selection Tool

## Repo Orientation

This is **Excalidraw**, an open-source collaborative whiteboard. It's a TypeScript/React monorepo.

- **Build**: `yarn build`
- **Typecheck**: `yarn test:typecheck`
- **Test**: `yarn vitest run` (use `--run` to avoid watch mode)
- **Key package**: `packages/excalidraw/` — core editor logic

The project already has a **selection tool** (click/drag rectangle to select elements) and an **animated trail system** (`animated-trail.ts`) used by the laser pointer and eraser tools. Your task is to add a new selection mode.

## Task

Implement a **lasso selection tool** that lets users draw a freehand loop around elements to select them. When the user drags with the lasso tool active, an animated dashed trail follows their cursor. When they release, any elements enclosed by or intersecting with the lasso path are selected.

### Requirements

1. **Core lasso logic** — Create a `LassoTrail` class that extends the existing `AnimatedTrail`:
   - `startPath(x, y)` — begin a new lasso path
   - `addPointToPath(x, y)` — extend the path as the user drags
   - `endPath()` — finalize selection when the user releases
   - The trail should render as a dashed line with a subtle fill

2. **Selection algorithm** — Implement element selection based on the lasso path:
   - **Enclosure test**: elements fully inside the lasso polygon are selected
   - **Intersection test**: elements whose edges cross the lasso path are selected
   - Handle special cases: text elements should select their container, frames should select as a unit (not children individually), groups should select together

3. **Tool registration** — Register "lasso" as a tool type:
   - Add to the tool type constants and type definitions
   - Add a toolbar button with an appropriate icon (lasso/loop shape)
   - Support both desktop and mobile toolbars
   - Add to the command palette

4. **Keyboard shortcut** — Add a toggle: when the selection tool is active, Ctrl+Alt switches to lasso mode and back

5. **Integration** — Wire into the main App component:
   - Handle pointer down/move/up events for the lasso tool
   - Prevent element dragging while lasso selection is in progress
   - Support shift+drag to add to existing selection

### Acceptance Criteria

- Drawing a loop around elements selects them
- Elements partially intersecting the lasso path are selected
- Text elements select their container (not the text alone)
- Frame elements select as a unit
- Group members select together when any member is lassoed
- Shift+drag adds to existing selection
- The lasso trail animates smoothly with a dashed appearance
- Toolbar shows lasso as a selection mode option
- Typecheck passes
- Existing selection tool still works

## Hints

- Look at how `AnimatedTrail` works in `packages/excalidraw/animated-trail.ts` — your `LassoTrail` should extend it
- The laser pointer (`laser-trails.ts`) is a good reference for how to extend `AnimatedTrail`
- Element geometry helpers exist in `@excalidraw/math` — look for polygon and line segment utilities
- `getElementLineSegments` and `getElementBounds` are useful for hit testing
- The toolbar selection tool area in `Actions.tsx` is where you'd add the lasso option
- `TOOL_TYPE` in `packages/common/src/constants.ts` is where tools are registered
- `App.tsx` handles all pointer events — search for how `"selection"` tool pointer events work

## Out of Scope

- Do NOT modify the AnimatedTrail base class
- Do NOT change how the existing selection tool works
- Do NOT add undo/redo support for lasso (existing undo handles selection changes)
- Do NOT implement touch gestures beyond basic pointer events

## Difficulty

**Hard** — 2-4 hours

This involves geometry algorithms (polygon enclosure, line intersection), UI integration (toolbar, shortcuts), and understanding the existing selection architecture.

## Submission

Create a branch from this challenge branch, implement the lasso tool, and submit a PR.
