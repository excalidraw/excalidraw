# Sticky Notes — Implementation Spec

A dedicated **Sticky Note** primitive for Excalidraw: a first-class, always-filled text
container whose text auto-fits its box (font shrinks on overflow; the box hugs its content
vertically). This document is the authoritative design. All `file:line` references were
verified against the working tree (branch `dwelle/less-noisy-tests`).

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
    down to hug the content (down to a minimum height).
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
   switches make the compiler enumerate every site to touch.

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
   `backgroundColor`), enforced at every mutation entry point, because hit-testing and binding
   gate on `!isTransparent(backgroundColor)`.

---

## 3. Data model

### 3.1 Sticky note element
`packages/element/src/types.ts`:
```ts
export type ExcalidrawStickyNoteElement = _ExcalidrawElementBase &
  Readonly<{
    type: "stickynote";
    /** vertical auto-size ceiling; set whenever the box height is finalized (§6) */
    maxHeight: number;
  }>;
```
The base type already carries everything else a sticky needs (`backgroundColor`, `fillStyle`,
`roundness`, `boundElements`, `angle`, `opacity`, …). Add the type to the `ExcalidrawElement`
union and to the grouping types `ExcalidrawRectanguloidElement`, `ExcalidrawBindableElement`,
and `ExcalidrawTextContainer`.

`maxHeight` is the only new container field. It is the box's vertical ceiling: the box
auto-shrinks to content but never auto-grows past `maxHeight`; beyond it the font absorbs
overflow. It is (re)set whenever the box height is finalized — drag-to-size end,
click-to-place, and vertical resize — never at `0×0` construction.

### 3.2 Per-element base font size
The font is user-pickable, so the bound `text` element's `fontSize` always holds the
**auto-fitted** size (reusing all measurement/render code unchanged), and the user's chosen
**maximum** is a new optional field:
```ts
// ExcalidrawTextElement — additive, optional; only meaningful for sticky-bound text
fontSizeMax?: number;
```
**Initialization rule (single source of truth):** `startTextEditing` normally seeds new
bound-text `fontSize` from `currentItemFontSize` (`App.tsx:6228`). For stickies:
- **New text created for a sticky:** `fontSize = fontSizeMax = STICKY_NOTE_DEFAULT_FONT_SIZE`
  (ignore `currentItemFontSize`, so stickies have a consistent base).
- **Binding existing text** to a sticky (paste/programmatic): `fontSizeMax = existing fontSize`.
- **Restore:** preserve `fontSizeMax` only if present; never default it for other text.
- Everywhere `fontSizeMax` is read, resolve `fontSizeMax ?? fontSize`.

### 3.3 Type guards
`packages/element/src/typeChecks.ts`: add `isStickyNoteElement`, and include `"stickynote"`
in `isTextBindableContainer` (`:230`), `isBindableElement`, the `isExcalidrawElement` switch
(`:244`), and the rectanguloid predicate used by bounds (`_isRectanguloidElement`,
`bounds.ts`). Deliberately **exclude** it from `isFlowchartNodeElement` (`:274`) and the
"convert shape type" set — a sticky is not a flowchart node and does not convert to a generic
shape.

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
- `roundness`: the fixed sticky roundness.

### 3.6 Restore
`packages/excalidraw/data/restore.ts`: an additive `case "stickynote"` mirroring the
`rectangle` case, then `clampStickyNoteProps` + default `maxHeight ?? height`. Add
`stickynote: true` to `AllowedExcalidrawActiveTools` (`:162`) so a persisted sticky tool
survives reload. In the `text` case, preserve `fontSizeMax` only if present.

---

## 4. Rendering

Bound text already renders immediately after its container in the static scene
(`staticScene.ts:357`), so no change is needed there.

Sticky background — branch in `drawElementOnCanvas` (`renderElement.ts:387`, rectangle arm at
`:394`) for `case "stickynote"`:
- Paint a **solid** rounded-rect fill with `roughness: 0` (no sketchy stroke).
- Add `"stickynote"` to the rectangle arm of `_generateElementShape` and
  `generateRoughOptions` (`shape.ts`) so geometry and `ShapeCache` invalidation are shared;
  override only the paint style.
- Optional polish (behind a flag, pending a visual pass): subtle drop shadow / 1px darker
  border / folded corner.

Because the background invariant is enforced at the data level (§3.5), `hasBackground(
"stickynote")` is `true` and the stored color is never transparent, so body hit-testing
(`collision.ts:82` `shouldTestInside`) and binding traversal (`collision.ts:330`) work with no
special-casing.

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
`createGenericElementOnPointerDown` (`App.tsx:9511`) starts the element at `0×0` and a plain
click leaves it invisibly small, which pointer-up deletes via `isInvisiblySmallElement`
(`App.tsx:10990`, `sizeHelpers.ts:30`). So:
- Add `"stickynote"` to the construction switch → `newStickyNoteElement`; **drag-to-size**
  works normally.
- Add a **dedicated sticky pointer-up path that runs before the invisible-element cleanup**:
  if the gesture was a click (below the drag threshold), assign the default square
  (`DEFAULT_STICKY_NOTE_SIZE`) centered on the pointer and finalize `maxHeight`, then
  **auto-start text editing** (the `startTextEditing` path) so the user types immediately.
  Respect tool-lock.

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
- A click-placed sticky immediately escaped with no text is **kept** (it was deliberately
  placed). This is consistent with how containers behave today and needs no special code
  beyond not treating an empty sticky as invisibly-small.

---

## 6. Sizing & font-fit

A sticky has a fixed width `W` (horizontal resize sets it; defines the wrap width), a vertical
ceiling `maxHeight`, padding `P = BOUND_TEXT_PADDING`, and font bounds `[MIN, MAX]` snapped to
`STICKY_NOTE_FONT_STEP`, where `MIN = STICKY_NOTE_MIN_FONT_SIZE` and `MAX = fontSizeMax ??
fontSize`.

The layout helper takes the **unwrapped** `originalText` and produces the wrapped render text
itself — it must never receive already-wrapped text, or repeated recomputes would bake soft
wraps into the content (this matches `refreshTextDimensions`/`redrawTextBoundingBox`, which
always wrap from `originalText`).

```
computeStickyNoteTextLayout(W, maxHeight, originalText, fontFamily, lineHeight, MIN, MAX):
  availW   = W - 2P
  ceilingH = maxHeight - 2P

  fit(size):                                   // 1 wrap + 1 measure
     wrapped = wrapText(originalText, fontString(size), availW)
     h       = measureText(wrapped, fontString(size), lineHeight).height
     return { wrapped, h }

  { wrapped, h } = fit(MAX)                     // fast path: try the user's base first
  if h <= ceilingH:
     fontSize = MAX
     contentH = h
     boxH     = clamp(contentH + 2P, STICKY_NOTE_MIN_HEIGHT, maxHeight)   // Y-shrink to content
  else:
     fontSize = largest snapped size in [MIN, MAX] with fit().h <= ceilingH   // binary search
     { wrapped, h } = fit(fontSize)
     contentH = h
     boxH     = maxHeight                       // pinned to the ceiling; font absorbed overflow

  return {
    textUpdates:      { text: wrapped, fontSize, width: textWidth(wrapped), height: contentH,
                        ...computeBoundTextPosition(...) },   // x, y inside the box
    containerUpdates: { height: boxH /*, y: see anchoring */ },
  }
```

- **Regrow cap = `MAX = fontSizeMax`**, read from the element on every path, so deleting text
  regrows the font only up to the size the user chose — consistently across typing, paste,
  restore, and resize. Changing the font picker updates `fontSizeMax` and re-fits.
- **Resize semantics** (`handleBindTextResize` extension): horizontal drag → new `W` (re-wrap
  + re-fit); vertical / corner drag → new `maxHeight` (re-fit). The sticky path supersedes the
  container's autogrow.
- **Anchoring (`containerUpdates.y`):** during typing / auto-recompute the **top edge stays
  fixed** (height changes downward, `y` unchanged). During an explicit resize from a north
  handle (`n`/`ne`/`nw`), preserve the dragged handle by adjusting `y` exactly as the existing
  code does (`textElement.ts:192–204`). So `containerUpdates` may include `y`; the typing path
  omits it.
- **Overflow at `MIN`:** if even `MIN` overflows `ceilingH`, the text is clipped (the box
  stays put). The box does not grow past `maxHeight`.

**Performance:** the binary search over the snapped `[MIN, MAX]` range is ≤ ~4–5 `fit()`
iterations (1 `wrapText` + 1 `measureText` each); the fast path makes the common "it fits" case
a single iteration. `charWidth` already memoizes per-character widths. This runs per keystroke
and is comfortably cheap.

---

## 7. Same-frame guarantee (no layout shift)

`scene.mutateElement` → (version changed) `triggerUpdate` → `setState({})` → one React commit
→ one canvas paint. Handlers are wrapped in `withBatchedUpdates`, so all mutations in a handler
coalesce into one paint. Rules:

- Compute `computeStickyNoteTextLayout` and issue **all** `mutateElement` calls (bound text +
  sticky container) **synchronously inside the triggering handler** (`oninput`, paste, font
  action, resize). Never defer to `requestAnimationFrame`, `setTimeout`, or a React effect.
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
   `redrawTextBoundingBox` (`textElement.ts:100–122`) only **grows**; `updateWysiwygStyle`
   (`textWysiwyg.tsx:326–357`) grows **and shrinks** via `originalContainerCache` — so the
   helper takes the caller's grow/shrink `policy` and each caller passes its current one. This
   makes the consolidation behavior-preserving (proven by keeping tests green).
2. Inside it, branch on `isStickyNoteElement(container)` → `computeStickyNoteTextLayout` (§6);
   else the existing autogrow/autoshrink under the caller's policy.
3. **Apply `containerUpdates` at every site:**
   - Scene-mutating callers (`redrawTextBoundingBox`, `handleBindTextResize`, the wysiwyg edit
     path) already hold `scene` and mutate the container; extend them to apply the sticky
     `containerUpdates`.
   - `App.tsx updateElement` must also map/replace the **container** element when the edited
     text is sticky-bound.
   - `restore.ts` must also `Object.assign` the container element (it has no `scene`).

### 8.2 Invariant enforcement across generic actions
Generic style/property actions can otherwise violate sticky invariants. Route them through the
two normalizers (`clampStickyNoteProps` §3.5; a `setStickyBaseFontSize(textEl, size)` that
writes `fontSizeMax` + re-fits):

- **Font size** (rendered `fontSize` is derived; the user edits `fontSizeMax`):
  - `actionProperties.tsx` `changeFontSize` (write) and the picker `value` getter (`:813`,
    currently returns bound-text `fontSize`) → display `fontSizeMax ?? fontSize`.
  - Stats panels mutate `fontSize` directly: `Stats/FontSize.tsx:67`, `Stats/MultiFontSize.tsx:83`.
  - All of the above go through `setStickyBaseFontSize` for stickies.
- **Paste styles** `actionStyles.ts` copies `backgroundColor/fillStyle/roughness/roundness`
  (`:99`) and bound-text `fontSize` (`:117`) directly. For a sticky target, run the result
  through `clampStickyNoteProps` (so a transparent/sketchy source can't un-sticky it) and route
  the copied font size through `setStickyBaseFontSize`.
- **Background-color action/UI:** disallow `transparent` for stickies (clamp to
  `DEFAULT_STICKY_NOTE_BG`).
- **Property controls that don't apply** to the flat sticky look (fill style, sloppiness/
  roughness) are hidden for stickies in shape actions (keeps the UI minimal); roundness is
  fixed. (Exact panel set pending the visual pass — §11.)

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
2. Have `refreshTextDimensions` and `redrawTextBoundingBox` share that one geometry calc
   without changing their public contracts.
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

**Phase 1 — Data model & type plumbing (compiler-guided).**
- `element/src/types.ts`: `ExcalidrawStickyNoteElement` + union/grouping membership; add
  optional `fontSizeMax?` to `ExcalidrawTextElement`.
- `element/src/typeChecks.ts`: `isStickyNoteElement` + membership in bindable / container /
  rectanguloid predicates and the `isExcalidrawElement` switch.
- `element/src/newElement.ts`: `newStickyNoteElement` + `clampStickyNoteProps`.
- `common/src/constants.ts`: sticky constants, `TOOL_TYPE` entry, `DEFAULT_ELEMENT_PROPS`.
- `data/restore.ts`: `case "stickynote"` (+ clamp); `AllowedExcalidrawActiveTools.stickynote`;
  preserve `fontSizeMax` only if present in the `text` case.
- Resolve every other exhaustive switch the compiler flags by adding `"stickynote"` to the
  existing `rectangle` arm (bounds, collision, shape, transform, distance, transformHandles,
  frame/clip, `comparisons.hasBackground`, …).

**Phase 2 — Rendering.**
- `renderElement.ts` `drawElementOnCanvas` sticky paint; `shape.ts` rectangle arm (solid,
  roughness 0). Verify static + interactive scenes and SVG export (`staticSvgScene`).

**Phase 3 — Tool, creation & lifecycle.**
- `excalidraw/types.ts`, `components/icons.tsx`, `Actions.tsx` (desktop), `MobileToolBar.tsx`
  (mobile), optional `actions/actionStickyNote.ts` + import in `App.tsx`, `locales/en.json`.
- `App.tsx`: pointer-down branch; dedicated sticky pointer-up (default square, before
  invisible cleanup) + auto-edit; `startTextEditing` font seeding + skip the wrong-font pre-grow
  (§5.3); empty-text lifecycle keeps the sticky (§5.4).

**Phase 4 — Sizing behavior.**
- `element/src/stickyNote.ts` (new): `computeStickyNoteTextLayout` (takes unwrapped
  `originalText`; returns `{ textUpdates, containerUpdates }`).
- Hook into `computeBoundTextGeometry`; apply `containerUpdates` at every site incl.
  `App.tsx updateElement` and `restore.ts` (§8.1). Make the normal-text paste pre-size
  sticky-aware (§7).

**Phase 5 — Font cap & invariant enforcement across generic actions.**
- `setStickyBaseFontSize` + route `actionProperties.tsx` (`changeFontSize` + picker value),
  `Stats/FontSize.tsx`, `Stats/MultiFontSize.tsx`, and `actionStyles.ts` font copy through it.
- Run `actionStyles.ts` paste result and the background-color action through
  `clampStickyNoteProps`; hide fill/roughness controls for stickies in shape actions.

**Phase 6 — Resize semantics.**
- `handleBindTextResize`: horizontal → new `W`; vertical/corner → new `maxHeight`; anchoring
  per §6. Ensure no `autoResize` toggling fights the sticky path.

**Phase 7 — Tests & visual polish (§11, §12).**

> After Phase 1, `yarn test:typecheck` enumerates remaining switch sites; `yarn test:update`
> for snapshots; `yarn fix` for lint/format.

---

## 11. Testing plan

- **Unit (`packages/element/tests/`):** `computeStickyNoteTextLayout` — overflow shrinks the
  font (to `MIN`, snapped); short text Y-shrinks the box to content (to `STICKY_NOTE_MIN_HEIGHT`);
  width resize re-wraps + re-fits; vertical resize changes the ceiling; takes unwrapped
  `originalText` and is idempotent across repeated recomputes (no baked soft wraps); regrow caps
  at `fontSizeMax`. `clampStickyNoteProps`, type guards, `newStickyNoteElement` defaults, restore
  round-trip (incl. transparent-bg clamp).
- **Editor (`textWysiwyg.test.tsx`):** typing past the box shrinks the font in place; deleting
  regrows + Y-shrinks; paste (both clipboard kinds) fits in one update; assert the text
  `fontSize`/`height` and the container `height` are mutually consistent after a single input
  event (no flash). Empty submit keeps the sticky, deletes the bound text.
- **Generic-action invariants:** paste-styles from a transparent/sketchy source keeps the
  sticky solid + non-transparent and routes font through `fontSizeMax`; Stats font edit and the
  picker honor/display `fontSizeMax`; background action rejects transparent.
- **Render/snapshot:** sticky renders solid; body is hit-testable/bindable
  (assert `shouldTestInside`); SVG export.
- **Tool plumbing:** restored sticky tool survives; click-to-place creates a default square and
  enters edit (not deleted as invisibly-small); desktop + mobile dropdowns.
- **Manual via CDP** (`http://localhost:3006`, port 9223): create, type a paragraph (font
  shrinks, no flash), delete (Y-shrink), large paste, drag-resize H and W, duplicate, undo/redo,
  dark mode, rotate.

---

## 12. Open questions
- **Visual treatment:** default size/color, drop shadow / folded corner, and exactly which
  shape-action controls are hidden vs. fixed for stickies — needs a CDP visual pass.
- **Scope:** v1 = one bound text + auto-fit + user-pickable base size + solid render + invariant
  enforcement. Defer shadow / folded corner / color presets behind flags.
