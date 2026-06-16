# Sticky Notes — Implementation Spec

A dedicated **Sticky Note** primitive for Excalidraw: a first-class, always-filled text
container whose text auto-fits its box (font shrinks on overflow; the box hugs its content
vertically). This document is the authoritative design. All `file:line` references are against
the `master` working tree and may drift as the code evolves — confirm before relying on a line
number.

---

## 1. Requirements

- **New tool** in the toolbar, initially in the **"more tools"** dropdown (desktop + mobile).
- A sticky note is a **new element type `"stickynote"`**, modeled as a rounded-rectangle text
  container that reuses the existing bound-text machinery.
- **Always has a background** — it is always filled (a dedicated, non-sketchy render style)
  and never stores a transparent background.
- **Text fits the box + padding:**
  - Fixed width; text wraps to the width.
  - On overflow, the **font shrinks** until the text fits (down to a minimum).
  - When the text needs less vertical space than the box, the box **shrinks on the Y axis**
    down to hug the content (down to a minimum height). **Empty** text is the one exception:
    with no content to hug, the box keeps its `maxHeight` size, so a freshly placed note stays
    the square it was drawn as (see §5.4/§6).
  - If the text still overflows at the minimum font size, the box **grows** vertically to keep
    all text visible — it is never clipped.
  - All resizing happens **in the same render frame** as the edit — no layout-shift flash —
    on typing, paste, programmatic changes, and restore.
- **Font size is user-pickable:** the picker sets a per-element maximum; auto-fit never grows
  the font past it.
- Reuse existing helpers; consolidate the text-geometry helpers where it produces a cleaner
  foundation. **No new dependencies.**

---

## 2. Approach at a glance

1. **Type:** `ExcalidrawStickyNoteElement` (`type: "stickynote"`), a *rectanguloid text
   container*. It is added to the existing `rectangle`/rectanguloid `case` lists across
   geometry code (bounds, collision, shape, transform, resize), so it inherits rectangle
   geometry; only **rendering** and **text-sizing** are bespoke. The `assertNever` exhaustive
   switches surface *many* of the sites to touch at compile time, but several critical sites
   are boolean OR-chains or default-returning switches that the compiler will **not** flag —
   these are tracked by an explicit checklist (§3.3) so none is missed.

2. **One bound `text` element** per sticky, using the existing `containerId` / `boundElements`
   linkage, `textWysiwyg` editor, and recompute helpers. A sticky is just a container with a
   different text-sizing policy.

3. **One layout helper** —
   `computeStickyNoteTextLayout(container, originalText, …) → { textUpdates, containerUpdates }`
   — is the single source of truth for the font-fit + Y-shrink. It is invoked from the one
   canonical bound-text recompute path so typing, paste, programmatic edits, restore, and
   resize all produce identical results.

4. **Same-frame** sizing is guaranteed by computing the fit and issuing all `mutateElement`
   calls **synchronously inside the triggering handler**. Excalidraw batches all mutations in a
   handler into one React commit → one paint. The work is never deferred to `rAF`/effects.

5. **Always-filled** is a *data* invariant (a sticky always stores a concrete, non-transparent
   `backgroundColor`), enforced at construction and at every **user-reachable / programmatic write
   path** (generic actions, paste-styles, restore, the skeleton API), because hit-testing and
   binding gate on `!isTransparent(backgroundColor)`. Raw `scene.mutateElement` (`Scene.ts:411`)
   and the **public imperative API** (`mutateElement`/`updateScene`) are **not** auto-normalized;
   the invariant is best-effort at that boundary (normalize via `restore`) — see §3.5.

---

## 3. Data model

### 3.1 Sticky note element
`packages/element/src/types.ts`:
```ts
export type ExcalidrawStickyNoteElement = _ExcalidrawElementBase &
  Readonly<{
    type: "stickynote";
    /** font-shrink threshold; set whenever the box height is finalized (§6) */
    maxHeight: number;
  }>;
```
The base type already carries everything else a sticky needs (`backgroundColor`, `fillStyle`,
`roundness`, `boundElements`, `angle`, `opacity`, …). Add the type to the `ExcalidrawElement`
union and to the grouping types `ExcalidrawRectanguloidElement`, `ExcalidrawBindableElement`,
and `ExcalidrawTextContainer`. Do **not** add it to `ExcalidrawGenericElement` — a sticky is
constructed via its own `newStickyNoteElement` (not `newElement`), so keeping it out of the
generic union prevents it from silently flowing through generic-element code paths (§5.2).

`maxHeight` is the only new container field. It is the **font-shrink threshold**: the font is
the largest size (≤ the user's base) whose wrapped text fits within `maxHeight`, shrinking when
content would exceed it. The rendered box height always hugs its content at that fitted font —
shrinking below `maxHeight` for short text, and growing past it only once the font has bottomed
out at `MIN` (text is never clipped). `maxHeight` is (re)set whenever the box height is
finalized — drag-to-size end, click-to-place, and vertical resize — never at `0×0` construction.
Because the box always re-hugs content at the fitted font, **vertical resize is a font-ceiling
control, not a free box height** (resize contract in §6), and when the text is **empty** there is
nothing to hug so the box is held at `maxHeight` (§5.4/§6) rather than collapsing to one line.

### 3.2 Per-element base font size
The font is user-pickable, so the bound `text` element's `fontSize` always holds the
**auto-fitted** size (reusing all measurement/render code unchanged), and the user's chosen
**maximum** is a new optional field:
```ts
// ExcalidrawTextElement — additive, optional; only meaningful for sticky-bound text
fontSizeMax?: number;
```
`newTextElement` (`newElement.ts:240`) currently has neither the opt nor the prop, so add an
optional `fontSizeMax?` to its opts and to `textElementProps`; otherwise the seed below would
be dropped at construction.

**Initialization rule (single source of truth):** `startTextEditing` normally seeds new
bound-text `fontSize` from `currentItemFontSize` (`App.tsx:6228`). For stickies:
- **New text created for a sticky:** `fontSize = fontSizeMax = STICKY_NOTE_DEFAULT_FONT_SIZE`
  (ignore `currentItemFontSize`, so stickies have a consistent base).
- **Binding existing text** to a sticky (paste/programmatic): `fontSizeMax = existing fontSize`.
- **Restore:** preserve `fontSizeMax` only if present; never default it for other text.
- **Unbinding** from a sticky (`actionUnbindText`, `actionBoundText.tsx:83`, which leaves text
  fields intact) must **clear `fontSizeMax`**, so it never leaks onto the now-free text element.
- `fontSizeMax` is clamped to `≥ STICKY_NOTE_MIN_FONT_SIZE` **and snapped to
  `STICKY_NOTE_FONT_STEP`** wherever it is written (`setStickyBaseFontSize`, restore) — snapping
  keeps `MAX` on the same grid the fit searches, so the user's chosen max is actually reachable.
  Otherwise an odd `fontSizeMax` (the relative font actions do `Math.round(fontSize * 1.1)`, which
  yields odd sizes) would never be hit: the largest snapped fit lands one step below it. The
  layout still uses `MAX = max(MIN, fontSizeMax ?? fontSize)` defensively, so a stray sub-`MIN`
  value can never invert the `[MIN, MAX]` range.
- Everywhere `fontSizeMax` is read, resolve `fontSizeMax ?? fontSize`.

### 3.3 Type guards & membership checklist
Add `isStickyNoteElement` to `typeChecks.ts`. Then `"stickynote"` must be added to a mix of
exhaustive switches (compiler-flagged) **and** boolean OR-chains / default-returning switches
(compiler-silent — silently wrong if missed). Explicit checklist:

**Compiler-flagged (exhaustive `assertNever` switches):**
- `typeChecks.isExcalidrawElement` (`:244`).

**NOT compiler-flagged — must add manually:**
- `comparisons.hasBackground` (`comparisons.ts:3`) — **critical**: if omitted,
  `hasBackground("stickynote")` is `false`, breaking the always-fill invariant *and* body
  hit-testing (`shouldTestInside`/binding gate on it). **`hasStrokeColor`: return `false` for
  `"stickynote"` in v1** — a sticky is a flat fill with no separate border/stroke color, so the
  stroke-color control is hidden (§8.2) and the flat render (§4) emits fill only. (A 1px border is
  deferred polish behind a flag; flipping `hasStrokeColor` to `true` is the single switch that
  re-enables the stroke pipeline if one is added.)
- `typeChecks.isTextBindableContainer` (`:230`), `isBindableElement`, `isRectangularElement`
  (`:214`, binding distance), `isEligibleFrameChildType` (`:396`, so stickies can live in
  frames) — all boolean/`default`-switch.
- `textElement.VALID_CONTAINER_TYPES` (`:436`, used by `isValidTextContainer`) — **gates
  re-entering text editing on a selected container** (`App.tsx:5888`); a selected sticky with
  bound text won't re-open the editor if this is missed.
- `bounds._isRectanguloidElement` (rectanguloid grouping for bounds/segments).
- `shape.getElementShape` (`:1074`, default switch → add to the polygon group),
  `_generateElementShape`, `generateRoughOptions` (rectangle arm).
- `collision.intersectElementWithLineSegment` (rectangle arm) — `shouldTestInside` follows
  from `hasBackground` once that's set.
- Canvas render switch (`renderElement.ts:881`) + `drawElementOnCanvas` (`:394`).
- SVG render switch (`staticSvgScene.ts:142`).
- `typeChecks.isUsingAdaptiveRadius` (`:308`) — `getDefaultRoundnessTypeForElement` returns
  `ADAPTIVE_RADIUS` only for types listed here; omit and a sticky gets `null` roundness (square
  corners) despite §3.5 (alternative: set the roundness explicitly in `clampStickyNoteProps`).
- `distance.distanceToElement` (`distance.ts:29`) — rectangle-arm type switch feeding
  collision/binding distance; a missing `"stickynote"` arm returns `undefined`, breaking
  arrow-binding and body-distance (`collision.ts`/`binding.ts` callers).
- `resizeElements.ts` — bound-text `fontSize` is scaled **directly** in `resizeSingleElement`
  (aspect/Shift, `~:914`) and `resizeMultipleElements` (multi-select, `~:1491`), *before*
  `handleBindTextResize`; for stickies these must scale `fontSizeMax` instead (§6).
- `transform.convertToExcalidrawElements` construction switch (`transform.ts:529`) — no
  `"stickynote"` case today; an unhandled type hits `assertNever` and passes through unconstructed
  (§5.5 — add a case or explicitly mark the skeleton API unsupported for v1).

**Deliberately excluded:** `isFlowchartNodeElement` (`:274`) and the "convert shape type" set —
a sticky is not a flowchart node and does not convert to a generic shape.

### 3.4 Constants & constructor
`packages/common/src/constants.ts`:
```ts
export const STICKY_NOTE_MIN_FONT_SIZE = 8;       // auto-fit floor
export const STICKY_NOTE_DEFAULT_FONT_SIZE = 28;  // base for new sticky text (§3.2)
export const STICKY_NOTE_FONT_STEP = 2;           // snap; avoids fractional sizes
export const DEFAULT_STICKY_NOTE_SIZE = 160;      // default square (click-to-place)
export const STICKY_NOTE_MIN_HEIGHT = 40;         // Y-shrink floor
export const DEFAULT_STICKY_NOTE_BG = "#ffd43b";  // concrete, non-transparent
```
Padding reuses `BOUND_TEXT_PADDING = 5` (`constants.ts:357`): the layout helpers
(`getBoundTextMaxWidth/Height`, `getContainerCoords`, `computeContainerDimensionForBoundText`)
hard-code it, so the fit algorithm uses the same value to keep layout, fit, and render in
agreement. (If roomier padding is wanted later, thread an optional
`boundTextPadding = BOUND_TEXT_PADDING` param through all four helpers and the fit.)

`packages/element/src/newElement.ts`:
```ts
export const newStickyNoteElement = (
  opts: { type: "stickynote" } & ElementConstructorOpts & { maxHeight?: number },
) => {
  const base = _newElementBase<ExcalidrawStickyNoteElement>("stickynote", opts);
  return clampStickyNoteProps({
    ...base,
    maxHeight: opts.maxHeight ?? (base.height || DEFAULT_STICKY_NOTE_SIZE),
  });
};
```
Like all generic elements, `_newElementBase` defaults `width`/`height` to `0`
(`newElement.ts:78`); the constructor does not itself produce a square. The default square
comes from the **click-to-place pointer-up path** (§5); **drag-to-size** sets the dimensions
during the drag. Treat the constructor's `maxHeight` as a placeholder that is overwritten when
the box height is finalized (note `0 ?? x` keeps `0`).

### 3.5 Invariant normalizer
`clampStickyNoteProps(el)` enforces the sticky invariants in one place and is applied wherever
a sticky can be created or mutated by a generic path (§3.4 constructor, restore, paste-styles,
property actions — see §8):
- `backgroundColor`: transparent → `DEFAULT_STICKY_NOTE_BG`.
- `fillStyle: "solid"`, `roughness: 0` (the flat sticky look).
- `roundness`: the existing rectangle default via `getDefaultRoundnessTypeForElement(el)`
  (= `{ type: ROUNDNESS.ADAPTIVE_RADIUS }`); no new roundness constant is needed — **but** that
  helper returns `ADAPTIVE_RADIUS` only for types in `isUsingAdaptiveRadius` (`typeChecks.ts:308`),
  which does **not** include `"stickynote"`. So either add `"stickynote"` to `isUsingAdaptiveRadius`
  (preferred — makes the default work everywhere) or set `{ type: ROUNDNESS.ADAPTIVE_RADIUS }`
  explicitly here; otherwise a sticky gets `null` roundness (square corners). Tracked in §3.3.

**Enforcement boundary (and what it deliberately excludes).** `clampStickyNoteProps` is applied at
the write paths a user or external caller normally reaches: construction (§3.4), restore (§3.6),
paste-styles and the generic property actions (§8.2), and — if skeleton support ships — the
transform API (§5.5). It is **not** wired into the lowest-level `scene.mutateElement`
(`Scene.ts:411`) nor into the **public imperative API** — `App.tsx:4643` is
`ExcalidrawImperativeAPI.mutateElement` (`types.ts:954`) and `updateScene` (`App.tsx:744/4571`)
injects elements straight into `replaceAllElements` with **no** normalization. So these are genuine
*public* entry points, not merely internal ones, and the invariant is explicitly **best-effort at
the imperative boundary**, with this contract:
- The documented normalization path is **`restore`/`restoreElements`** (which clamps stickies,
  §3.6). Integrators are expected to run untrusted/persisted elements through `restore` *before*
  `updateScene` — the same expectation that already holds for every other element invariant.
- Raw `ExcalidrawImperativeAPI.mutateElement` / `updateScene` callers that bypass `restore` are a
  **trusted boundary**: they must uphold the always-filled invariant themselves. We do **not**
  auto-clamp inside `updateScene` — it runs on every remote collab update (already normalized by the
  sender) and per-call clamping of the whole element array there is wasteful.
- A **dev-only assertion** (in `mutateElement` or a debug validate pass) warns when a `"stickynote"`
  is left with `isTransparent(backgroundColor)` or a non-solid `fillStyle`, so violations surface in
  development instead of as silent hit-test/binding breakage.

### 3.6 Restore
`packages/excalidraw/data/restore.ts`: an additive `case "stickynote"` mirroring the
`rectangle` case, then `clampStickyNoteProps` + default `maxHeight ?? height`. Add
`stickynote: true` to `AllowedExcalidrawActiveTools` (`:162`) so a persisted sticky tool
survives reload. In the `text` case, preserve `fontSizeMax` only if present.

**Do not re-fit a sticky mid-element-restore.** Restore is per-element and order-dependent, the
bound text and its container are restored independently, and there is no `scene` — so the
container half (`height`/`y`) cannot be safely applied from inside the text's `Object.assign`
(`restore.ts:~851`, which today refreshes *text* dims only). Instead:
1. Restore each element trusting its **stored** geometry (`width/height/maxHeight/fontSize/
   fontSizeMax`); do not recompute during the per-element pass.
2. Run a **single post-restore normalization pass** over the finished element set (where both
   container and bound text are present and mutable): for each sticky, run
   `computeStickyNoteTextLayout` and apply both halves. This is the only place the container is
   reconciled, avoiding cross-element mutation and ordering hazards.
3. **Async fonts:** `measureText` needs the web font loaded, which on cold load it is not, so the
   post-restore fit can bake a wrong height. `Fonts.onLoaded` (`fonts/Fonts.ts:104`) already runs
   on the `document.fonts` `"loadingdone"` event (`App.tsx:~3300`), iterates the affected elements
   to invalidate `ShapeCache`/`charWidth`, and calls `scene.triggerUpdate()` — **but it only
   repaints; it does not re-fit element geometry.** Extend that per-element loop so a sticky-bound
   text re-runs `computeStickyNoteTextLayout` (applying both halves) when its font loads. Without
   this hook a restored sticky measured with the fallback font keeps a wrong box until the next
   edit/resize.

   **History / collab mechanism of the font-load re-fit — be exact.** The public `mutateElement`
   (`mutateElement.ts:139`) **always** bumps `version`/`versionNonce`/`updated` and has no skip
   flag; collab keys its broadcast on `getSceneVersion` = Σ `element.version` (`Collab.tsx:944`), so
   *any* normal mutation here would raise the scene version and **broadcast**, and an
   `IMMEDIATELY`-captured change would also land in undo history. That is wrong for a font-load
   correction, which is **deterministic** from already-synced data (`originalText`, `fontSizeMax`,
   `W`, `maxHeight`) — every client recomputes the same result on its own font load. The correction
   must therefore be applied so that it:
   - **does not bump `version`/`versionNonce`** — keeping Σ version unchanged means
     `broadcastElements` (`Collab.tsx:944`) never fires, and a peer that has loaded the font and one
     that hasn't hold the *same* `version` (a derived-field difference that converges once both load
     it) rather than diverging at *different* versions;
   - **captures no history** — schedule as `CaptureUpdateAction.NEVER` (`store.ts`) → ephemeral
     increment only, never `history.record` (fonts loading is not an undoable user edit);
   - **emits no durable increment** — `onDurableIncrement` (history/collab) stays silent. The public
     `onChange` still fires on the repaint (it fires every render) but carries no version delta, so
     version-keyed consumers see nothing.
   This matches how `Fonts.onLoaded` already works (`Fonts.ts:128`): it mutates **no** element
   version — only invalidates `ShapeCache`/`charWidth` and calls `triggerUpdate()`. The sticky hook
   extends that same loop with a **version-preserving local write** of the fitted
   `text/fontSize/width/height` (and container `height/y`); since public `mutateElement` cannot skip
   the version bump, this needs a small version-preserving helper (assign-in-place + cache
   invalidate) kept local to the `onLoaded` path.
   **Fallback** if a version-preserving write is undesirable: do **not** mutate geometry on font load
   at all and re-fit lazily on the next interaction (where `mutateElement` bumps version naturally)
   — simplest and divergence-free, at the cost of a sticky showing its fallback-measured size until
   first interaction (more visible than for plain text, since a sticky's *stored* `fontSize`/`height`
   are what's wrong, not just glyph rasterization).

---

## 4. Rendering

**Canvas** — branch in `drawElementOnCanvas` (`renderElement.ts:387`, rectangle arm at `:394`)
for `case "stickynote"`: paint a **solid** rounded-rect fill with `roughness: 0` and **no
stroke** (`hasStrokeColor("stickynote") === false`, §3.3 — this is why the bespoke arm is needed
rather than the plain rectangle path, which would stroke a border). Add `"stickynote"` to the
rectangle arm of `_generateElementShape` and `generateRoughOptions` (`shape.ts`) so geometry and
`ShapeCache` invalidation are shared; override only the paint style.

**SVG export** — adding `"stickynote"` to `shape.ts` alone does **not** guarantee SVG parity,
because if the canvas path bypasses RoughJS for a flat fill the SVG path must do the equivalent.
Add an explicit `case "stickynote"` to the SVG shape switch (`staticSvgScene.ts:142`) that emits
a flat solid rounded-`<rect>` (no rough path), matching the canvas look.

Optional polish (behind a flag, pending a visual pass): subtle drop shadow / 1px darker border /
folded corner.

Because the background invariant is enforced at the data level (§3.5) and `hasBackground` lists
`"stickynote"` (§3.3), the stored color is never transparent and body hit-testing
(`collision.ts:82` `shouldTestInside`) and binding traversal (`collision.ts:~264`) work with no
special-casing.

Bound text renders as a separate element immediately after the container
(`staticScene.ts:357`, SVG `staticSvgScene.ts:757`) and is **never clipped** — the box always
grows to fit the text (§6), so no clip path is needed on any surface.

---

## 5. Tool, creation & lifecycle

### 5.1 Tool registration
- `ToolType` += `"stickynote"` (`excalidraw/types.ts:143`); `TOOL_TYPE` entry
  (`constants.ts:448`).
- Icon `stickyNoteToolIcon` (`components/icons.tsx`).
- **Desktop** dropdown: add an item + selection bool + trigger-icon branch in `Actions.tsx`
  (`:1218–1252`, mirroring `frame`).
- **Mobile** dropdown: add `"stickynote"` to the `extraTools` array (`MobileToolBar.tsx:158`)
  and its trigger-icon ternary.
- Optional `actions/actionStickyNote.ts` registering a `keyTest` shortcut, imported in
  `App.tsx` for the side-effecting `register()` (mirroring `actionFrame`).
- i18n `toolBar.stickynote` (`locales/en.json`).

### 5.2 Pointer creation
Reuse the generic drag-to-size flow but construct the sticky through its own factory — exactly
as `"embeddable"` is handled today. `createGenericElementOnPointerDown` (`App.tsx:9511`) takes
`ExcalidrawGenericElement["type"] | "embeddable"` and branches construction
(`if (elementType === "embeddable") newEmbeddableElement(...) else newElement(...)`,
`App.tsx:~9544`):
- Widen its parameter to `… | "stickynote"` and add an `else if (elementType === "stickynote")`
  arm calling `newStickyNoteElement(...)` (which applies `clampStickyNoteProps`). Sticky stays
  **out** of `ExcalidrawGenericElement`, so it never falls through to the bare `newElement` arm.
- The element still starts at `0×0`; **drag-to-size** works through the normal path. A plain
  click leaves it invisibly small, which pointer-up deletes via `isInvisiblySmallElement`
  (`App.tsx:10990`, `sizeHelpers.ts:30`), so:
- Add a **dedicated sticky pointer-up path that runs before the invisible-element cleanup**:
  if the gesture was a click (below the drag threshold), assign the default square
  (`DEFAULT_STICKY_NOTE_SIZE`) centered on the pointer and finalize `maxHeight`; a **drag**
  gesture instead keeps the dragged dimensions and finalizes `maxHeight` from the dragged height.
  **Both paths then auto-start text editing** (the `startTextEditing` path) so the user types
  immediately — drag-create and click-place behave the same. Respect tool-lock.

### 5.3 `startTextEditing` font + pre-grow
`startTextEditing` (`App.tsx:6236–6261`) pre-grows a container to a minimum size derived from
`currentItemFontSize` before creating the bound text. For a sticky this would mutate the box
with the wrong font. For sticky containers:
- Skip (or recompute with the sticky base font) that min-size pre-grow block; the sticky box
  already has its own dimensions and `maxHeight`.
- Seed the new bound text's `fontSize`/`fontSizeMax` per the §3.2 rule (not
  `currentItemFontSize`), keeping `maxHeight` in sync.

### 5.4 Empty-text lifecycle
A sticky is a first-class object, so an empty sticky is valid (an empty colored note). It
reuses the existing empty-submit machinery, which already deletes only the **bound text** and
keeps the **container**:
- On submit with empty text, `updateElement(nextOriginalText, isDeleted=true)`
  (`App.tsx:5766`) marks the text deleted and `textWysiwyg.handleSubmit` removes it from the
  container's `boundElements`; the **sticky persists** with no bound text. Re-editing
  (double-click) creates a fresh bound text.
- A click-placed (or drag-placed) sticky immediately escaped with no text is **kept** (it was
  deliberately placed) **at its placed size** — the empty-text layout rule (§6) holds the box at
  `maxHeight` rather than Y-shrinking it to a strip, so an empty note stays the square/box the
  user drew. This is consistent with how containers behave today and needs no special code beyond
  not treating an empty sticky as invisibly-small.

### 5.5 Programmatic / skeleton creation
`convertToExcalidrawElements` (`transform.ts`, the public skeleton→element API) builds elements via
a per-type `switch` (`:529`) with **no** `"stickynote"` case, so a `{ type: "stickynote" }` skeleton
falls to `default` → `assertNever(…, true)` and is passed through **unconstructed** (no
`clampStickyNoteProps`, no `maxHeight`, possibly `0×0`/transparent). Labeled *containers* go through
`ValidContainer` (`:162`), whose type is `Exclude<ExcalidrawGenericElement["type"], "selection">`
(generic-only: rectangle/diamond/ellipse) — so since a sticky is intentionally **not** generic
(§3.1), a labeled-container skeleton can never yield a sticky either.

Skeleton support is **all-or-nothing across runtime *and* types** — a runtime `case` alone is
half-support, because `ExcalidrawElementSkeleton` (`transform.ts:175–209`, publicly re-exported via
`@excalidraw/element`) is a closed union and `ValidContainer` (`:162`) is generic-only
(`Exclude<ExcalidrawGenericElement["type"], "selection">`), so a TypeScript caller still could not
write `{ type: "stickynote" }` without casting. Full support means **all** of:
1. a dedicated `ExcalidrawElementSkeleton` member — `{ type: "stickynote"; x: number; y: number;
   label?: { text: string; … } } & Partial<ExcalidrawStickyNoteElement>` (mirroring the `text` /
   `magicframe` members) — a **public-API addition** with real blast radius for strict consumers;
2. a construction `case "stickynote"` (`:529`) routing through `newStickyNoteElement` +
   `clampStickyNoteProps`, defaulting `width/height` to `DEFAULT_STICKY_NOTE_SIZE` and finalizing
   `maxHeight`;
3. label/text binding in the second switch (`:~661`, alongside `rectangle|ellipse|diamond|arrow`)
   so a supplied `label` becomes the bound text, then the sticky fit.

**Recommendation for v1: defer full skeleton support** (add neither the public type member nor the
runtime case) and instead **guard the `default` arm** so a `{ type: "stickynote" }` skeleton is
rejected/ignored rather than passed through unconstructed. This keeps the public type surface
unchanged for v1; the three-part recipe above is the path to add it later. (Either way the
always-filled invariant must hold for anything that *does* get constructed — a §3.5
enforcement-boundary write path.)

---

## 6. Sizing & font-fit

A sticky has a fixed width `W` (horizontal resize sets it; defines the wrap width), a
font-shrink threshold `maxHeight` (set by vertical resize), padding `P = BOUND_TEXT_PADDING`,
and font bounds `[MIN, MAX]` snapped to `STICKY_NOTE_FONT_STEP`, where
`MIN = STICKY_NOTE_MIN_FONT_SIZE` and `MAX = max(MIN, fontSizeMax ?? fontSize)` (the `max`
guards against a stray sub-`MIN` base from Stats/imported data inverting the range). The box
height always hugs the content at the fitted font; `maxHeight` only governs how large the font
may grow before it must shrink.

The layout helper takes the **unwrapped** `originalText` and produces the wrapped render text
itself — it must never receive already-wrapped text, or repeated recomputes would bake soft
wraps into the content (this matches `refreshTextDimensions`/`redrawTextBoundingBox`, which
always wrap from `originalText`).

```
computeStickyNoteTextLayout(W, maxHeight, originalText, fontFamily, lineHeight, MIN, MAX):
  availW   = max(W - 2P, 1)                     // clamp so wrapText never gets <=0 / NaN
  ceilingH = max(maxHeight - 2P, 0)

  fit(size):                                   // 1 wrap + 1 measure
     wrapped = wrapText(originalText, fontString(size), availW)
     h       = measureText(wrapped, fontString(size), lineHeight).height
     return { wrapped, h }

  if isBlank(originalText):                     // nothing to hug -> hold box at maxHeight (no Y-shrink)
     return { textUpdates:      { text: "", fontSize: MAX, ...emptyTextDims(MAX) },
              containerUpdates:  { height: max(maxHeight, STICKY_NOTE_MIN_HEIGHT) } }

  // Largest snapped size in [MIN, MAX] whose wrapped height fits the ceiling.
  // Fast path: try MAX first. If even MIN overflows the ceiling, fall back to MIN.
  fontSize = largestSnappedFit([MIN, MAX], ceilingH) ?? MIN     // binary search
  { wrapped, h } = fit(fontSize)

  // The box ALWAYS hugs its content at the fitted font:
  //  - content shorter than the ceiling -> box shrinks below maxHeight (Y-shrink)
  //  - content taller than the ceiling only because the font bottomed out at MIN ->
  //    box grows past maxHeight so all text stays visible (never clipped)
  boxH = max(h + 2P, STICKY_NOTE_MIN_HEIGHT)

  return {
    textUpdates:      { text: wrapped, fontSize, width: textWidth(wrapped), height: h,
                        ...computeBoundTextPosition(...) },   // x, y inside the box
    containerUpdates: { height: boxH /*, y: see anchoring */ },
  }
```

- **Empty text:** with no content there is nothing to hug, so the layout returns the box at
  `maxHeight` (not one line). This keeps a freshly placed/escaped empty sticky the square it was
  drawn as (§5.4) instead of collapsing to a strip; the first real keystroke switches to the
  normal hug-content path.
- **Regrow cap = `MAX = fontSizeMax`**, read from the element on every path, so deleting text
  regrows the font only up to the size the user chose — consistently across typing, paste,
  restore, and resize. Changing the font picker updates `fontSizeMax` and re-fits.
- **Resize semantics & contract** (`handleBindTextResize` extension). Each handle maps to specific
  fields — full matrix (`k` = drag scale ratio):

  | Gesture | `W` | `maxHeight` | `fontSizeMax` | Effect |
  |---|---|---|---|---|
  | Horizontal edge (e/w) | set | — | — | re-wrap + re-fit |
  | Vertical edge (n/s) | — | set | — | re-fit (raise/lower font ceiling) |
  | Free corner (no Shift) | set | set | — | re-wrap + re-fit (width *and* ceiling change) |
  | Shift / aspect corner | ×`k` | ×`k` | ×`k` | proportional **zoom** of the whole note |
  | Multi-select resize | ×`k` | ×`k` | ×`k` | per sticky, same as aspect zoom |

  The sticky path supersedes the container's autogrow. The `fontSizeMax`-scaling rows (Shift/aspect
  and multi-select) are exactly the existing `resizeElements.ts` `fontSize`-scaling sites (`~:914`,
  `~:1491`) — those must redirect to `fontSizeMax` (next bullet); the `W`/`maxHeight`-only rows flow
  through the `handleBindTextResize` extension.

  **The rubber-band caveat applies only to the `maxHeight`-only rows** (vertical edge, and the
  height component of a free corner): because the box **always** re-hugs content at the fitted font,
  `maxHeight` is a *font-growth ceiling*, not a free box height, so such a drag produces a visible
  change only while the font can still move inside `(MIN, MAX)`:
    - dragging **taller** once the font is already at `MAX` re-hugs back to content (the box
      appears to "rubber-band" — the extra height can't be filled past the user's max font);
    - dragging **shorter** than the min-font content height re-grows back (text is never clipped).
  Shift/aspect and multi-select are proportional zooms (they scale `fontSizeMax` too), so they do
  **not** rubber-band. This "resize zooms the text" model is intentional — it falls out of the §1
  auto-fit requirement — and is **not** a fixed-font box resize (confirm-intended item in §12).
- **Resize touches bound-text `fontSize` *before* `handleBindTextResize`.** Aspect-ratio/Shift and
  corner resize (`resizeElements.ts` `resizeSingleElement`, the `measureFontSizeFromWidth` write
  `~:914`) and multi-select resize (`resizeMultipleElements`, the `fontSize * scale` write `~:1491`)
  scale the *derived* `fontSize` directly, ahead of `handleBindTextResize`. For a sticky that is
  wrong — `fontSize` is derived and `fontSizeMax` is the user setting. These two sites must, for
  sticky-bound text, scale **`fontSizeMax`** instead (clamp + snap via `setStickyBaseFontSize`) and
  let the sticky fit recompute the rendered `fontSize` + box; never write the sticky's `fontSize`
  directly. (Vertical-only edge drag still maps to `maxHeight`; horizontal-only to `W`; the
  proportional corner/aspect drag scales `fontSizeMax` — "scale the note".) Both call sites are on
  the §3.3 touch checklist, with Shift/aspect and multi-select tests (§11).
- **Anchoring:** the anchor is the box's **local top edge** (the note grows/shrinks downward in
  its own frame). For an **unrotated** sticky this just means `y` is unchanged on auto-recompute.
  For a **rotated** sticky, holding raw `x/y` while `height` changes moves the rotated
  top-edge midpoint and the note visibly drifts; so when `height` changes by Δ the helper must
  also adjust `x/y` to keep the rotated top-edge midpoint fixed (same rotation-aware
  recomputation the resize handles use — cf. `textElement.ts:192–204`, generalized for the
  angle). Therefore `containerUpdates` may include `x` and `y`. On an explicit resize, preserve
  the dragged handle instead (n/ne/nw anchor the bottom). A rotated-sticky edit/resize test
  guards this.
- **Overflow at `MIN`:** if even `MIN` overflows `ceilingH`, the font stays at `MIN` and the box
  **grows** vertically past `maxHeight` to keep all text visible (the box always hugs its
  content; text is never clipped). `maxHeight` itself is unchanged — deleting text lets the box
  shrink back below it and the font regrow.

**Performance:** the binary search over the snapped `[MIN, MAX]` range is ≤ ~4–5 `fit()`
iterations (1 `wrapText` + 1 `measureText` each); the fast path makes the common "it fits" case
a single iteration. `charWidth` already memoizes per-character widths. This runs per keystroke
and is comfortably cheap.

---

## 7. Same-frame guarantee (no layout shift)

`scene.mutateElement` → (version changed) `triggerUpdate` → `setState({})` → one React commit
→ one canvas paint. Handlers are wrapped in `withBatchedUpdates`, so all mutations in a handler
coalesce into one paint. Rules:

- **One fit per recompute, one call site.** The sticky fit lives inside the consolidated
  `computeBoundTextGeometry` (§8.1) and is invoked from exactly one active path per event — never
  twice for the same edit:
  - **Live editing — owner is `App.tsx updateElement`.** The textarea `oninput` → `onChange` calls
    App's `updateElement` (`App.tsx:5760`, the live **per-keystroke** path inside `handleTextWysiwyg`),
    which today refreshes the **text** element's dims via `refreshTextDimensions` and, through
    `replaceAllElements` → `scene.triggerUpdate()`, reactively fires
    `scene.onUpdate(() => updateWysiwygStyle())` (`textWysiwyg.tsx:~972`) which today
    autogrows/autoshrinks the **container**. Container ownership is thus split across two functions
    today — so for stickies it must be collapsed to **one owner: `updateElement`.** When the edited
    text is sticky-bound, `updateElement` runs the full fit (`computeBoundTextGeometry` → sticky
    branch) and maps **both** the text and the container element in its single `replaceAllElements`
    call (§8.1); `updateWysiwygStyle` then becomes **display-only for stickies** — it must **skip**
    its container autogrow/autoshrink (which would re-fit and re-enter `onUpdate`) and only restyle
    the textarea DOM from the already-fitted element. `triggerUpdate` callbacks run synchronously
    (`Scene.ts:303–309`, no `rAF`/microtask) and `onChange` is `withBatchedUpdates`, so both element
    mutations and the textarea restyle land in one React commit → one paint.
  - **Non-editing** (programmatic API, resize, font action, restore pass): no wysiwyg is mounted,
    so the fit runs directly in that handler via `redrawTextBoundingBox` / `handleBindTextResize` /
    the restore post-pass (§3.6) — same `computeBoundTextGeometry`, same result.
  Either way, never defer to `requestAnimationFrame`, `setTimeout`, or a React effect. Idempotency
  (§6) is a safety net so a redundant recompute is a no-op (same values → no version bump → no
  further `onUpdate`), not the primary mechanism.
- Mutate the bound text's `fontSize` before/with the container so the wysiwyg textarea — restyled
  in the same commit via `scene.onUpdate → updateWysiwygStyle`, which reads
  `getFontString(textElement)` — matches the canvas glyphs.
- **Paste** has two paths in `textWysiwyg.tsx`:
  - Excalidraw-clipboard paste (`onpaste`, `:531`) splices text and dispatches `input`; the
    fit runs in that `input` handler → same frame.
  - Normal text paste (`:591–612`) lets the browser insert (native `oninput` fires the fit
    afterward) but first pre-sizes the textarea width using `currentItemFontSize`. Make this
    pre-size **sticky-aware** (skip it for sticky containers, or size at the fitted font) so no
    wrong-font frame flashes before the fit lands.

---

## 8. Canonical recompute path & invariant enforcement

### 8.1 One recompute path
A sticky recompute always changes **two** elements: the bound text (`text, fontSize, width,
height, x, y`) and the sticky container (`height`, sometimes `y`). The existing pure helper
`refreshTextDimensions` (`newElement.ts:420`) returns **text updates only**, and its callers
mutate only the text element (`App.tsx:5721` `updateElement` maps just the text match;
`restore.ts:853` `Object.assign`s just the text). So the container half must be applied
explicitly at each site:

1. **Consolidate** today's near-duplicate container autogrow/autoshrink into one helper
   `computeBoundTextGeometry(container, textElement, metrics, map, policy) → { textUpdates,
   containerUpdates }`. The two existing callers are **not** equivalent —
   `redrawTextBoundingBox` (`textElement.ts:46–140`, grow block `~107–122`) only **grows**;
   `updateWysiwygStyle` (`textWysiwyg.tsx:~260–423`, grow/shrink block `~326–357`) grows **and
   shrinks** via `originalContainerCache` — so the helper takes the caller's grow/shrink `policy`
   and each caller passes its current one. This makes the consolidation behavior-preserving
   (proven by keeping tests green).
2. Inside it, branch on `isStickyNoteElement(container)` → `computeStickyNoteTextLayout` (§6);
   else the existing autogrow/autoshrink under the caller's policy.
3. **Apply `containerUpdates` at every site:**
   - Scene-mutating callers `redrawTextBoundingBox` and `handleBindTextResize` already hold `scene`
     and mutate the container; extend them to apply the sticky `containerUpdates`.
   - **Live-editing owner = `App.tsx updateElement`** (`:5760`): when the edited text is
     sticky-bound it runs the fit and maps/replaces **both** the text and the container in its one
     `replaceAllElements` call. `updateWysiwygStyle` is **display-only for stickies** — it skips its
     own container autogrow/autoshrink so the fit never runs twice (§7).
   - `restore.ts` does **not** apply `containerUpdates` inline (no `scene`, per-element,
     order-dependent). The container is reconciled in the single post-restore normalization pass
     and re-confirmed on fonts-loaded (§3.6), where both elements are present.

### 8.2 Invariant enforcement across generic actions
Enforcement must be at the **action (perform) level**, not just UI hiding — actions also run via
shortcuts, the command palette, and the programmatic API, none of which respect a hidden
control. Hiding controls is cosmetic only. Route every mutation through the two normalizers
(`clampStickyNoteProps` §3.5; a `setStickyBaseFontSize(textEl, size)` that writes `fontSizeMax`
+ re-fits):

- **Font size** (rendered `fontSize` is derived; the user edits `fontSizeMax`). All of these
  must, for stickies, operate on `fontSizeMax ?? fontSize` and write via `setStickyBaseFontSize`:
  - `actionProperties.tsx` `changeFontSize` (write) and the picker `value` getter (`:813`,
    currently returns bound-text `fontSize`) → display `fontSizeMax ?? fontSize` (the user's
    chosen **max**, not the fitted size — so a note whose text auto-shrank to 12 still shows its
    `28` selection; intentional, since the picker controls the ceiling).
  - **Relative** font actions `actionIncreaseFontSize` / `actionDecreaseFontSize`
    (`actionProperties.tsx:852/876`) compute `Math.round(element.fontSize * step)` from the
    *rendered* (fitted) size — for stickies they must step from `fontSizeMax ?? fontSize`.
  - Stats panels mutate `fontSize` directly: `Stats/FontSize.tsx:67`, `Stats/MultiFontSize.tsx:83`.
  - `setStickyBaseFontSize(textEl, container, size, scene)` writes `fontSizeMax` (clamped to
    `≥ STICKY_NOTE_MIN_FONT_SIZE` **and snapped to `STICKY_NOTE_FONT_STEP`**, §3.2) then re-fits —
    so it needs the **container** (for `W`/`maxHeight`) and a way to mutate **both** elements (the
    live `scene`, or an `elementsMap` + apply-both-halves in the no-`scene` restore pass). It is
    not a text-only setter; the two-field model (`maxHeight` on the container, `fontSizeMax` on the
    text) means every font write reconciles across the pair.
- **Style props (`fillStyle`, `roughness`, `roundness`).** The actions that write these
  (`actionProperties.tsx:465/605/1497`) must **clamp or no-op** for sticky targets (route the
  result through `clampStickyNoteProps`) — not merely hide the control.
- **Paste styles** `actionStyles.ts` copies `backgroundColor/fillStyle/roughness/roundness`
  (`:99`) and bound-text `fontSize` (`:117`) directly. For a sticky target, run the result
  through `clampStickyNoteProps` (so a transparent/sketchy source can't un-sticky it) and route
  the copied font size through `setStickyBaseFontSize`. (Copying *from* a sticky carries the bound
  text's **fitted** `fontSize`, not its `fontSizeMax`; acceptable for v1.)
- **Background-color action:** disallow `transparent` for stickies at the action level (clamp to
  `DEFAULT_STICKY_NOTE_BG`).
- **Bind existing text** — `actionBindText` (`actionBoundText.tsx:156`) binds an already-existing
  text element to an existing container. When that container is a sticky, also set
  `fontSizeMax = existing fontSize` and run the sticky layout (alongside its existing
  `redrawTextBoundingBox` call) so the text fits immediately. (Not in scope: wrapping selected
  text into a *new* sticky — `actionWrapTextInContainer` (`:241`) always creates a rectangle and
  is left unchanged for v1.)
- **Unbind** — `actionUnbindText` (`:83`) must clear `fontSizeMax` on the freed text (§3.2).
- **UI (cosmetic):** hide the fill-style / sloppiness controls and fix roundness for stickies in
  shape actions to keep the panel minimal. Exact panel set pending the visual pass (§12).

---

## 9. Helper reuse & consolidation

**Reused as-is:** `wrapText`, `getWrappedTextLines`, `measureText`, `getTextWidth/Height`,
`getLineHeightInPx`, `charWidth`, `getFontString`, `getBoundTextMaxWidth/Height`,
`computeBoundTextPosition`, `computeContainerDimensionForBoundText`, `getContainerCoords` —
each per-type branch gains a `stickynote` arm identical to `rectangle`.

**Consolidated (low-risk, before adding sticky logic):**
1. Unify the container autogrow/autoshrink into the policy-parameterized
   `computeBoundTextGeometry` shared by `redrawTextBoundingBox` (grow-only) and
   `updateWysiwygStyle` (grow+shrink) — the single hook for the sticky branch. Guarded by
   `textWysiwyg.test.tsx` and `textElement.test.ts`.
2. Have `refreshTextDimensions` and `redrawTextBoundingBox` share that one geometry calc.
   `refreshTextDimensions` stays text-only (its public contract is unchanged), so the sticky
   sites that need the container half — `App.tsx updateElement` and the **restore post-pass**
   (§3.6) — call the lower-level `computeBoundTextGeometry` (or a thin companion returning
   `containerUpdates`) directly and apply both halves (§8.1), rather than relying on
   `refreshTextDimensions` alone.
3. `originalContainerCache` (global, height-only, reset inconsistently) is **not used** by
   stickies (the `maxHeight` field replaces the "remembered original height"). Broader removal
   of the global is optional and out of scope for v1.

**Left untouched (well-tested):** the wrapping engine internals (`textWrapping.ts` +
`textWrapping.test.ts`), the ellipse/diamond inscribed-rectangle math (`textElement.test.ts`),
and the `autoResize:false`-on-manual-resize behavior (`resize.test.tsx`).

---

## 10. Implementation plan (phased, file-by-file)

**Phase 0 — Consolidation (behavior-preserving).**
- `textElement.ts`, `textWysiwyg.tsx`: extract `computeBoundTextGeometry`; route both
  autogrow/autoshrink sites through it with each caller's existing grow/shrink policy
  (grow-only / grow+shrink). `yarn test` must stay green.

**Phase 1 — Data model & type plumbing.**
- `element/src/types.ts`: `ExcalidrawStickyNoteElement` + union/grouping membership (**not**
  `ExcalidrawGenericElement`, §3.1); add optional `fontSizeMax?` to `ExcalidrawTextElement`.
- `element/src/newElement.ts`: `newStickyNoteElement` + `clampStickyNoteProps`; add
  `fontSizeMax?` to `newTextElement` opts + `textElementProps` (§3.2).
- `common/src/constants.ts`: sticky constants (§3.4) + `TOOL_TYPE` entry. Do **not** touch the
  global `DEFAULT_ELEMENT_PROPS` (it feeds `_newElementBase` defaults for *all* elements);
  sticky-specific defaults (bg, fill, roughness, roundness) live in the dedicated constants and
  are applied only via `newStickyNoteElement` / `clampStickyNoteProps`.
- `data/restore.ts`: `case "stickynote"` (+ clamp); `AllowedExcalidrawActiveTools.stickynote`;
  preserve `fontSizeMax` only if present in the `text` case; **single post-restore normalization
  pass** reconciling the container, plus a `Fonts.onLoaded` (`fonts/Fonts.ts:104`) hook to re-fit
  sticky-bound text on font load (§3.6).
- **Work the §3.3 membership checklist explicitly** — the compiler flags only the exhaustive
  `assertNever` switches; the boolean OR-chains / `default`-returning switches
  (`comparisons.hasBackground` ⚠️, `isRectangularElement`, `isEligibleFrameChildType`,
  `textElement.VALID_CONTAINER_TYPES` (re-editing ⚠️), `getElementShape`,
  `_isRectanguloidElement`, `isUsingAdaptiveRadius` (roundness ⚠️), `distance.distanceToElement`
  (binding ⚠️), the SVG/canvas render switches, …) must be hit by hand. After this
  phase run `yarn test:typecheck` for the compiler-flagged ones.

**Phase 2 — Rendering.**
- `renderElement.ts` `drawElementOnCanvas` + canvas render switch: sticky paint; `shape.ts`
  rectangle arm (solid, roughness 0).
- **SVG:** explicit `case "stickynote"` in `staticSvgScene.ts:142` emitting a flat solid rounded
  `<rect>` (parity with canvas; §4).
- Verify static + interactive scenes and SVG export. (No text clipping — the box grows to fit.)

**Phase 3 — Tool, creation & lifecycle.**
- `excalidraw/types.ts`, `components/icons.tsx`, `Actions.tsx` (desktop), `MobileToolBar.tsx`
  (mobile), optional `actions/actionStickyNote.ts` + import in `App.tsx`, `locales/en.json`.
- `App.tsx`: widen `createGenericElementOnPointerDown` to `… | "stickynote"` + add the
  `newStickyNoteElement` construction arm (mirroring `embeddable`, §5.2); dedicated sticky
  pointer-up (default square, before invisible cleanup) + auto-edit; `startTextEditing` font
  seeding + skip the wrong-font pre-grow (§5.3); empty-text lifecycle keeps the sticky (§5.4).
- `transform.ts`: add a `"stickynote"` construction case to `convertToExcalidrawElements` (§5.5),
  or explicitly mark skeleton creation unsupported + guard the `default` arm so it can't emit a
  malformed sticky.

**Phase 4 — Sizing behavior.**
- `element/src/stickyNote.ts` (new): `computeStickyNoteTextLayout` (takes unwrapped
  `originalText`; returns `{ textUpdates, containerUpdates }`).
- Hook into `computeBoundTextGeometry`; apply `containerUpdates` at every site incl.
  `App.tsx updateElement` and `restore.ts` (§8.1). Make the normal-text paste pre-size
  sticky-aware (§7).

**Phase 5 — Font cap & invariant enforcement across generic actions (perform-level, §8.2).**
- `setStickyBaseFontSize` (clamps to `≥ MIN`, snaps to `STICKY_NOTE_FONT_STEP`; needs
  container + scene) + route `actionProperties.tsx` (`changeFontSize` +
  picker value + **`actionIncrease/DecreaseFontSize`**), `Stats/FontSize.tsx`,
  `Stats/MultiFontSize.tsx`, and `actionStyles.ts` font copy through it (step from
  `fontSizeMax ?? fontSize`).
- Clamp/no-op `fillStyle`/`roughness`/`roundness` writes for stickies in
  `actionProperties.tsx:465/605/1497`, the paste-styles result, and the background-color action
  (via `clampStickyNoteProps`) — at the perform level, not just UI. Hide the irrelevant controls.
- `actionBindText` (`actionBoundText.tsx:156`): when binding to a sticky, set
  `fontSizeMax = existing fontSize` + run sticky layout. `actionUnbindText` (`:83`): clear
  `fontSizeMax` on the freed text.

**Phase 6 — Resize semantics.**
- `handleBindTextResize`: horizontal → new `W`; vertical/corner → new `maxHeight`; anchoring
  per §6 (incl. rotation-aware `x/y` adjustment). Ensure no `autoResize` toggling fights the
  sticky path.
- `resizeElements.ts`: in `resizeSingleElement` (aspect/Shift, `~:914`) and
  `resizeMultipleElements` (multi-select, `~:1491`), bypass the direct bound-text `fontSize` scale
  for sticky-bound text and scale `fontSizeMax` (clamp+snap) instead, then re-fit (§6). Cover with
  Shift/aspect and multi-select resize tests.

**Phase 7 — Tests & visual polish (§11, §12).**

> After Phase 1, `yarn test:typecheck` enumerates remaining switch sites; `yarn test:update`
> for snapshots; `yarn fix` for lint/format.

---

## 11. Testing plan

- **Unit (`packages/element/tests/`):** `computeStickyNoteTextLayout` — overflow shrinks the
  font (to `MIN`, snapped); **no-fit at `MIN`** returns `MIN` and grows the box past `maxHeight`
  to fit (no crash); short text Y-shrinks the box to content (to `STICKY_NOTE_MIN_HEIGHT`);
  width resize re-wraps + re-fits; vertical resize changes the ceiling; **empty/blank text holds
  the box at `maxHeight`** (no Y-shrink to a strip); degenerate inputs
  (`W < 2P`, empty text, `fontSizeMax < MIN`, odd `fontSizeMax`) don't NaN/loop/invert the range
  and keep `MAX` on the snap grid; takes unwrapped
  `originalText` and is idempotent across repeated recomputes (no baked soft wraps); regrow caps
  at `fontSizeMax`. `clampStickyNoteProps`, `hasBackground("stickynote") === true`,
  `hasStrokeColor("stickynote") === false`, `fontSizeMax` snapped+clamped on write, type guards,
  `newStickyNoteElement` defaults, `newTextElement` persists `fontSizeMax`, restore round-trip
  (incl. transparent-bg clamp).
- **Editor (`textWysiwyg.test.tsx`):** typing past the box shrinks the font in place; deleting
  regrows + Y-shrinks; paste (both clipboard kinds) fits in one update; assert the text
  `fontSize`/`height` and the container `height` are mutually consistent after a single input
  event (no flash). Empty submit keeps the sticky **at its placed size** (box held at `maxHeight`,
  not collapsed), deletes the bound text. **Rotated sticky:**
  typing/Y-shrink keeps the visual top edge fixed (no drift); resize anchors the dragged handle.
- **Generic-action invariants (perform-level):** paste-styles from a transparent/sketchy source
  keeps the sticky solid + non-transparent and routes font through `fontSizeMax`; Stats font
  edit, the picker, and **relative font shortcuts** honor/step from `fontSizeMax`;
  `fillStyle`/`roughness`/`roundness` actions clamp/no-op; background action rejects transparent;
  **binding pre-existing text** to a sticky sets `fontSizeMax = existing fontSize` and fits;
  **unbinding** clears `fontSizeMax`; sub-`MIN` base font is clamped on write.
- **Resize (perform-level), full matrix (§6):** horizontal edge → `W` (re-wrap); vertical edge →
  `maxHeight` (rubber-bands at font `MIN`/`MAX`); free corner → both `W` and `maxHeight`;
  **Shift/aspect corner and multi-select** scale `fontSizeMax` (clamp+snap) + re-fit and **never**
  write the derived `fontSize`.
- **Render/snapshot & geometry:** sticky renders solid (canvas + SVG parity); body is
  hit-testable/bindable (assert `shouldTestInside` *and* `distanceToElement` returns a finite body
  distance so an arrow binds); roundness resolves to `ADAPTIVE_RADIUS` (not `null`/square corners);
  **over-min text grows the box** (all text visible, no clipping).
- **Restore & fonts:** restored sticky trusts stored geometry; the post-restore pass reconciles
  the container; a simulated `document.fonts` `loadingdone` re-fits a sticky measured with the
  fallback font (no stuck wrong height) **without** adding a history/undo entry or a collab
  broadcast (the re-fit is local + deterministic, §3.6).
- **Skeleton API:** with v1 deferring support (§5.5), `convertToExcalidrawElements({ type:
  "stickynote", … })` is rejected/guarded (never a malformed unconstructed element); if support is
  later added, the public `ExcalidrawElementSkeleton` type admits it and a `label` becomes bound text.
- **Imperative API (best-effort, §3.5):** elements injected via `restore`/`updateScene` are clamped
  (transparent sticky bg → default); a raw `ExcalidrawImperativeAPI.mutateElement` that sets a
  sticky transparent is *not* auto-fixed but trips the dev-only assertion.
- **Tool plumbing:** restored sticky tool survives; click-to-place creates a default square via
  `newStickyNoteElement` (clamped, not deleted as invisibly-small) and enters edit;
  **re-editing** a selected sticky with bound text re-opens the editor (`isValidTextContainer`);
  desktop + mobile dropdowns.
- **Manual via CDP** (`http://localhost:3006`, port 9223): create, type a paragraph (font
  shrinks, no flash), delete (Y-shrink), large paste, drag-resize H and W, duplicate, undo/redo,
  dark mode, rotate.

---

## 12. Open questions
- **Resize model — confirm intended:** vertical resize is a *font-growth ceiling* (the box always
  re-hugs content), so dragging taller past the max font, or shorter than min-font content,
  rubber-bands back (§6). This is the chosen "resize zooms the text" model; flag for product
  sign-off in case a fixed-font box resize is preferred instead (that would relax the §1
  hug-content requirement).
- **Visual treatment:** default size/color, drop shadow / folded corner, and exactly which
  shape-action controls are hidden vs. fixed for stickies — needs a CDP visual pass. (Resolved for
  v1: **no border / `hasStrokeColor === false`**, §3.3/§4.)
- **Imperative-API invariant — confirm acceptable:** best-effort — `restore` normalizes; raw
  `mutateElement`/`updateScene` are trusted callers + a dev-only assertion (§3.5). Alternative is
  hard-normalizing stickies inside `updateScene` (rejected here for per-call cost on the collab
  path).
- **Skeleton API scope:** deferred for v1 (§5.5); enabling it is a public
  `ExcalidrawElementSkeleton` type change (blast radius for strict consumers) + two switch arms.
- **Font-load re-fit:** version-preserving local write vs. lazy re-fit on next interaction (§3.6) —
  pick based on whether a non-versioning mutation helper is acceptable.
- **Scope:** v1 = one bound text + auto-fit + user-pickable base size + solid render + invariant
  enforcement. Defer shadow / folded corner / color presets / a 1px border / skeleton-API support
  behind flags.
