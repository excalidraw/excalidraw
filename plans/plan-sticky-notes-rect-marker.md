# Plan B — "Rectangle subtype": a `rectangle` with a typed marker field

**Thesis:** A sticky *is* a `rectangle` element carrying an additive, typed boolean
`isStickyNote?: true`. Because the element's `type` stays `"rectangle"`, it inherits **all** generic
rectangle behavior for free — geometry, bounds, collision, binding, distance, `hasBackground`,
render, frames, membership — so the entire spec §3.3 "membership checklist" **disappears**. We only
branch on `isStickyNoteElement(el)` at the handful of places where sticky behavior actually differs.

This is the strongest "keep the behavior, cut the code" option that is still fully typed.

---

## Where sticky-ness lives
`isStickyNote?: boolean` on `_ExcalidrawElementBase` (additive optional). Guard:
`isStickyNoteElement(el) => el.type === "rectangle" && el.isStickyNote === true`. `maxHeight` and
`fontSizeMax` exactly as in Plan A.

## What we DON'T touch (the win)
None of: `isExcalidrawElement`, `isRectangularElement`, `isBindableElement`, `isTextBindableContainer`,
`isEligibleFrameChildType`, `VALID_CONTAINER_TYPES`, `_isRectanguloidElement`, `getElementShape`,
`generateRoughOptions`, `distanceToElement`, `intersectElementWithLineSegment`,
`hasBackground`/`hasStrokeColor`. A sticky is already a rectangle to every one of them. **This removes
the single biggest and most error-prone chunk of Plan A.**

## How it meets the §1 requirements
| Requirement | Mechanism |
|---|---|
| New tool | tool creates a `rectangle` + sets `isStickyNote` + `clampStickyNoteProps` |
| Always filled | already-`hasBackground` (it's a rectangle); clamp keeps bg solid |
| Font-fit behaviors | `computeStickyNoteTextLayout`, gated on `isStickyNoteElement` in the recompute path |
| Same-frame | single owner `updateElement` (§7) — gated on the guard |
| User-pickable max | `fontSizeMax`; perform-level font actions gated on the guard |
| Reuse helpers | maximal — sticky == rectangle everywhere except the gated hooks |

## Changes (file-by-file)
- **Types** (`element/src/types.ts`): add `isStickyNote?: boolean` to `_ExcalidrawElementBase`;
  `fontSizeMax?` on text. (~4 lines.)
- **Restore** (`data/restore.ts`): *[review correction]* `restoreElementWithProperties` spreads
  `...element` **first** for forward-compat (`restore.ts:399`), so a top-level `isStickyNote`/`maxHeight`
  on a rectangle **survives a round-trip with no whitelist change**. Only a ~3-line clamp/normalize in
  the rectangle case is needed — not a whitelist. (~3–5 lines.)
- **Guard + normalizer** (`typeChecks.ts`, `newElement.ts`): `isStickyNoteElement`,
  `clampStickyNoteProps`. Use `getDefaultRoundnessTypeForElement` (rectangle already returns adaptive
  — no `isUsingAdaptiveRadius` change needed). (~30 lines.)
- **Render: data-only, no branch.** Sticky is a solid `roughness:0` rectangle with `strokeColor:
  "transparent"` → existing rectangle render already paints it flat (verified). **0 render LOC** (or a
  ~15-line branch if a distinct look/border is wanted later).
- **Tool/creation/lifecycle** (`App.tsx`, toolbar): a sticky tool that calls
  `createGenericElementOnPointerDown` with `"rectangle"` then stamps the marker + clamp; pointer-up
  default-square + auto-edit; `startTextEditing` seeding gated on the guard. (~100–150 LOC.)
- **Sizing core + recompute hook** (`stickyNote.ts` + `computeBoundTextGeometry` branch gated on the
  guard; apply container half at the same sites as Plan A). (~180–260 LOC incl. optional consolidation.)
- **Invariant enforcement / "can't un-sticky"** — *this is where the rectangle approach pays back the
  saved type-churn*: because a sticky IS a generic rectangle, generic actions (fillStyle, roughness,
  roundness, bg→transparent, paste-styles, the **convert-shape popup**, and the **stroke-color
  control** — note `hasStrokeColor("rectangle")===true`) would mutate or un-sticky it. Gate each at
  perform-level via `clampStickyNoteProps`/guard — the set in spec §8.2, plus *hide* the stroke control
  and *suppress* the convert popup. *[review correction]* convert is **not** a state hazard for a typed
  marker: `newElement`'s field-whitelist (`newElement.ts:126–154`) **drops** the top-level
  `isStickyNote` on conversion, so a converted sticky cleanly degrades to a plain shape — no orphan (a
  real edge over Plans C/D). (~140–220 LOC.)
- **Resize** (`resizeElements.ts`): same bypasses as Plan A (fontSize→fontSizeMax, min-clamp bypass,
  empty-path), gated on the guard. (~90–150.)
- **Font-load**: lazy fallback (spec §3.6). (~0–40.)

## LOC estimate (rough)
| Area | LOC |
|---|---|
| Types + restore clamp + guard/normalizer | 25–50 |
| Render | 0–20 |
| Tool/creation/lifecycle | 100–150 |
| Sizing core + recompute | 180–260 |
| Invariant enforcement (gates + hide stroke/convert) | 140–220 |
| Resize | 90–150 |
| Tests | 150–280 |
| **Total** | **~620–1030** |

## Risks / sharp edges
- **Inverse risk vs Plan A:** the question flips from "did we add the type everywhere?" to "did we
  *gate* every generic mutator that could un-sticky / un-fill a note?" — a smaller, enumerable set
  (spec §8.2 + convert popup + stroke control). A missed *style* gate degrades a sticky to a **valid**
  rectangle (graceful) and trips the dev assertion; the typed marker **self-clears on convert**
  (`newElement.ts:126–154`), so convert never orphans state.
- **Stroke-control exposure:** `hasStrokeColor("rectangle")===true`, so the stroke-color picker shows
  on stickies — hide/gate it (Plan A gets this free via `hasStrokeColor("stickynote")===false`).

## Deferred / optional
- Distinct visual treatment / border (data-only render covers v1).
- Skeleton API, imperative-API normalization, font-load immediate re-fit — same deferrals as the spec.

## Why pick this / why not
**Pick** for the best size/robustness trade: ~⅓–½ less code than Plan A, fully typed, no type-membership
tax, and the gating it requires is mostly already in the spec. **Avoid** if you're uncomfortable that a
sticky is "secretly a rectangle" and could be un-stickied by a missed generic-action gate, or if stickies
will diverge hard from rectangles later (then Plan A's isolation is worth it).
