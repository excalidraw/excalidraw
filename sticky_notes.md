# Sticky Notes — Implementation Spec

> Status: **design complete, ready for review.** Investigation done via parallel code
> exploration of the element model, bound-text lifecycle, render pipeline, text-geometry
> helpers, the tool system, and prior-art PR #10001. All load-bearing `file:line`
> references below were verified directly against the working tree (branch
> `dwelle/less-noisy-tests`).
>
> **Confirmed decisions (owner):** (1) **new element type** `"stickynote"`;
> (2) sizing = **font-fit + Y-shrink** (fixed width, content-hugging height with a
> drag-set ceiling, font shrinks past the ceiling); (3) **user-pickable base font size**
> — the picker sets a per-element maximum that auto-fit caps regrow at.

---

## 1. Goal & requirements (from product brief)

A new **Sticky Note** primitive for Excalidraw.

- **New tool in the toolbar**, initially placed in the "more tools" dropdown.
- **Element modeling is undecided**: new *element type* vs. *attribute* on rectangle/ellipse.
  Keep both options open. (See §5 — recommendation + both fully specced.)
- Behaves like a **text-bound container** with special behavior.
- **Always has a background** (or behaves as if it does) — dedicated **render style**.
- **Text fits the container bbox + padding:**
  - Overflow → **shrink the font** until it fits.
  - The resize happens **in the same render frame** (no layout-shift flash). Also on
    **paste**, programmatic edits, restore.
  - When the text is small → **shrink the container on the Y-axis** down (same frame).

### Constraints
- **Reuse existing helpers**; investigate **consolidation/simplification** of text helpers.
- **No new dependencies.**
- Prior art **PR #10001**: don't copy. Owner dislikes its UX (extra customization options;
  sticky exposed as a rectangle attribute). Mine it only for the font-fit idea.

---

## 2. TL;DR — recommended approach

1. **Model sticky notes as a new element type `"stickynote"`**, defined as a
   **rectanguloid text container** (geometrically a rounded rectangle). It piggybacks on
   every existing `rectangle`/rectanguloid code branch (bounds, collision, shape, resize,
   transform) by being added to those existing `case` lists, so it inherits ~all geometry
   for free; only **rendering** and **text-sizing behavior** are bespoke. This matches the
   product's "first-class tool" intent and avoids polluting the rectangle type / the
   "convert shape" UX the owner objected to. The attribute alternative is documented in
   §5 as the (rejected) fallback. **Confirmed by owner.**

2. **One bound `text` element** per sticky note (reusing the entire existing bound-text
   machinery — `containerId` / `boundElements`, `textWysiwyg`, `redrawTextBoundingBox`).
   Sticky notes are just a container whose **text-sizing policy differs**.

3. **The novel behavior lives in ONE shared helper** —
   `computeStickyNoteTextLayout(container, text, …) → { text, width, height, fontSize }` —
   invoked from the single canonical bound-text recompute path so **every** entry point
   (typing, paste, programmatic, restore, container resize) gets identical results. PR
   #10001's biggest flaw was wiring font-fit only into the wysiwyg editor.

4. **"Same render frame"** is automatic *if* the font-fit + container-height mutations are
   issued **synchronously inside the same event handler** (never deferred to `rAF`/effect).
   Excalidraw already batches all `scene.mutateElement` calls in one handler into a single
   React commit → single canvas paint. We must not split the computation across frames.

5. **Custom render style:** a sticky note draws a solid (non-sketchy) filled rounded rect
   (+ optional drop shadow / folded-corner) by branching in `drawElementOnCanvas`; it never
   renders transparent even if `backgroundColor` is transparent.

6. **Consolidate first:** unify the duplicated container autogrow/autoshrink logic (today
   copy-pasted between `redrawTextBoundingBox` and the wysiwyg's `updateWysiwygStyle`) into
   one function, then hang the sticky branch off it. Clean foundation + the brief's
   "investigate consolidation" ask in one move.

---

## 3. Codebase findings (verified)

### 3.1 Element model
- Discriminated union `ExcalidrawElement` + shared `_ExcalidrawElementBase`
  (`packages/element/src/types.ts`). Base already carries everything a sticky needs:
  `backgroundColor`, `fillStyle`, `roundness`, `boundElements`, `angle`, `opacity`, etc.
- Container grouping types: `ExcalidrawRectanguloidElement`, `ExcalidrawBindableElement`,
  `ExcalidrawTextContainer` (`types.ts`).
- Type guards (`packages/element/src/typeChecks.ts`):
  - `isTextBindableContainer` → `rectangle | diamond | ellipse | arrow` (line 230).
  - `isFlowchartNodeElement` → `rectangle | ellipse | diamond` (line 274).
  - `hasBoundTextElement` (line 284), `isBoundToContainer` (line 293).
  - `isExcalidrawElement` (line 244) is an **exhaustive switch with `assertNever`** — a new
    type forces a compile error here and at every other exhaustive switch, which is a
    *feature*: TypeScript will hand us the list of sites to touch.
- A bound text element is a normal `text` element with `containerId` set; the container
  lists it in `boundElements: [{ type:"text", id }]`.

### 3.2 Bound-text lifecycle (entry points the sticky must hook)
- **Creation / edit start:** `App.tsx` → `startTextEditing()` builds the bound
  `newTextElement({ containerId, verticalAlign, textAlign, autoResize:true, … })`, links it
  into the container's `boundElements`, inserts it right after the container, sets
  `editingTextElement`, then calls `handleTextWysiwyg()`.
- **Editor:** `packages/excalidraw/wysiwyg/textWysiwyg.tsx`.
  - `onChange` (wired in `App.tsx`) → `updateElement()` → `refreshTextDimensions()` +
    `updateBoundElements()`.
  - `updateWysiwygStyle()` (line 260) re-styles the DOM textarea each scene update and
    contains the container **autogrow/autoshrink** block (lines **326–357**).
- **Canonical recompute (no-edit):** `refreshTextDimensions(textElement, container,
  elementsMap, text?)` at `newElement.ts:420` → wraps at `getBoundTextMaxWidth`, calls
  `getAdjustedDimensions` (`measureText`), returns `{ text, x, y, width, height }`.
  Called from **restore** (`data/restore.ts:853`) and the wysiwyg path (`App.tsx:5730`).
- **Direct scene mutation recompute:** `redrawTextBoundingBox(textElement, container,
  scene)` (`textElement.ts:46`) — used by font-size actions, wysiwyg submit, resize.
- **Container resize → text:** `handleBindTextResize(container, scene, handle, …)`
  (`textElement.ts:142`), reachable from resize and from `updateBoundElements` (binding.ts).
- **Padding:** `BOUND_TEXT_PADDING = 5` (`packages/common/src/constants.ts:357`).
- Bound-text dimension helpers (`textElement.ts`): `getBoundTextMaxWidth` (467),
  `getBoundTextMaxHeight` (492), `computeContainerDimensionForBoundText` (448),
  `computeBoundTextPosition` (222), `getContainerCoords` (356). Each branches per
  container type — we add a `stickynote` branch (same math as `rectangle`).

### 3.3 Render pipeline & the "same frame" guarantee
- Static paint: `packages/excalidraw/renderer/staticScene.ts` renders the container then its
  bound text **immediately after** (`getBoundTextElement` → `renderElement`, lines 357–361).
- Per-element draw: `renderElement.ts` → `drawElementOnCanvas()` (line 387); the
  `rectangle` case calls `rc.draw(ShapeCache.generateElementShape(element, …))` (line 402).
  **This is the hook for the bespoke sticky background.**
- Shape + options: `packages/element/src/shape.ts` — `_generateElementShape` (rectangle
  path) and `generateRoughOptions` (fill/stroke). Cached in `ShapeCache` (WeakMap, keyed by
  element identity + version; invalidated via `ShapeCache.delete`/version bump).
- **Commit loop:** `scene.mutateElement` → (version changed) `scene.triggerUpdate()` →
  `App.triggerRender` → `setState({})` → React commit → `<StaticCanvas>`/`<InteractiveCanvas>`
  repaint. Handlers are wrapped in `withBatchedUpdates` (`unstable_batchedUpdates`), so **all
  mutations issued in one handler coalesce into one paint.** ⇒ The font-fit and the
  container-height change land together **iff** computed synchronously in the same handler.
  The wysiwyg textarea is re-styled in that same batch via the synchronous
  `scene.onUpdate → updateWysiwygStyle` callback, and it reads font size from the element —
  so mutating the element's `fontSize` first keeps the overlay glyphs in lockstep.

### 3.4 Text-geometry helpers (reuse targets)
- Measurement: `measureText`, `getTextWidth/Height`, `getLineWidth`, `charWidth` cache,
  `getLineHeightInPx` (`textMeasurements.ts`). Note: in **test env** each char = 10px.
- Wrapping: `wrapText`, `getWrappedTextLines` (`textWrapping.ts`) — Unicode/CJK/emoji aware;
  reused **as-is** (PR #10001 didn't need to touch it).
- The font-fit needs nothing new from measurement/wrapping — only repeated
  `wrapText` + `measureText` at trial font sizes.

### 3.5 Tool system / toolbar
- `ToolType` union: `packages/excalidraw/types.ts:143`. Add `"stickynote"`.
- `SHAPES` array: `packages/excalidraw/components/shapes.tsx:20` (`toolbar:true` shows on the
  main bar; `laser` is `toolbar:false`). We will **not** add sticky here (it goes in the
  dropdown), unless we later promote it.
- "More tools" dropdown: `packages/excalidraw/components/Actions.tsx` — `frame`/`embeddable`/
  `laser`/`lasso` items at lines **1218–1252**, each `DropdownMenu.Item onSelect={() =>
  app.setActiveTool({ type })}`; selection booleans (~1077) and the trigger-icon ternary
  (~1203–1211). Add a `stickynote` item + `stickyNoteToolSelected` + icon-branch identically.
- Create-on-pointer-down: `App.tsx` `handleCanvasPointerDown` switches on
  `activeTool.type`; generic shapes go through `createGenericElementOnPointerDown(type, …)`
  which calls `newElement`/`newEmbeddableElement` with `currentItem*` defaults and sets
  `state.newElement` for drag-to-size (`dragNewElement`). We add a `stickynote` branch that
  calls `newStickyNoteElement` and (recommended) **auto-enters text editing** on pointer-up
  so the user types immediately.
- i18n: `packages/excalidraw/locales/en.json` `toolBar.*`.

---

## 4. Prior art — PR #10001 (what to take / avoid)

**Approach:** added `containerBehavior: { textFlow:"growing"|"fixed", margin? }` to the
**base element type**, *required* on rectangle/diamond/ellipse; a properties-panel
"Container" fieldset with a Fit-to-text/Sticky toggle **and** a Small/Med/Large margin
selector; **no dedicated tool**. Touched 28 files (constants, appState, restore generic
surgery, charts, flowchart, fixtures, delta) — large blast radius from putting the field on
the base type. Liberal `as any` casts.

**Take (the one genuinely good artifact):** `computeStickyNoteFontSize` — a 1-D search that
**fixes width via the container** and only compares wrapped **height** vs. `getBoundTextMaxHeight`,
snaps font to a step, floors at a min, and **shrinks unconditionally but only regrows up to a
cap** (the font size at edit-session start) so deleting text never inflates past intent.
Reuses `getFontString` + `wrapText` + `measureText` + `getBoundTextMax{Width,Height}`.

**Avoid:**
- Sticky as a required attribute on rectangle/diamond/ellipse (base-type field → ripple).
- The margin Small/Med/Large customization (the "unwanted options" the owner named).
- Running fit logic **only** in `textWysiwyg` (leaves paste/restore/programmatic inconsistent).
- `as any` casts; the big re-indentation diff from nesting sticky logic in an `else`.

---

## 5. Design decision — new type vs. attribute

### 5.1 Recommendation: **new element type `"stickynote"` (as a rectanguloid container)**

**Why new type:**
- The product already wants a **dedicated tool** → it's a first-class concept, not a rectangle
  mode. A rectangle-with-flag leaks into "convert shape type", properties panel, charts,
  flowchart, etc. — exactly the rectangle-exposure the owner disliked.
- Gating is clean: `case "stickynote"` for the bespoke render + sizing, vs. `if (rectangle &&
  flag)` smeared across files.
- **Serialization stays additive**: one new `restoreElement` case. The attribute approach
  (#10001) had to rework `restoreElementWithProperties` generics because it added a field to
  the base type — we avoid that entirely.
- We do **not** add a field to every element; only the sticky carries any new field.

**Why it's cheaper than it sounds:** a sticky note is **geometrically a rectangle**. We make
`ExcalidrawStickyNoteElement` a `ExcalidrawRectanguloidElement` and add `"stickynote"` to the
**existing** rectangle/rectanguloid `case` lists (collision, bounds, shape, transform,
resize). Those are ~10–15 *one-line* additions to lists that already read
`case "rectangle": case "image": case "iframe": …`. The only *new* code is the tool wiring,
the bespoke background render, and the font-fit/Y-shrink — and the latter two are new work
under *either* modeling choice. The compiler's `assertNever` switches enumerate the sites for
us.

**Cost:** must add `"stickynote"` to each exhaustive switch (compiler-guided), a new icon, a
restore case, and thread it through the type-guard lists.

### 5.2 Alternative (fallback): attribute on rectangle/ellipse
Add a single optional, additive flag — e.g. `stickyNote?: true` (NOT on the base type; only
meaningful on rectangle/ellipse) — plus `isStickyNoteElement(el) = (el.type==="rectangle"||
"ellipse") && !!el.stickyNote`. Pros: no new exhaustive-switch entries; reuses rectangle
render path. Cons: the tool would create a flagged rectangle; we must actively *suppress*
sticky elements from the "convert shape type" action, the shape properties that don't apply,
charts/flowchart eligibility, etc. — i.e. spend effort *hiding* rectangle-ness. Net effort is
similar, with worse conceptual cleanliness. Only pick this if minimizing switch-site edits is
paramount.

> **Open decision (confirm before coding): new type vs. attribute.** Spec below is written
> for the **new-type** recommendation; deltas for the attribute path are noted inline where
> they differ.

---

## 6. Detailed design

### 6.1 Data model (new type)
`packages/element/src/types.ts`:
```ts
export type ExcalidrawStickyNoteElement = _ExcalidrawElementBase &
  Readonly<{
    type: "stickynote";
    /** vertical growth ceiling — see §6.4. Defaults to creation height. */
    maxHeight: number;
  }>;
```
- Add to `ExcalidrawElement` union, to `ExcalidrawRectanguloidElement`,
  `ExcalidrawBindableElement`, and `ExcalidrawTextContainer`.
- `maxHeight` is the new field on the **container** (the vertical growth ceiling; see §6.4).

**Per-element base font size (because font is user-pickable).** The bound `text` element's
`fontSize` always holds the *auto-fitted* size (so all measurement/render code is reused
unchanged). The user's chosen size — the cap the fit may regrow up to — is stored as a new
**optional, additive** field on the text element:
```ts
// ExcalidrawTextElement (additive, optional; only meaningful for sticky-bound text)
fontSizeMax?: number;   // user-picked base; auto-fit never exceeds it. defaults to fontSize
```
Rationale: Excalidraw's font-size action (`changeFontSize`) already targets the bound text
element, so the picker naturally writes `fontSizeMax` there and triggers a re-fit. Keeping it
optional/defaulted means non-sticky text and restore are unaffected.

`typeChecks.ts`: add `isStickyNoteElement`; include `"stickynote"` in
`isTextBindableContainer`, `isBindableElement`, the `isExcalidrawElement` switch, and the
rectanguloid predicate used by bounds (`_isRectanguloidElement` in `bounds.ts`). Deliberately
**exclude** it from `isFlowchartNodeElement` and the "convert shape type" set.

`newElement.ts`:
```ts
export const newStickyNoteElement = (
  opts: { type: "stickynote" } & ElementConstructorOpts & { maxHeight?: number },
) => ({
  ..._newElementBase<ExcalidrawStickyNoteElement>("stickynote", opts),
  maxHeight: opts.maxHeight ?? opts.height ?? DEFAULT_STICKY_NOTE_SIZE,
});
```
Defaults (in `@excalidraw/common/constants.ts`): a yellow-ish `backgroundColor`,
`fillStyle:"solid"`, `roughness:0`, `roundness` small/sharp, `DEFAULT_STICKY_NOTE_SIZE`
(square), and font constants:
```ts
export const STICKY_NOTE_MIN_FONT_SIZE = 8;    // auto-fit floor
export const STICKY_NOTE_DEFAULT_FONT_SIZE = 28; // initial `fontSizeMax` at creation
export const STICKY_NOTE_FONT_STEP = 2;        // snap, avoids 13.7px sizes
export const DEFAULT_STICKY_NOTE_SIZE = 160;
export const STICKY_NOTE_PADDING = 12;         // roomier than BOUND_TEXT_PADDING
```

`data/restore.ts`: one additive `case "stickynote"` mirroring `rectangle` + defaulting
`maxHeight ?? height`.

> **Attribute-path delta:** skip the new type; add optional `stickyNote?: true` (+ optional
> `stickyMaxHeight?`) to `ExcalidrawRectangleElement`/`EllipseElement`; `isStickyNoteElement`
> reads the flag; no union/switch edits, but add suppression in convert-shape & charts.

### 6.2 Tool & creation
- `ToolType` += `"stickynote"` (`types.ts`).
- New icon `stickyNoteToolIcon` (`components/icons.tsx`).
- Dropdown item + selection bool + trigger-icon branch in `Actions.tsx` (mirror `frame`).
- Optional `actions/actionStickyNote.ts` registering a `keyTest` shortcut (e.g. `S`),
  imported in `App.tsx` for the side-effecting `register()` (mirror `actionFrame`).
- `App.tsx` pointer-down: branch to `createGenericElementOnPointerDown("stickynote", …)`
  (add `"stickynote"` to its element-construction switch → `newStickyNoteElement`). Support
  click-to-place (default square) **and** drag-to-size. On pointer-up, **auto-start text
  editing** (call the same path `startTextEditing` uses) so the user types immediately —
  the expected sticky UX. Respect tool-lock.
- i18n `toolBar.stickynote: "Sticky note"`.
- **Font-size picker:** sticky notes expose the standard font-size control in shape actions
  (it targets the bound text). Intercept `changeFontSize` so that for sticky-bound text it
  writes `fontSizeMax` (the user's chosen cap) and re-runs the fit, rather than setting the
  rendered `fontSize` directly. Other text props (family, color, align) reuse the normal
  bound-text path.

### 6.3 Rendering (the special style)
Branch in `drawElementOnCanvas` (`renderElement.ts:~394`) for `case "stickynote"`:
- Always paint a **solid** fill (even if `backgroundColor` transparent → fall back to the
  default sticky color), as a rounded rect, with `roughness:0` (no sketchy stroke).
- Optional: subtle drop shadow / 1px darker border / folded corner — additive, behind a flag.
- Implement by adding `"stickynote"` to the `rectangle` arm of `_generateElementShape` +
  `generateRoughOptions` (so geometry/caching is shared) and overriding only the paint style;
  OR draw the fill manually before `rc.draw`. Keep it inside the existing `ShapeCache` flow so
  invalidation (version bump) just works.
- Bound text renders unchanged (staticScene already draws bound text after the container).
- `shouldTestInside`/`hasBackground` must treat sticky as always-filled so click-to-select
  works on the body (it will, once `hasBackground("stickynote")` is true).

### 6.4 The sizing / font-fit algorithm (core)

**Model (recommended): fixed width, font-fit, Y-shrink-to-content, capped regrow.**

Per sticky note: fixed `width W` (horizontal resize sets it; defines wrap width),
`maxHeight` (vertical growth ceiling; set by drag-resize / creation), padding `P`, and font
bounds `[MIN, MAX]` with step — where **`MAX` = the bound text's per-element `fontSizeMax`**
(the user's picked base; defaults to `STICKY_NOTE_DEFAULT_FONT_SIZE`) and
`MIN = STICKY_NOTE_MIN_FONT_SIZE`.

On **every** recompute (typing, paste, programmatic, restore, H/W resize), compute:
```
availW = W - 2P
// 1. Try the max font; wrap to availW; measure height.
// 2. If it fits the ceiling → use max font, and SHRINK the box to hug content.
// 3. Else → pin box to ceiling and SHRINK the font until it fits (or MIN).
function computeStickyNoteTextLayout(W, maxHeight, text, font, lineHeight):
  availW   = W - 2P
  ceilingH = maxHeight - 2P
  // fast path + 1-D search, snapped to STEP:
  fit(size):
     wrapped = wrapText(text, fontString(size), availW)
     h = measureText(wrapped, fontString(size), lineHeight).height
     return { wrapped, h }

  { wrapped, h } = fit(MAX)
  if h <= ceilingH:
     fontSize = MAX
     contentH = h
     boxH     = clamp(contentH + 2P, MIN_BOX_H, maxHeight)   // ← Y-shrink down
  else:
     // binary search largest snapped size in [MIN, MAX] with fit().h <= ceilingH
     fontSize = binarySearchFit(MIN, MAX, ceilingH)          // ← overflow → font shrink
     { wrapped, h } = fit(fontSize)
     contentH = h
     boxH     = maxHeight                                     // pinned to ceiling
  return { text: wrapped, fontSize, width: textWidth(wrapped), height: contentH, boxH }
```
- Mutate the **bound text** (`text, fontSize, width, height`, then position via
  `computeBoundTextPosition`) **and** the **sticky note** (`height = boxH`) in the same
  handler. `maxHeight` only changes when the user drag-resizes vertically.
- **Regrow cap = `MAX` = the element's `fontSizeMax`** (the user's picked base), read from the
  element on every path — so deleting text regrows the font only up to the size the user
  chose, consistently across typing/paste/restore/resize. This fixes #10001's
  edit-session-only cap *and* honors the user-pickable base size. Changing the font picker
  updates `fontSizeMax` and re-fits.
- **Why `maxHeight` exists:** it's the stable ceiling that makes the two behaviors
  non-circular — the box auto-shrinks to content but never auto-grows past `maxHeight`;
  beyond it, the font (not the box) absorbs overflow. Drag-resizing the box vertically sets a
  new `maxHeight`.

**Performance:** binary search over the snapped range `[8,36]` step 2 ⇒ ≤ ~4–5 `fit()`
iterations, each ~1 `wrapText` + 1 `measureText`. Fast path (try MAX first) makes the common
"it fits" case a single iteration. `charWidth` cache already memoizes per-char widths. This
runs per keystroke — acceptable, and strictly cheaper than #10001's linear scan.

**Simpler alternative model (open question §10):** *fixed box, font-only.* The box never
Y-changes during typing (W×H fixed by the user); font always = largest that fits W×H. Drop
`maxHeight`; drop the Y-shrink. Fewer moving parts but doesn't satisfy the brief's explicit
"resize the container on the Y-axis down" bullet, so it's the fallback only if the owner
re-scopes that bullet.

### 6.5 Same-frame guarantee (no layout shift)
Hard rules for the implementation:
- Do the **entire** `computeStickyNoteTextLayout` + all `mutateElement` calls **synchronously
  inside** the triggering handler (`oninput`, `onpaste` after sync text splice, font action,
  resize). **Never** defer to `requestAnimationFrame`, `setTimeout`, or a React effect.
- Issue the bound-text mutation **before** (or together with) the container mutation; both are
  in the same `withBatchedUpdates` batch → one paint.
- In the wysiwyg, ensure `updateWysiwygStyle` runs *after* the element mutation (it already
  does, via `scene.onUpdate`) so the textarea's `font`/size/position match the canvas in the
  same commit. Set the textarea font from the *fitted* element `fontSize` (current code reads
  `getFontString(updatedTextElement)` — correct once fontSize is mutated first).
- On **paste**: the wysiwyg `onpaste` already splices text into the textarea synchronously
  and dispatches `input`; the fit runs in that same `input` handler → same frame. Verify the
  large-paste path doesn't first style the textarea at the old font (avoid the pre-size in
  `onpaste` that #10001-style code left in).

### 6.6 Wiring it into ONE canonical path
To guarantee identical results everywhere and satisfy the consolidation ask:

1. **Consolidate** the duplicated container autogrow/autoshrink (today in
   `redrawTextBoundingBox` `textElement.ts:100–122` *and* `updateWysiwygStyle`
   `textWysiwyg.tsx:326–357`) into one pure function, e.g.
   `computeBoundTextGeometry(container, textElement, metrics, map) → { containerSize?,
   textPosition }`. Both callers use it. (Consolidation Opportunity #1.)
2. Inside that function, branch: `isStickyNoteElement(container)` →
   `computeStickyNoteTextLayout` (font-fit + Y-shrink); else → existing autogrow/autoshrink.
3. Route `refreshTextDimensions`, `redrawTextBoundingBox`, and `handleBindTextResize`
   through it so **typing, paste, restore, font-action, and resize** all share the logic.

This is the key structural improvement over #10001 (single source of truth, all paths).

---

## 7. Helper reuse & consolidation plan

**Reuse as-is:** `wrapText`, `getWrappedTextLines`, `measureText`, `getTextWidth/Height`,
`getLineHeightInPx`, `charWidth`, `getFontString`, `getBoundTextMaxWidth/Height`,
`computeBoundTextPosition`, `computeContainerDimensionForBoundText`, `getContainerCoords`
(extend each per-type branch with a `stickynote` arm == `rectangle`).

**Consolidate (do before adding sticky logic — clean foundation, low risk, well-tested):**
1. **Unify autogrow/autoshrink** into `computeBoundTextGeometry` shared by
   `redrawTextBoundingBox` + `updateWysiwygStyle` (removes the two near-duplicate blocks;
   becomes the single sticky hook). *Tests guarding this: `textWysiwyg.test.tsx`,
   `textElement.test.ts` — keep them green.*
2. **`refreshTextDimensions` vs `redrawTextBoundingBox`** overlap: both wrap+measure; one
   returns, one mutates. Land the shared geometry calc in one place and have both call it
   (don't change their public contracts).
3. **`originalContainerCache`** (`containerCache.ts`) is global mutable state, height-only,
   reset inconsistently. For stickies we **don't need it** (the `maxHeight` field replaces the
   "remembered original height" hack for sticky). Optional broader cleanup: thread the
   original height through the call instead of the global — *medium risk, out of scope for v1,
   note it.*
4. **Naming/FIXMEs:** `textMeasurements.ts` has FIXMEs (`getApproxMinLineWidth` →
   "…ContainerWidth"). Cheap to fix while in here; optional.

**Do NOT disturb (high-value, well-tested):** the wrapping engine internals
(`textWrapping.ts` + `textWrapping.test.ts`, CJK/emoji), the ellipse/diamond inscribed-rect
math (`textElement.test.ts`), and the `autoResize:false`-on-manual-resize behavior
(`resize.test.tsx`).

---

## 8. Implementation plan (phased, file-by-file)

**Phase 0 — Consolidation (no behavior change).**
- `textElement.ts`, `textWysiwyg.tsx`: extract `computeBoundTextGeometry`; route both
  autogrow/autoshrink sites through it. Run `yarn test` — must stay green.

**Phase 1 — Data model + type plumbing (compiler-guided).**
- `element/src/types.ts`: `ExcalidrawStickyNoteElement` + union/grouping membership.
- `element/src/typeChecks.ts`: `isStickyNoteElement`; add to bindable/container/rectanguloid
  predicates + `isExcalidrawElement` switch.
- `element/src/types.ts`: add optional `fontSizeMax?` to `ExcalidrawTextElement`.
- `element/src/newElement.ts`: `newStickyNoteElement`; default the bound text's `fontSizeMax`
  to `STICKY_NOTE_DEFAULT_FONT_SIZE` when creating sticky-bound text.
- `data/restore.ts`: default `fontSizeMax ?? fontSize` in the `text` restore case.
- `common/src/constants.ts`: sticky defaults + font constants; add to `DEFAULT_ELEMENT_PROPS`
  where appropriate.
- `excalidraw/data/restore.ts`: `case "stickynote"`.
- Fix every other `assertNever`/exhaustive switch the compiler flags by adding `"stickynote"`
  to the existing `rectangle` arm (bounds, collision, shape, transform, distance,
  transformHandles, frame/clip, comparisons `hasBackground`, etc.).

**Phase 2 — Rendering.**
- `renderElement.ts` `drawElementOnCanvas`: sticky paint style.
- `shape.ts`: sticky in the rectangle shape/options arm (solid, roughness 0).
- Verify static + interactive scenes + SVG export (`staticSvgScene`) render it.

**Phase 3 — Tool & creation.**
- `excalidraw/types.ts` `ToolType`; `components/icons.tsx`; `components/Actions.tsx` dropdown;
  optional `actions/actionStickyNote.ts` + import in `App.tsx`; `App.tsx` pointer-down branch
  + auto-edit; `locales/en.json`.
- `actions/actionProperties.tsx` `changeFontSize`: for sticky-bound text, write `fontSizeMax`
  + re-fit (instead of setting the rendered `fontSize`). Ensure the font-size picker shows in
  shape actions when a sticky / its bound text is selected or being edited.

**Phase 4 — Sizing behavior.**
- `element/src/stickyNote.ts` (new): `computeStickyNoteTextLayout`.
- Hook into `computeBoundTextGeometry` (Phase 0) so typing/paste/restore/resize all use it.
- Verify the same-frame rules (§6.5).

**Phase 5 — Resize semantics.**
- `resizeElements.ts` / `handleBindTextResize`: horizontal drag → new `W` (re-fit);
  vertical/corner drag → new `maxHeight` (re-fit). Ensure no `autoResize` toggling fights the
  sticky path.

**Phase 6 — Tests & polish (§9).**

> Use the compiler aggressively: after Phase 1, `yarn test:typecheck` enumerates remaining
> switch sites. `yarn test:update` for snapshots; `yarn fix` for lint/format.

---

## 9. Testing plan
- **Unit (`packages/element/tests/`):** `computeStickyNoteTextLayout` — overflow shrinks font
  (down to MIN, snapped); short text Y-shrinks box to content (down to MIN_BOX_H); width
  resize re-wraps & re-fits; vertical resize changes ceiling; deterministic in test env
  (10px/char). Type guards & `newStickyNoteElement` defaults. Restore round-trip.
- **Editor (`textWysiwyg.test.tsx`):** typing past the box shrinks font in-place;
  deleting regrows + Y-shrinks; **paste** fits in one update; no font/size flash (assert the
  element's `fontSize`/`height` and the container `height` are consistent after a single
  input event).
- **Render/snapshot:** sticky renders solid even with transparent `backgroundColor`; bound
  text centered; SVG export.
- **Regression:** existing rectangle/ellipse bound-text tests unchanged (Phase 0 safety).
- **Manual via CDP** (`http://localhost:3006`, port 9223): create from dropdown, type a
  paragraph (watch font shrink with no flash), delete (watch Y-shrink), paste a large block,
  drag-resize H and W, duplicate, undo/redo, dark mode, rotate.

---

## 10. Decisions & remaining open questions

**Decided (owner):**
1. ✅ **Modeling:** new element type `"stickynote"` (rectanguloid container). — §5.1, §6.1
2. ✅ **Sizing:** font-fit + Y-shrink with a drag-set `maxHeight` ceiling. — §6.4. (Working
   reading of "if text is below some min size" = "when text needs less vertical space than the
   box, shrink the box down to a minimum height"; flag if you meant otherwise.)
3. ✅ **Font control:** user-pickable base size via the font picker → stored per element as
   `fontSizeMax`, the auto-fit regrow cap. — §6.1, §6.2, §6.4.

**Still open (lower-stakes, sensible defaults assumed — speak up to change):**
4. **Overflow at MIN font:** when even `MIN` overflows the ceiling — clip (recommended; sticky
   stays put) vs. allow the box to grow past `maxHeight`.
5. **Padding:** dedicated `STICKY_NOTE_PADDING` (roomier) vs. reuse `BOUND_TEXT_PADDING`. No
   per-element margin selector (avoid #10001's customization).
6. **Min box height & default size/color/shadow/folded-corner** — needs a visual pass (CDP).
7. **Scope:** v1 = one bound text + auto-fit + font picker + solid render; defer
   shadows/folded-corner/color presets behind flags.
