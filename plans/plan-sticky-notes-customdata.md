# Plan C — "customData marker": zero element-schema change

**Thesis:** Same architecture as Plan B (a sticky is a `rectangle`), but the marker and sticky fields
live in the **existing** `customData` field instead of new typed columns:
`customData: { stickyNote: { maxHeight, fontSizeMax } }`. `customData` already exists on every element,
is preserved by restore/duplicate/collab automatically (verified), and is public API. So **no change to
`types.ts` and no restore-whitelist change at all** — the schema surface is the smallest possible.

---

## Where sticky-ness lives
`element.customData?.stickyNote` (a small record). Guard:
`isStickyNoteElement(el) => el.type === "rectangle" && !!el.customData?.stickyNote`. The bound text's
`fontSizeMax` lives in the container's `customData.stickyNote` (single home) rather than on the text
element — slightly cleaner than Plan A/B's two-element split, since the text element stays a vanilla
bound text and the policy is read from the container.

## How it meets the §1 requirements
Identical to Plan B (sticky == rectangle + a marker), differing only in *where the marker is stored*.
All font-fit behavior comes from the shared `computeStickyNoteTextLayout`.

## Changes (file-by-file)
- **Types:** none. (`customData` already typed `Record<string, any>` on the base; optionally add a
  named `StickyNoteData` type for ergonomics — ~5 lines, non-breaking.)
- **Restore:** none required for persistence (`restore` preserves `customData` verbatim, verified
  `restore.ts:391`). A post-restore normalization pass still recommended to reconcile the container box
  + clamp (spec §3.6). (~10–20 LOC.)
- **Guard + helpers** (`typeChecks.ts` / a new `stickyNote.ts`): `isStickyNoteElement`,
  `readStickyData`/`writeStickyData`, `clampStickyNoteProps`. (~25 LOC.)
- **Render: data-only, no branch** (same as Plan B; transparent stroke + solid + roughness 0). 0 LOC.
- **Tool/creation/lifecycle:** create a `rectangle`, stamp `customData.stickyNote` + clamp; pointer-up
  default-square + auto-edit. (~100–150 LOC.)
- **Sizing core + recompute hook:** `computeStickyNoteTextLayout` + branch gated on the guard,
  reading/writing `maxHeight`/`fontSizeMax` from `customData`. Apply container half at the usual sites.
  (~170–250 LOC.)
- **Invariant enforcement:** same gated set as Plan B (generic style actions, bg, paste-styles,
  convert-shape-type clears `customData.stickyNote`). Font actions read/write `fontSizeMax` from
  `customData`. (~150–230 LOC.)
- **Resize:** same bypasses as Plan B. (~90–150.)
- **Font-load:** lazy. (~0–40.)

## LOC estimate (rough)
| Area | LOC |
|---|---|
| Types + restore | 5–25 |
| Guard/helpers/normalizer | 25–40 |
| Render | 0 |
| Tool/creation/lifecycle | 100–150 |
| Sizing core + recompute | 170–250 |
| Invariant enforcement | 150–230 |
| Resize | 90–150 |
| Tests | 140–260 |
| **Total** | **~680–1100** |

## Risks / sharp edges
- **`customData` is untyped (`Record<string, any>`)** — readers must defensively validate shape
  (`fontSizeMax` numeric, ≥ MIN). No compiler help; mitigate with a single typed accessor
  (`readStickyData`) used everywhere.
- **Layering taste:** core element/wysiwyg code now reads an app-ish `customData` key to decide
  behavior. `customData` lives on the base element so it's *technically* fine, but some maintainers
  consider behavior-bearing `customData` a smell.
- **Convert-shape is C's sharpest real flaw** *(worse than Plan B's — [review-confirmed])*: `customData`
  **survives** conversion (`newElement.ts:153`), so converting a sticky→ellipse yields an ellipse
  carrying orphaned `customData.stickyNote` — an invalid half-state, **not** a graceful degrade.
  Clearing `customData.stickyNote` on convert is **mandatory**, and the convert popup (auto-shown for
  any rectangle) should be suppressed for stickies.
- **Stroke-control exposure:** `hasStrokeColor("rectangle")===true` → the stroke picker shows on
  stickies; hide/gate it (Plan A gets this free).
- Other integrators already using `customData.stickyNote` would collide — vanishingly unlikely but
  namespacing (`customData.__stickyNote`) is cheap insurance.

## Deferred / optional
- Named `StickyNoteData` type (ergonomics only).
- Skeleton/imperative/font-load hardening — same deferrals as the spec.

## Why pick this / why not
**Pick** for the smallest schema footprint (literally zero `types.ts`/restore-whitelist change) and the
single-home policy (no two-element `fontSizeMax` split). **Avoid** if you want compile-time guarantees on
the sticky fields (Plan B's typed marker) or dislike behavior driven by `customData`.
