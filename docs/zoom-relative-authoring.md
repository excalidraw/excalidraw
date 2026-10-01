# Zoom-relative authoring

draw.hypnodroid.com zooms from 0.1x to 1,000,000x. Upstream Excalidraw sizes everything the user makes in scene units: a medium stroke is 2 units wide, a new text is 20 units tall, a clicked sticky note is 250 units square. At 100x those are 200, 2,000 and 25,000 pixels on screen, so work done while zoomed in is drawn with a broom. This fork adds one setting that makes new work look the same on screen at any zoom, and one optional element field, `authoringScale`, that keeps the details drawn around that work the same too.

```tsx
<Excalidraw authoringUnits="screen" freedrawStrokeWidth={penWidth} />
```

With `authoringUnits="screen"`, every size the editor writes into a new or edited element is measured in screen pixels and divided by the zoom at that moment. Elements keep their scene sizes afterwards, so they zoom with the rest of the board. The default, `"scene"`, is upstream's behaviour. An element made at 100x is an ordinary element whose numbers happen to be small, plus `"authoringScale": 0.01`. Scene authoring, and screen authoring at 1x, write no `authoringScale`, so their elements are upstream's.

## The data shape

Two numbers carry the whole feature.

- **Authoring scale** (`getAuthoringScale(view)` in `packages/element/src/authoring.ts`). Scene units per authoring unit: 1 in scene units, `1 / zoom` in screen units. It is a function of the view (`AuthoringView = Pick<AppState, "zoom" | "authoringUnits">`), so anything holding an `AppState` can compute it. The editor multiplies it into every size it writes (stroke widths, font sizes, default sizes, the adaptive corner radius, nudge and paste offsets) and every scene-unit tolerance an interaction uses (eraser reach, binding distance, the multi-point commit zone, the drag threshold, the grid step).
- **Detail scale** (`getElementDetailScale(element)`, same file). How the fixed details that rendering and layout add around an element (arrowheads, dash patterns, rough.js wobble, label padding, binding gaps, sticky note chrome, minimum font sizes) scale with that element. It is the element's `authoringScale` field: the authoring scale it was made at, written at creation (`getAuthoringScaleField(view)`, spread into the constructor options by `App.getCurrentItemScale` and `convertToShape`) and omitted when it is 1. An absent field means 1, so every element upstream makes renders as upstream renders it.

The prop `authoringUnits` is mirrored into `AppState.authoringUnits` by `App.getDerivedStateFromProps`, the way `gridModeEnabled` and `viewModeEnabled` reach the element package. The prop stays the source of truth whatever restores or resets the state, and the field is never stored or exported (`APP_STATE_STORAGE_CONF`).

## Designs considered

| Design | Where authoring scale lives | Element details | Verdict |
| --- | --- | --- | --- |
| A. Prop plus an `App.getAuthoringScale()` method | `this.props` only | not handled | Rejected. Binding distance is decided in `packages/element` (`maxBindingDistance_simple` and 20 functions that pass `zoom` down to it), which never sees props; every one of them would need a new parameter anyway. |
| B. Prop mirrored into `AppState`, pure `getAuthoringScale(view)` | `AppState.authoringUnits` | detail scale derived from the element's stroke | **Chosen.** One pure function reachable from both packages; upstream's own pattern for editor modes; tolerance functions take the view (`AuthoringView`) instead of a bare zoom. |
| C. Create at scene size, then rescale the new element by `1/zoom` | nowhere | not handled | Rejected. Creation mixes sizes that come from the pointer (already scene units) with defaults (stroke, font, sticky size); a post-pass cannot tell them apart, and it would run after bound text and bindings have been laid out. |
| D. Store the authoring scale on each element | a new element field | exact | Adopted on top of B in 0.19.0-draw.5, once the owner approved the format change. |

Within B, three ways to size the fixed details:

| Detail sizing | Upstream elements | Screen-authored elements | Verdict |
| --- | --- | --- | --- |
| Leave the constants in scene units | unchanged | dashes turn solid, labels cannot fit their shape, sticky notes grow to 75 units, 1-unit bind floors, arrows under 0.1 units deleted | Rejected: broken, not merely off. |
| Scale by the element's stroke, `min(1, strokeWidth / thinnest named width)` | unchanged (scale 1) | exact at the thinnest width; at medium and bold the details are 2x and 4x their 1x size | Shipped in draw.4, replaced in draw.5. |
| Scale by a stored per-element scale (`authoringScale`) | unchanged (field absent) | exact at every width | **Chosen** (design D). |

The adaptive corner radius has an optional field in the format already (`roundness.value`), so a rounded rectangle made in screen mode stores `32 * authoringScale` there (`getRoundnessForShape`) and its corners match 1x exactly.

### The `authoringScale` field

- Written at creation only. Every tool creates through `App.getCurrentItemScale(type)`, which returns the stroke width and the field together, so a new element cannot get one without the other. Shapes recognised from a sketch (`convertToShape`) and flowchart nodes and their arrows (`flowchart.ts`, copied from the parent) carry it too.
- Edits keep it. The stroke width and font size pickers write screen-sized values but leave the field alone, so an element's details stay at the size they had where it was made.
- Duplicate, copy and paste, undo, collaboration (`reconcileElements`) and JSON and SVG export carry it as they carry any field.
- `restore` keeps a finite positive value and drops anything else, and drops 1, so absent is the only spelling of 1.
- Elements saved by draw.4 and earlier have no field, so their details render at scale 1: a thin arrow made at 100x by draw.4 gets a 1x-sized head. There is no migration, because the owner chose no backwards compatibility.
- Zoomed out below 1x the field is above 1, so the details of work made there grow with it and look on screen as they do at 1x.

Shapes (rectangle, diamond, ellipse, line, arrow, embeddable) are generated at their nominal scale (the element divided by its detail scale, with `authoringScale: 1`) and scaled back (`generateAtDetailScale` in `packages/element/src/shape.ts`). That single choke point covers every constant in the shape generators: arrowhead sizes, dash patterns, the wobble rough.js adds in absolute units, the small-shape roughness cutoffs and the adaptive radius cutoff. The output is scaled back op by op, together with the stroke width, fill weight and dash options, so hit testing and SVG export see the same shape the canvas draws.

## Inventory

`S` marks a size the editor writes (scaled by the authoring scale), `T` an interaction tolerance (authoring scale), `D` a fixed detail (detail scale), `=` a value already divided by the zoom upstream and left alone, `x` a value left in scene units, with the reason. Line numbers are on branch `zoom-relative`.

### Sizes the editor writes

| Where | What | Kind |
| --- | --- | --- |
| `excalidraw/components/App.tsx` `getCurrentItemScale` | the named width, or `freedrawStrokeWidth`, times the authoring scale, and the `authoringScale` field; every tool creates through it (App.tsx 8879, 8947, 9000, 9047, 9225, 9252, 9438; App.text.ts 605, 743; App.clipboard.ts 435; App.toolDrag.ts 65; actionBoundText.tsx 277) | S |
| `excalidraw/components/App.tsx:9405` `getCurrentItemFontSize` | `currentItemFontSize` (held in authoring units) times the scale; text tool, labels, paste, sticky notes and the text editor read it (App.text.ts 654, App.clipboard.ts 441, App.tsx 10819, wysiwyg/textWysiwyg.tsx 815) | S |
| `excalidraw/actions/actionProperties.tsx:730, 769` | stroke width picker applied to a selection, and which named width it shows | S |
| `excalidraw/actions/actionProperties.tsx:301, 1027` | font size picker applied to a selection; `currentItemFontSize` read back in authoring units | S |
| `element/src/convertToShape.ts:548` | shapes recognised from a sketch: stroke, roundness, the 60-unit arrow-or-line cutoff | S |
| `element/src/typeChecks.ts` `getRoundnessForShape`, used at App.tsx:9383, actionProperties.tsx:1776, convertToShape.ts:562 | adaptive corner radius stored as `roundness.value` | S |
| `excalidraw/components/App.tsx:10801`, `App.toolDrag.ts:56` | clicked or dragged-out sticky note, 250 | S |
| `excalidraw/components/App.tsx:9006` | embeddable's intrinsic size | S |
| `excalidraw/components/App.tsx:10701` | a tapped line or arrow on touch screens, 100 | S |
| `excalidraw/components/App.tsx:2888` | magic frame's iframe offset, 30 | S |
| `excalidraw/components/App.clipboard.ts:262, 452` | spacing of pasted embeddables (20) and pasted text lines (10) | S |
| `excalidraw/actions/actionDuplicateSelection.tsx:63` | duplicate offset, 10 | S |
| `excalidraw/components/App.tsx:5437` | arrow-key nudge, 1 and 5 | S |
| `excalidraw/components/App.tsx:1503` `getGridSizeAtZoom`, `common/src/points.ts` `getGridSizeAtScale` | grid step snapped to and drawn (`renderer/staticScene.ts` via `renderConfig.gridSize`): the grid size times whole powers of the major-line step, so it stays 20 to 100 px on screen and every level lines up with the coarser ones | S |
| `excalidraw/components/App.tsx:9040` | image placeholder, `100 / zoom` | = |
| frames (`FRAME_STYLE`) | stroke, radius and name are drawn divided by the zoom | = |

### Tolerances

| Where | What | Kind |
| --- | --- | --- |
| `excalidraw/eraser/index.ts:200-292` | eraser reach 5 px from a stroke's ink at any zoom; upstream's 2.25-unit floor (22,500 px at 10,000x) applies in scene units only | T |
| `element/src/binding.ts:140` `maxBindingDistance_simple(view)` and the functions that pass the view to it (binding.ts, collision.ts, utils.ts, elbowArrow.ts, arrows/focus.ts) | binding distance: 15 units at zoom 1 and above upstream, `15 / zoom` in screen mode | T |
| `excalidraw/components/App.tsx:7026, 7068, 9164` | multi-point commit zone, 8 | T |
| `excalidraw/components/App.tsx:1603` | click-versus-drag threshold measured in scene units, 10 | T |
| `excalidraw/components/App.tsx:8837` | hit floor for the common selection box, 1 | T |
| `excalidraw/animatedTrail.ts:120` | eraser and laser trails: the head size and the outline simplification (0.1) that the laser-pointer library applies in scene units | T |
| `excalidraw/components/App.tsx:6102` `getElementHitThreshold` | the 0.1-unit epsilon past a stroke | D |
| `element/src/shape.ts:1380` `getFreedrawMaxStrokeRadius` | the 3-unit end-cap allowance | D |
| `element/src/sizeHelpers.ts:73` | an arrow whose ends are within 0.1 units is dropped as invisible | D |
| `element/src/binding.ts:2104, 2187, 2239` | shortest arrow (10), smallest bindable shape (1) | D |
| `element/src/utils.ts:777` | elbow midpoint snap floor, 5 | D |
| snapping (`snapping.ts:48`), point handles (`linearElementEditor.ts:896`), transform handles, text auto-wrap threshold, focus points | already divided by the zoom | = |

### Details around an element

| Where | What | Kind |
| --- | --- | --- |
| `element/src/shape.ts:803` `generateAtDetailScale` | arrowhead sizes (`bounds.ts` `getArrowheadSize`), dash patterns (`shape.ts` `getDashArrayDashed/Dotted`, the non-solid +0.5 width), rough.js wobble and `adjustRoughness` cutoffs, the adaptive radius default, the elbow corner radius | D |
| `element/src/textElement.ts:399` `getBoundTextPadding` and its callers (textElement.ts, textMeasurements.ts, renderElement.ts, staticSvgScene.ts, resizeElements.ts, dragElements.ts, App.text.ts, App.tsx, actionBoundText.tsx) | label padding, 5; container sizes are rounded in units of the container's scale instead of whole scene units | D |
| `element/src/binding.ts:135, 1731` | binding gap, 5 | D |
| `element/src/stickyNote.ts` (223, 241, 284, 432, 491, 604, 701), `newElement.ts:211`, `resizeElements.ts:775`, `restore.ts:584, 926`, renderers | sticky note minimum size (75), padding (16), footer, font range (16 to 512) and step (2), shadow, edge, roughness, corner cap | D |
| `element/src/resizeElements.ts:310, 924, 1522` | smallest font a resize reaches, 1 | D |
| `element/src/flowchart.ts:174` | gap between flowchart nodes, 100 (the nodes copy their parent's size) | D |
| `element/src/bounds.ts:1011` `getElementPaintExtent` | how far paint reaches past the centre-line bounds, used by `getElementsOverlappingFrame` (frame export) and `isElementInViewport` (culling) | D |
| `element/src/renderElement.ts` `getCanvasPadding` | room around an element's cache bitmap, 20 or 40; in scene units a 220 by 130 px rectangle made at 100x got a 4,440 by 4,260 px bitmap, 64 MB, and a new one on each pointer move while it was drawn | D |

### Text far under a pixel

Chrome 154 measures and draws nothing for a canvas font much under a pixel: in the bench Chrome, "Hello world" keeps its width per pixel of font size down to 0.02px, thins out at 0.015px and is gone at 0.005px, while 20px text made at 1,000x is 0.02 units. `getFontSizeUpscale` (`common/src/utils.ts`) picks a power of two that brings the font to at least a pixel; text is measured (`textMeasurements.ts` `getLineWidth`) and drawn (`renderElement.ts` text and sticky note footer, `staticSvgScene.ts` text and footer) at that size and scaled back down. Fonts of a pixel or more are untouched.

### Left in scene units

| Where | Why |
| --- | --- |
| `element/src/elbowArrow.ts:112` `BASE_PADDING` and the routing constants | Elbow arrows route around shapes with 40-unit paddings. Scaling the router is its own change; the drawn corner radius already scales. |
| `element/src/perfectFreehand.ts:311` | A single-point freedraw stroke gets a synthetic neighbour 1 unit away, so a tap at depth draws a short line. draw's ink layer commits pen and mouse strokes itself. |
| `element/src/binding.ts:887` | Orbit-mode binding snaps its focus point to the raw `gridSize`, not the zoom's grid step. |
| `excalidraw/components/ConvertElementTypePopup.tsx:863` | Converting a shape's type gives it the default adaptive radius without a `value`. |
| `element/src/cropElement.ts:31` | Image crops stop at 10 units. |
| `excalidraw/components/App.tsx:11794` | A loaded image is capped at the viewport height in pixels, not divided by the zoom. |
| `TEXT_MAX_WRAP_WIDTH` (App.text.ts) | The 800-unit wrap cap only binds below 1x; above it the viewport width wins. |

## Remaining differences on screen

- An element whose stroke width is changed with the picker at a zoom other than the one it was made at keeps the details of its original zoom, so its head or dashes are no longer in proportion to the new stroke.
- The eraser trail's corner smoothing reads pointer speed in scene units inside the laser-pointer library, so its outline differs by up to about a third between zooms.
- SVG export with a reduced `precision` rounds coordinates to a fixed number of decimals, which flattens anything drawn at depth. Unchanged here.

## Open decisions

- Whether the stroke width picker should rewrite `authoringScale` to the current zoom. Doing so would also change label padding, so bound text would need laying out again.
- Whether the elbow arrow router and the single-point freedraw stroke should scale too.

## Tests

- `packages/excalidraw/tests/zoomRelativeAuthoring.test.tsx`: at zoom 1, 100 and 10,000 in screen mode, each tool (rectangle, ellipse, diamond, arrow, line, frame, freedraw, text, labelled shape, sticky note) makes an element of the same on-screen size, stroke and font; the corner radius matches, and at thin, medium and bold widths so do the arrowhead, the dash pattern and the label padding; the stroke width and font size pickers apply screen sizes; the eraser takes a stroke 3 px away and leaves one 30 px away; a click 4 px off a shape selects it and one 20 px off does not; an arrow ending 8 px from a shape binds and one ending 40 px away does not; the grid stays 20 to 100 px on screen and nests; the eraser trail keeps its size. In scene mode, new elements keep upstream's scene sizes at any zoom.
- The same file: a medium arrow made at 100x keeps its head through JSON export and restore and through duplication; `restore` drops an invalid `authoringScale`; a rectangle made at 100x or 10,000x is cached in a bitmap no bigger than it is on screen plus 20 px a side, and moving it reuses that bitmap.
- `packages/excalidraw/tests/freedrawStrokeWidth.test.tsx`: the pen width prop in both units.
- `packages/element/tests/paintExtent.test.ts`: a thick stroke whose ink, not its centre line, crosses a frame or the viewport edge is exported with the frame and counted as visible.
