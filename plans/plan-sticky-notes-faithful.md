# Plan A — "Faithful": dedicated `"stickynote"` element type

**Thesis:** Implement exactly what [`sticky_notes.md`](../sticky_notes.md) specifies — a new first-class
element type `"stickynote"`. Maximum isolation from generic-element code, maximum type-safety, at
the cost of the most surface area.

This plan is the **baseline** the others are measured against. It is the *largest* but the *most
robust*: a sticky can never silently flow through generic-element code, because it is its own type.

---

## Where sticky-ness lives
A new union member `ExcalidrawStickyNoteElement` (`type: "stickynote"`) carrying one extra field
`maxHeight`; bound text carries `fontSizeMax`. Everything keys on `type === "stickynote"` via an
`isStickyNoteElement` guard.

## How it meets the §1 requirements
| Requirement | Mechanism |
|---|---|
| New tool in "more tools" | `ToolType`/`TOOL_TYPE` + Actions.tsx/MobileToolBar dropdowns |
| Always filled | `clampStickyNoteProps` + `hasBackground("stickynote")===true` |
| Font shrinks / Y-hug / grow-on-overflow / never clipped | `computeStickyNoteTextLayout` (the shared core, §6 of spec) |
| Same-frame | single owner `App.tsx updateElement` runs fit synchronously (§7) |
| User-pickable max | `fontSizeMax` on bound text, perform-level font actions |
| Reuse helpers, no new deps | per-type arms added to existing helpers |

## Changes (file-by-file) — follows the spec's phased plan §10
- **Types** (`element/src/types.ts`): new `ExcalidrawStickyNoteElement`; add to `ExcalidrawElement`,
  `ExcalidrawRectanguloidElement`, `ExcalidrawBindableElement`, `ExcalidrawTextContainer` (NOT
  `ExcalidrawGenericElement`); optional `fontSizeMax?` on `ExcalidrawTextElement`.
- **Membership checklist** (the expensive part — ~15–20 sites, spec §3.3): `isExcalidrawElement`,
  `hasBackground`, `isUsingAdaptiveRadius`, `isTextBindableContainer`, `isBindableElement`,
  `isRectangularElement`, `isEligibleFrameChildType`, `VALID_CONTAINER_TYPES`, `_isRectanguloidElement`,
  `getElementShape`, `_generateElementShape`, `generateRoughOptions`, `distanceToElement`,
  `intersectElementWithLineSegment`, canvas + SVG render switches, restore case + `AllowedExcalidrawActiveTools`.
- **Constructor / normalizer** (`element/src/newElement.ts`): `newStickyNoteElement`,
  `clampStickyNoteProps`.
- **Render** (`renderElement.ts`, `staticSvgScene.ts`): bespoke flat-fill arm (or reuse rectangle
  arm with `hasStrokeColor===false`).
- **Tool/creation/lifecycle** (`App.tsx`, `Actions.tsx`, `MobileToolBar.tsx`, icons, i18n):
  registration + `createGenericElementOnPointerDown` arm + pointer-up default-square + auto-edit +
  `startTextEditing` seeding.
- **Sizing core** (`element/src/stickyNote.ts`): `computeStickyNoteTextLayout`.
- **Recompute path** (Phase 0 consolidation `computeBoundTextGeometry`; apply container half at
  `updateElement`, `redrawTextBoundingBox`, `handleBindTextResize`, restore post-pass).
- **Invariant enforcement** (perform-level, spec §8.2): font actions, Stats, paste-styles,
  fill/roughness/roundness/bg actions, bind/unbind.
- **Resize** (`resizeElements.ts` fontSize→fontSizeMax + min-clamp bypass + empty-path; rotation
  anchoring).
- **Font-load** (`Fonts.onLoaded`) re-fit hook or lazy fallback (spec §3.6).

## LOC estimate (rough)
| Area | LOC |
|---|---|
| Type + membership checklist | 250–400 |
| Constructor/normalizer/guards | 60–100 |
| Render (canvas+SVG) | 40–80 |
| Tool/creation/lifecycle | 100–160 |
| Sizing core + consolidation + apply-sites | 200–320 |
| Invariant enforcement | 150–250 |
| Resize | 90–160 |
| Font-load + restore | 40–80 |
| Tests | 200–350 |
| **Total** | **~1100–1900** |

## Risks / sharp edges
- The §3.3 membership checklist is **compiler-silent** in many places (OR-chains, default switches);
  a missed site is a latent bug (e.g. miss `hasBackground` → broken hit-test/binding). This is the
  dominant risk and the reason the plan is large.
- Two-element coupling (`maxHeight` on container, `fontSizeMax` on text) must stay in sync across
  duplicate/restore/undo.
- Every future `assertNever`/switch on element type now must consider `"stickynote"`.

## Deferred / optional
- Skeleton API (`convertToExcalidrawElements`) — defer (spec §5.5), but **guard the default arm**:
  it's a *soft* `assertNever` that emits a raw unconstructed element, so a `{type:"stickynote"}` skeleton
  must be rejected, not passed through.
- Font-load immediate re-fit — default to lazy (spec §3.6).

## Why pick this / why not
**Pick** if long-term correctness and isolation matter more than diff size, or if stickies will grow
features that diverge from rectangles (folded corner, shadow, presets). **Avoid** if you want a small,
low-risk diff: the type-membership tax is real and mostly mechanical busywork.
