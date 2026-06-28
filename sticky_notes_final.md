# Sticky Notes — Final Implementation Plan

This is the **authoritative, decision-locked implementation plan** for the Sticky Note primitive. It
supersedes the exploratory plans (A/B/C/D) and consolidates the design spec
([`sticky_notes.md`](sticky_notes.md)) and the independent review
([`plans/plan-sticky-notes-REVIEW.md`](plans/plan-sticky-notes-REVIEW.md)) into one buildable plan.

Where this plan says "see spec §X", the deep prose/rationale lives in `sticky_notes.md` §X; the
load-bearing decisions and code sites are restated here so this file is implementable on its own. All
`file:line` references are against the `master` working tree and may drift — confirm before relying on a
line number.

---

## 0. Locked decisions (the finalization)

| # | Decision | Consequence |
|---|---|---|
| **D1** | **Approach = Plan A: a dedicated `"stickynote"` element type** (not a rectangle-with-marker). | Isolation + type-safety; chosen for styling divergence, convert-immunity, and correct-by-type invariants. Rationale below. |
| **D2** | **Stickies are NOT convertible** to/from other element types. | The "convert shape type" set deliberately **excludes** `"stickynote"` (spec §3.3). Free for a dedicated type — the convert popup never appears, no suppression code, no orphan-state class of bugs. |
| **D3** | **v1 hitbox/geometry is IDENTICAL to a rectangle.** | The §3.3 membership checklist is a pure "add `"stickynote"` to each **rectangle/rectanguloid arm**" exercise — **no bespoke geometry math**. Bounds, collision, distance, shape, transform, resize all inherit the rectangle behavior verbatim. |
| **D4** | **Rotation is supported.** | **Rotation-aware anchoring (§6) is IN SCOPE, not deferred.** When the fit changes box height on a rotated sticky, `x/y` are adjusted to keep the rotated top-edge midpoint fixed. Rotated-sticky edit + resize tests are required. |
| **D5** | **Styling diverges from rectangles:** flat, non-sketchy, **no stroke/border** in v1. | Bespoke **render** arm (canvas + SVG); `hasStrokeColor("stickynote") === false`; `hasBackground("stickynote") === true`. Only render + text-sizing are bespoke (D3). |
| **D6** | **Always-filled is a by-type data invariant.** | `hasBackground` returns `true` by type (no gating needed for hit-test/binding); `clampStickyNoteProps` keeps `backgroundColor` concrete + `fillStyle:"solid"` + `roughness:0` at every write path. |
| **D7** | **Font model:** rendered `fontSize` = auto-fitted; the user picker sets a per-element **`fontSizeMax`** ceiling. | Auto-fit never grows past `fontSizeMax`; all font actions edit `fontSizeMax`, never the derived `fontSize`. |
| **D8** | **Resize = "zoom the text" model** (vertical drag is a font-growth ceiling; box always re-hugs content). | Confirmed intended (was spec §12 open Q). Rubber-bands past max-font / below min-content. Shift/aspect/multi-select scale `fontSizeMax` proportionally. |
| **D9** | **Skeleton API (`convertToExcalidrawElements`) deferred for v1.** | Guard the `default` arm so a `{type:"stickynote"}` skeleton is rejected, never passed through unconstructed. No public `ExcalidrawElementSkeleton` change in v1. |
| **D10** | **Font-load re-fit = lazy** (re-fit on next interaction), not a version-preserving write. | Avoids the bounds-cache-invalidation hazard (spec §3.6). A restored sticky shows its fallback-measured size until first interaction. |

**Why Plan A (dedicated type) even with D3 (identical v1 hitbox):** the dedicated type pays its one real
cost — the membership checklist — to buy four things a rectangle-with-marker can't give cleanly: (a) D5
styling divergence as a typed render arm rather than an untyped runtime guard; (b) D2 convert-immunity
for free; (c) D6 always-filled / D5 no-stroke **correct-by-type** instead of a perpetual "did we gate
every generic mutator?" surface; (d) headroom to diverge geometry later (folded corner, shadow, distinct
bounds) without re-architecting. The checklist cost is mechanical and made compiler-loud by an exhaustive
`switch` checkpoint (§2 below). See the review for the full trade-off.

---

## 1. Architecture at a glance

- **Type:** `ExcalidrawStickyNoteElement` (`type:"stickynote"`), a *rectanguloid text container* carrying
  one extra field `maxHeight` (font-shrink threshold). Added to the rectangle/rectanguloid `case` lists
  everywhere (D3) so geometry is inherited; **only render + text-sizing are bespoke** (D5).
- **One bound `text` element** per sticky via the existing `containerId`/`boundElements` linkage, carrying
  a new optional `fontSizeMax` (D7).
- **One layout helper** `computeStickyNoteTextLayout(...) → { textUpdates, containerUpdates }` is the
  single source of truth for font-fit + Y-hug + rotation anchoring, invoked from **one** canonical
  recompute path so typing/paste/resize/restore all agree.
- **Same-frame** sizing: the fit and all `mutateElement` calls run **synchronously** in the triggering
  handler (one React commit → one paint). No `rAF`/effects.
- **Always-filled** by type (D6); invariants enforced at the perform level (§7), best-effort at the raw
  imperative boundary (normalize via `restore`).

---

## 2. The membership checklist (the core of Plan A under D3)

Add `isStickyNoteElement` to `typeChecks.ts`. Because v1 hitbox is rectangle-identical (D3), **every**
site below gets the *same arm as `rectangle`* — no new geometry. The compiler flags only the exhaustive
`assertNever` switches; the rest are boolean OR-chains / `default`-returning switches that are **silently
wrong if missed**. Work this list by hand, then add a guard checkpoint (below).

**Compiler-flagged:** `typeChecks.isExcalidrawElement` (`:244`).

**NOT compiler-flagged — add the rectangle-identical `"stickynote"` arm to each:**
- `comparisons.hasBackground` (`comparisons.ts:3`) → **`true`** ⚠️ (gates always-fill + body hit-test +
  binding). `comparisons.hasStrokeColor` → **`false`** for `"stickynote"` (D5, no border).
- `typeChecks.isTextBindableContainer` (`:230`), `isBindableElement`, `isRectangularElement` (`:214`),
  `isEligibleFrameChildType` (`:396`).
- `textElement.VALID_CONTAINER_TYPES` (`:436`) ⚠️ — gates re-opening the editor on a selected sticky
  (`App.tsx:5888`).
- `bounds._isRectanguloidElement`.
- `shape.getElementShape` (`:1074`, polygon group), `_generateElementShape`, `generateRoughOptions`
  (rectangle arm).
- `collision.intersectElementWithLineSegment` (rectangle arm).
- `distance.distanceToElement` (`distance.ts:29`, rectangle arm) ⚠️ — missing arm returns `undefined`,
  breaking arrow-binding + body distance.
- `typeChecks.isUsingAdaptiveRadius` (`:308`) ⚠️ — omit → `null` roundness (square corners). (Add here,
  **or** set `{type: ROUNDNESS.ADAPTIVE_RADIUS}` explicitly in `clampStickyNoteProps`. Prefer adding here.)
- Canvas render switch (`renderElement.ts:881`) + `drawElementOnCanvas` (`:394`) — **bespoke arm** (§4).
- SVG render switch (`staticSvgScene.ts:142`) — **bespoke arm** (§4).
- `data/restore.ts` → `case "stickynote"`; `AllowedExcalidrawActiveTools.stickynote` (`:162`).
- `transform.convertToExcalidrawElements` (`transform.ts:529`) → **guard the `default` arm** (D9).

**Deliberately excluded:** `isFlowchartNodeElement` (`:274`) and the **convert-shape-type set** (D2).

> **Guard checkpoint (mitigates the silent-miss risk):** add one exhaustive `switch (element.type)` (or an
> `assertNever`-backed dev validate pass) over element type in a central spot so future additions of
> `"stickynote"`-relevant branches are compiler-loud. This converts Plan A's dominant risk from a runtime
> bug into a typecheck/test failure.

Type plumbing (`element/src/types.ts`): add `ExcalidrawStickyNoteElement` to the `ExcalidrawElement`
union and to `ExcalidrawRectanguloidElement`, `ExcalidrawBindableElement`, `ExcalidrawTextContainer`.
**Do NOT** add it to `ExcalidrawGenericElement` (it is constructed via `newStickyNoteElement`, not
`newElement`, so it never flows through generic-element code). Add optional `fontSizeMax?: number` to
`ExcalidrawTextElement`.

---

## 3. Data model

### 3.1 Type & constants
```ts
// element/src/types.ts
export type ExcalidrawStickyNoteElement = _ExcalidrawElementBase &
  Readonly<{ type: "stickynote"; maxHeight: number }>;
// ExcalidrawTextElement — additive, optional; only meaningful for sticky-bound text:
fontSizeMax?: number;
```
```ts
// common/src/constants.ts
export const STICKY_NOTE_MIN_FONT_SIZE = 8;       // auto-fit floor
export const STICKY_NOTE_DEFAULT_FONT_SIZE = 28;  // base for new sticky text
export const STICKY_NOTE_FONT_STEP = 2;           // snap; avoids fractional sizes
export const DEFAULT_STICKY_NOTE_SIZE = 160;      // default square (click-to-place)
export const STICKY_NOTE_MIN_HEIGHT = 40;         // Y-shrink floor
export const DEFAULT_STICKY_NOTE_BG = "#ffd43b";  // concrete, non-transparent
// + TOOL_TYPE.stickynote entry (constants.ts:448)
```
Padding reuses `BOUND_TEXT_PADDING = 5`. Do **not** touch global `DEFAULT_ELEMENT_PROPS`; sticky defaults
live only in these constants and are applied via `newStickyNoteElement`/`clampStickyNoteProps`.

### 3.2 `maxHeight` semantics
`maxHeight` is the **font-shrink threshold**: the font is the largest snapped size ≤ `fontSizeMax` whose
wrapped text fits `maxHeight`. The rendered box always **hugs content** at that font — shrinking below
`maxHeight` for short text, growing past it only once the font bottoms out at `MIN` (never clipped).
(Re)set whenever the box height is finalized — drag-end, click-place, vertical resize — never at `0×0`
construction. **Empty text** has nothing to hug → box held at `maxHeight` (§6).

### 3.3 `fontSizeMax` rules (single source of truth — spec §3.2)
- New sticky text: `fontSize = fontSizeMax = STICKY_NOTE_DEFAULT_FONT_SIZE` (ignore `currentItemFontSize`).
- Binding existing text to a sticky: `fontSizeMax = existing fontSize`.
- Restore: preserve `fontSizeMax` only if present; never default it for non-sticky text.
- Unbinding: **clear `fontSizeMax`** so it doesn't leak onto the freed text.
- Always clamped `≥ STICKY_NOTE_MIN_FONT_SIZE` **and snapped to `STICKY_NOTE_FONT_STEP`** on every write
  (so the chosen max lands on the fit grid and is reachable). Layout reads `MAX = max(MIN, fontSizeMax ?? fontSize)`.
- Add `fontSizeMax?` to `newTextElement` opts + `textElementProps` (`newElement.ts:240`) or the seed is dropped.

### 3.4 Constructor & normalizer
```ts
// element/src/newElement.ts
export const newStickyNoteElement = (
  opts: { type: "stickynote" } & ElementConstructorOpts & { maxHeight?: number },
) => {
  const base = _newElementBase<ExcalidrawStickyNoteElement>("stickynote", opts);
  return clampStickyNoteProps({ ...base, maxHeight: opts.maxHeight ?? (base.height || DEFAULT_STICKY_NOTE_SIZE) });
};
```
`clampStickyNoteProps(el)` (the single invariant normalizer, applied at construction, restore,
paste-styles, and the generic property actions):
- `backgroundColor`: transparent → `DEFAULT_STICKY_NOTE_BG`.
- `fillStyle: "solid"`, `roughness: 0`.
- `roundness`: rectangle default via `getDefaultRoundnessTypeForElement(el)` (works once `"stickynote"` is
  in `isUsingAdaptiveRadius`, §2) — else set `{type: ROUNDNESS.ADAPTIVE_RADIUS}` explicitly.

`_newElementBase` defaults `width/height` to `0`; the **default square** comes from the click-to-place
pointer-up path (§5), drag-to-size sets dims during the drag. `maxHeight` is overwritten when box height
is finalized (`0 ?? x` keeps `0`).

**Enforcement boundary:** `clampStickyNoteProps` is wired at user/external write paths (construction,
restore, paste-styles, §7 actions). It is **not** wired into raw `scene.mutateElement` nor the public
imperative `mutateElement`/`updateScene` — those are a **trusted boundary** (D6); integrators normalize
via `restore`. A **dev-only assertion** warns when a `"stickynote"` is left transparent / non-solid.

---

## 4. Rendering (bespoke — D5)

- **Canvas:** branch in `drawElementOnCanvas` (`renderElement.ts:394`) for `case "stickynote"` → paint a
  **solid rounded-rect fill, `roughness:0`, no stroke** (`hasStrokeColor===false`). Add `"stickynote"` to
  the rectangle arm of `_generateElementShape`/`generateRoughOptions` so geometry + `ShapeCache`
  invalidation are shared; override only paint style.
- **SVG export:** explicit `case "stickynote"` in the SVG switch (`staticSvgScene.ts:142`) emitting a flat
  solid rounded `<rect>` (no rough path) for canvas parity.
- Bound text renders as a separate element after the container and is **never clipped** (the box grows to
  fit — §6), so no clip path on any surface.
- Optional polish behind a flag (visual pass): subtle shadow / 1px darker border / folded corner.

Because always-filled is by-type (D6) and `hasBackground` lists `"stickynote"`, body hit-testing
(`collision.ts:82`) and binding traversal need **no** special-casing — they see a normal filled rectangle (D3).

---

## 5. Tool, creation & lifecycle

### 5.1 Registration
- `ToolType` += `"stickynote"` (`excalidraw/types.ts:143`); `TOOL_TYPE` entry; icon `stickyNoteToolIcon`
  (`components/icons.tsx`).
- Desktop dropdown: item + selection bool + trigger-icon branch in `Actions.tsx` (`:1218–1252`, mirror `frame`).
- Mobile dropdown: add to `extraTools` (`MobileToolBar.tsx:158`) + trigger-icon ternary.
- Optional `actions/actionStickyNote.ts` (`keyTest` shortcut), imported in `App.tsx` for `register()`.
- i18n `toolBar.stickynote` (`locales/en.json`).

### 5.2 Pointer creation (mirror `embeddable`)
- Widen `createGenericElementOnPointerDown` (`App.tsx:9511`) param to `… | "stickynote"`; add an
  `else if (elementType === "stickynote")` arm calling `newStickyNoteElement(...)`. Sticky stays **out**
  of `ExcalidrawGenericElement` so it never falls through to the bare `newElement` arm.
- Element starts `0×0`; drag-to-size works via the normal path. A plain click leaves it invisibly small
  → deleted by `isInvisiblySmallElement` (`App.tsx:10990`). So add a **dedicated sticky pointer-up path
  that runs BEFORE the invisible-element cleanup**:
  - **Click** (below drag threshold): assign `DEFAULT_STICKY_NOTE_SIZE` centered on pointer, finalize `maxHeight`.
  - **Drag**: keep dragged dims, finalize `maxHeight` from dragged height.
  - **Both** then auto-start text editing (`startTextEditing`) so the user types immediately. Respect tool-lock.

### 5.3 `startTextEditing` (`App.tsx:6236–6261`)
- **Skip** the `currentItemFontSize`-based min-size pre-grow for sticky containers (the box already has
  its own dims + `maxHeight`).
- Seed the new bound text's `fontSize`/`fontSizeMax` per §3.3 (not `currentItemFontSize`).

### 5.4 Empty-text lifecycle
- Empty submit: existing machinery deletes only the **bound text** and keeps the **container**
  (`App.tsx:5766` `updateElement(..., isDeleted=true)`). The sticky persists; double-click re-creates text.
- A placed-then-escaped empty sticky is **kept at its placed size** (the empty-text rule holds the box at
  `maxHeight`, §6) — not treated as invisibly-small.

### 5.5 Skeleton API — deferred (D9)
`convertToExcalidrawElements` has no `"stickynote"` case; **guard the `default` arm** (`transform.ts:529`)
so a `{type:"stickynote"}` skeleton is rejected/ignored, never passed through unconstructed. No public
`ExcalidrawElementSkeleton` change in v1. (The 3-part recipe to add it later is in spec §5.5.)

---

## 6. Sizing, font-fit & rotation anchoring

Fixed width `W` (wrap width), font-shrink threshold `maxHeight`, padding `P = BOUND_TEXT_PADDING`, font
bounds `[MIN, MAX]` snapped to `STICKY_NOTE_FONT_STEP` where `MIN = STICKY_NOTE_MIN_FONT_SIZE`,
`MAX = max(MIN, fontSizeMax ?? fontSize)`.

```
computeStickyNoteTextLayout(W, maxHeight, originalText, fontFamily, lineHeight, MIN, MAX, angle):
  availW   = max(W - 2P, 1)
  ceilingH = max(maxHeight - 2P, 0)
  fit(size): wrapped = wrapText(originalText, fontString(size), availW)
             h = measureText(wrapped, fontString(size), lineHeight).height
             return { wrapped, h }

  if isBlank(originalText):                       // nothing to hug -> hold at maxHeight
     return { textUpdates: { text:"", fontSize:MAX, ...emptyTextDims(MAX) },
              containerUpdates: { height: max(maxHeight, STICKY_NOTE_MIN_HEIGHT) } }

  fontSize = largestSnappedFit([MIN, MAX], ceilingH) ?? MIN   // binary search; fast-path try MAX first
  { wrapped, h } = fit(fontSize)
  boxH = max(h + 2P, STICKY_NOTE_MIN_HEIGHT)                  // box always hugs content at fitted font

  containerUpdates = { height: boxH, ...anchorAdjust(angle, Δheight) }   // §6 anchoring
  return { textUpdates: { text:wrapped, fontSize, width:textWidth(wrapped), height:h, ...computeBoundTextPosition(...) },
           containerUpdates }
```

- **Takes UNWRAPPED `originalText`**, produces wrapped render text itself (never receive pre-wrapped text,
  or repeated recomputes bake soft wraps — matches `refreshTextDimensions`).
- **Empty text** → box held at `maxHeight` (the §5.4 square), not collapsed to a strip.
- **Regrow cap = `MAX = fontSizeMax`** on every path.
- **Overflow at `MIN`** → font stays `MIN`, box **grows** past `maxHeight` (never clipped); `maxHeight`
  unchanged so deleting text lets it shrink back + regrow.

### 6.1 Resize matrix (D8 — "zoom the text") — `handleBindTextResize` extension
| Gesture | `W` | `maxHeight` | `fontSizeMax` | Effect |
|---|---|---|---|---|
| Horizontal edge (e/w) | set | — | — | re-wrap + re-fit |
| Vertical edge (n/s) | — | set | — | re-fit (font ceiling) — **rubber-bands** at MIN/MAX |
| Free corner (no Shift) | set | set | — | re-wrap + re-fit |
| Shift / aspect corner | ×k | ×k | ×k | proportional **zoom** (no rubber-band) |
| Multi-select resize | ×k | ×k | ×k | per sticky, same as aspect zoom |

The two `fontSizeMax`-scaling rows are exactly the existing `resizeElements.ts` `fontSize`-scaling sites
(`~:914`, `~:1491`) — they must, for stickies, scale **`fontSizeMax`** (clamp+snap via
`setStickyBaseFontSize`) and let the fit re-derive `fontSize`; **never** write the sticky's `fontSize`
directly. Also bypass the non-aspect **min-dimension clamp** (`resizeElements.ts:~784–793`, keyed off the
*current* font) for stickies — it blocks vertical/free-corner **shrink** — replacing it with the sticky
floors (`STICKY_NOTE_MIN_HEIGHT`, width floor from `MIN` font + `2P`). Add an **empty-sticky container-only
path** past `handleBindTextResize`'s no-bound-text early return (`textElement.ts:149`) that still sets
`W`/`maxHeight`.

### 6.2 Rotation anchoring (IN SCOPE — D4)
Anchor = the box's **local top edge** (note grows/shrinks downward in its own frame).
- **Unrotated:** `y` unchanged on auto-recompute.
- **Rotated:** holding raw `x/y` while `height` changes Δ moves the rotated top-edge midpoint → visible
  **drift**. So `anchorAdjust(angle, Δ)` must adjust `x/y` to keep the rotated top-edge midpoint fixed
  (same rotation-aware recomputation the resize handles use — cf. `textElement.ts:192–204`, generalized
  for `angle`). Therefore `containerUpdates` may include `x` and `y`.
- On an **explicit resize**, preserve the dragged handle instead (n/ne/nw anchor the bottom).
- **Tests:** rotated-sticky typing/Y-shrink keeps the visual top edge fixed (no drift); rotated resize
  anchors the dragged handle.

**Performance:** binary search ≤ ~4–5 `fit()` iterations (1 `wrapText` + 1 `measureText` each); fast-path
makes the common "it fits" case a single iteration; `charWidth` memoizes. Cheap per-keystroke.

---

## 7. Same-frame guarantee & invariant enforcement

### 7.1 One owner, one fit (spec §7/§8.1)
The sticky fit lives in a consolidated `computeBoundTextGeometry(container, textElement, metrics, map,
policy) → { textUpdates, containerUpdates }` and runs **once per event**:
- **Live editing — owner is `App.tsx updateElement`** (`:5760`). Today container ownership is split:
  `updateElement` maps the **text** dims, then `scene.onUpdate → updateWysiwygStyle` (`textWysiwyg.tsx:~972`)
  autogrows/autoshrinks the **container**. For stickies, collapse to **one owner**: `updateElement` runs
  the full fit and maps **both** the text and the container in its single `replaceAllElements` call;
  `updateWysiwygStyle` becomes **display-only for stickies** — it **skips** its container
  autogrow/autoshrink and only restyles the textarea DOM from the already-fitted element. `triggerUpdate`
  is synchronous (`Scene.ts:303–309`); `onChange` is `withBatchedUpdates` → one commit → one paint.
- **Non-editing** (resize, font action, restore pass): no wysiwyg mounted; the fit runs directly via
  `redrawTextBoundingBox` / `handleBindTextResize` / the restore post-pass — same helper, same result.
- Never defer to `rAF`/`setTimeout`/effects. Idempotency is a safety net, not the mechanism.
- **Paste:** make the normal-text paste pre-size (`textWysiwyg.tsx:591–612`, uses `currentItemFontSize`)
  **sticky-aware** (skip / size at fitted font) so no wrong-font frame flashes.
- **Raw imperative API** does NOT run the fit (trusted boundary); integrators route through `restore` or
  an optional exposed `refitStickyNote(container, scene)` helper.

### 7.2 Consolidation (Phase 0, behavior-preserving)
Unify the two container autogrow/autoshrink sites — `redrawTextBoundingBox` (grow-only,
`textElement.ts:107–122`) and `updateWysiwygStyle` (grow+shrink, `textWysiwyg.tsx:~326–357`) — into
`computeBoundTextGeometry` taking the caller's grow/shrink `policy`. Keep `yarn test` green. Inside it,
branch `isStickyNoteElement(container) → computeStickyNoteTextLayout` else the existing policy. Apply
`containerUpdates` at every site (`redrawTextBoundingBox`, `handleBindTextResize`, `App.tsx updateElement`,
restore post-pass). `originalContainerCache` is **not used** by stickies (`maxHeight` replaces it).

### 7.3 Perform-level gates (spec §8.2 — actions, not just UI)
Route every mutation through `clampStickyNoteProps` (§3.4) and a new `setStickyBaseFontSize(textEl,
container, size, scene)` (writes `fontSizeMax` clamped+snapped, then re-fits — needs the container + a way
to mutate both elements):
- **Font size** (edit `fontSizeMax`, never derived `fontSize`): `actionProperties.tsx` `changeFontSize` +
  the picker `value` getter (`:813`, show `fontSizeMax ?? fontSize`); relative actions
  `actionIncrease/DecreaseFontSize` (`:852/876`, step from `fontSizeMax ?? fontSize`); `Stats/FontSize.tsx:67`,
  `Stats/MultiFontSize.tsx:83`.
- **Style props** `fillStyle`/`roughness`/`roundness` (`actionProperties.tsx:465/605/1497`): clamp/no-op
  via `clampStickyNoteProps`.
- **Paste styles** (`actionStyles.ts:99/117`): run result through `clampStickyNoteProps`; route copied
  font through `setStickyBaseFontSize`.
- **Background-color action:** disallow `transparent` (clamp to `DEFAULT_STICKY_NOTE_BG`).
- **Bind existing text** (`actionBoundText.tsx:156`): set `fontSizeMax = existing fontSize` + run layout.
- **Unbind** (`actionBoundText.tsx:83`): clear `fontSizeMax`.
- **UI (cosmetic):** hide fill-style / sloppiness / stroke controls; fix roundness. Exact panel set per
  the visual pass.

---

## 8. Restore & fonts (spec §3.6)

- `data/restore.ts`: additive `case "stickynote"` mirroring `rectangle` + `clampStickyNoteProps` + default
  `maxHeight ?? height`; `AllowedExcalidrawActiveTools.stickynote`; in the `text` case preserve
  `fontSizeMax` only if present.
- **Do not re-fit mid-element-restore** (per-element, order-dependent, no `scene`). Instead: (1) restore
  each element trusting **stored** geometry; (2) run a **single post-restore normalization pass** over the
  finished set, running `computeStickyNoteTextLayout` per sticky and applying both halves.
- **Font-load = lazy (D10).** Do **not** mutate geometry on `Fonts.onLoaded`; re-fit on next interaction
  (where `mutateElement` bumps `version` and auto-invalidates every version-keyed cache). Cost: a restored
  sticky shows its fallback-measured size until first interaction. (The version-preserving immediate write
  is left as a future option only if the full cache-invalidation set incl. a new bounds-cache clear is
  wired — see spec §3.6.)

---

## 9. Phased implementation plan (file-by-file)

**Phase 0 — Consolidation (behavior-preserving).** `textElement.ts`, `textWysiwyg.tsx`: extract
`computeBoundTextGeometry`; route both autogrow/autoshrink sites through it with each caller's policy.
`yarn test` stays green.

**Phase 1 — Data model & type plumbing.** `element/src/types.ts` (type + union/grouping membership, NOT
generic; `fontSizeMax?` on text); `element/src/newElement.ts` (`newStickyNoteElement` +
`clampStickyNoteProps`; `fontSizeMax?` on `newTextElement`); `common/src/constants.ts` (constants +
`TOOL_TYPE`); `data/restore.ts` (case + clamp + tool + post-restore pass). **Work the §2 membership
checklist by hand** (rectangle-identical arms, D3) + add the guard checkpoint. Run `yarn test:typecheck`.

**Phase 2 — Rendering (bespoke, D5).** `renderElement.ts` canvas arm (solid, roughness 0, no stroke);
`shape.ts` rectangle-arm membership; `staticSvgScene.ts:142` SVG arm (flat rounded `<rect>`). Verify
canvas/SVG parity. No clip path.

**Phase 3 — Tool, creation & lifecycle.** Registration (`excalidraw/types.ts`, `icons.tsx`, `Actions.tsx`,
`MobileToolBar.tsx`, optional `actionStickyNote.ts`, `locales/en.json`); `App.tsx`
(`createGenericElementOnPointerDown` arm; sticky pointer-up default-square before invisible cleanup +
auto-edit; `startTextEditing` seeding + skip pre-grow; empty-text keep); `transform.ts` guard the
`default` arm (D9).

**Phase 4 — Sizing behavior.** `element/src/stickyNote.ts` (new): `computeStickyNoteTextLayout` (unwrapped
`originalText`; returns both halves; **rotation anchoring, D4**). Hook into `computeBoundTextGeometry`;
apply `containerUpdates` at every site incl. `App.tsx updateElement` + restore pass. Make normal-text
paste pre-size sticky-aware.

**Phase 5 — Font cap & perform-level enforcement (§7.3).** `setStickyBaseFontSize`; route
`actionProperties.tsx` (changeFontSize + picker value + relative actions), `Stats/FontSize.tsx`,
`Stats/MultiFontSize.tsx`, `actionStyles.ts` font copy through it; clamp/no-op
`fillStyle`/`roughness`/`roundness` + background + paste-styles via `clampStickyNoteProps`; `actionBindText`
sets `fontSizeMax`, `actionUnbindText` clears it; hide irrelevant controls.

**Phase 6 — Resize semantics (§6.1) + rotation (§6.2, D4).** `handleBindTextResize`: horizontal→`W`,
vertical/corner→`maxHeight`, rotation-aware `x/y` anchoring. `resizeElements.ts`: redirect the two
bound-text `fontSize` scales (`~:914`, `~:1491`) to `fontSizeMax`; bypass the min-dim clamp
(`~:784–793`); add the empty-sticky container-only path. No `autoResize` toggling fights the sticky path.

**Phase 7 — Tests & visual polish (§10).** Then `yarn test:typecheck`, `yarn test:update`, `yarn fix`.

---

## 10. Testing plan

- **Unit (`packages/element/tests/`):** `computeStickyNoteTextLayout` — overflow shrinks font to `MIN`
  (snapped); no-fit-at-`MIN` grows box past `maxHeight` (no clip/crash); short text Y-shrinks to
  `STICKY_NOTE_MIN_HEIGHT`; width resize re-wraps; vertical resize moves the ceiling; **empty/blank holds
  box at `maxHeight`**; degenerate inputs (`W<2P`, empty, `fontSizeMax<MIN`, odd `fontSizeMax`) don't
  NaN/loop/invert and keep `MAX` on grid; unwrapped-input idempotence; regrow caps at `fontSizeMax`.
  `clampStickyNoteProps`, `hasBackground("stickynote")===true`, `hasStrokeColor("stickynote")===false`,
  guards, `newStickyNoteElement` defaults, `newTextElement` persists `fontSizeMax`, restore round-trip
  (transparent-bg clamp).
- **Editor (`textWysiwyg.test.tsx`):** typing shrinks font in place; delete regrows + Y-shrinks; paste
  (both kinds) fits in one update; **text `fontSize`/`height` and container `height` consistent after a
  single input event (no flash)**; empty submit keeps the sticky at placed size + deletes bound text.
- **Rotation (D4):** rotated sticky typing/Y-shrink keeps the visual top edge fixed (no drift); rotated
  resize anchors the dragged handle.
- **Generic-action invariants (perform-level):** paste-styles from transparent/sketchy source stays
  solid + routes font through `fontSizeMax`; Stats/picker/relative shortcuts honor `fontSizeMax`;
  `fillStyle`/`roughness`/`roundness` clamp/no-op; background rejects transparent; binding sets
  `fontSizeMax`, unbinding clears it; sub-`MIN` clamped.
- **Resize full matrix (§6.1):** horizontal→`W`; vertical→`maxHeight` (rubber-bands at MIN/MAX); free
  corner→both; Shift/aspect + multi-select scale `fontSizeMax` (never derived `fontSize`); vertical/
  free-corner shrink not blocked by min clamp; empty sticky still updates `W`/`maxHeight`.
- **Render/geometry:** solid canvas+SVG parity; body hit-testable/bindable (`shouldTestInside` +
  finite `distanceToElement`); roundness = `ADAPTIVE_RADIUS` (not square); over-min text grows box (no clip).
- **Convert (D2):** the convert-shape popup never appears for a sticky; a sticky is not offered as a
  convert target/source.
- **Restore & fonts:** restored sticky trusts stored geometry; post-restore pass reconciles the container;
  lazy font re-fit on first interaction (no history entry, no collab broadcast).
- **Skeleton (D9):** `convertToExcalidrawElements({type:"stickynote", …})` is rejected/guarded (never a
  malformed element).
- **Imperative API (best-effort):** elements run through `restore` before `updateScene` are clamped; a raw
  `updateScene`/`mutateElement` transparent sticky is not auto-fixed (trusted) but trips the dev assertion.
- **Tool plumbing:** restored tool survives; click-to-place creates a default square (not deleted) + enters
  edit; re-editing a selected sticky re-opens the editor; desktop + mobile dropdowns.
- **Manual via CDP** (`http://localhost:3006`, port 9223): create, type a paragraph (font shrinks, no
  flash), delete (Y-shrink), large paste, drag-resize H/W/corner, **rotate + type (no drift)**, duplicate,
  undo/redo, dark mode.

---

## 11. Resolved questions & remaining deferrals

**Resolved (locked above):** approach = dedicated type (D1); convert disallowed (D2); v1 hitbox =
rectangle (D3); rotation supported + rotation-aware anchoring in scope (D4); styling diverges / no border
(D5); always-filled by-type (D6); font ceiling model (D7); resize = zoom-the-text (D8); skeleton deferred
(D9); font-load lazy (D10).

**Still deferred for v1 (additive follow-ups, no re-architecture):**
- Visual polish behind a flag: drop shadow / folded corner / 1px border / color presets (flip
  `hasStrokeColor → true` to re-enable the stroke pipeline). Pending a CDP visual pass.
- Full skeleton API support (public `ExcalidrawElementSkeleton` member + two switch arms — D9).
- Version-preserving immediate font-load re-fit (vs. the chosen lazy path — D10).
- Imperative-API hard-normalization inside `updateScene` (rejected for per-call collab cost; trusted
  boundary + dev assertion stands).
- Divergent **geometry** (folded-corner hitbox, distinct bounds) — the dedicated type makes this a future
  render/geometry-arm change, no re-architecture (the reason D1 chose the dedicated type despite D3).
