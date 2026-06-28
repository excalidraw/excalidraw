# Plan D — "Lean MVP": smallest diff that satisfies §1, hardening deferred

**Thesis:** Take the lightest marker (Plan C's `customData`), drop **every** piece of work that is
*not* one of the §1 requirements, and ship the smallest thing that behaves correctly for the common
case. This is the minimum-LOC path. It deliberately defers the robustness the later review rounds added
to `sticky_notes.md` (rotation-precise anchoring, skeleton API, imperative-API normalization,
font-load immediate re-fit, the Phase-0 consolidation refactor).

**Important honesty:** this meets the **§1 behavior** (tool, always-filled, font-shrink, Y-hug,
grow-on-overflow, never-clipped, same-frame, user-pickable max) but **not** the full hardened spec. The
deferrals are listed explicitly so the trade is a conscious one, not an accident.

---

## Core simplifications vs Plans B/C
1. **No Phase-0 consolidation.** Don't refactor `redrawTextBoundingBox` + `updateWysiwygStyle` into a
   shared `computeBoundTextGeometry`; branch on `isStickyNoteElement(container)` at the existing
   recompute sites instead. *[review correction]* this is **not** a clean 3-line early-return: the
   live-edit owner `updateElement` (`App.tsx:5721`) today maps only the **text** element, so it must be
   taught to also map the **container**, AND `updateWysiwygStyle`'s container grow/shrink block
   (`textWysiwyg.tsx:327–348`, re-entrant via `scene.onUpdate`) must be **skipped for stickies** or it
   fights the fit and flashes — *three* writers to reconcile, not two. Still cheaper than the refactor,
   but ~30–50 LOC, not 3.
2. **Data-only render.** Solid + `roughness:0` + transparent stroke. No canvas/SVG branch. (0 LOC.)
3. **Lazy font-load.** No `Fonts.onLoaded` hook; a restored sticky re-fits on first interaction. (0 LOC.)
4. **Minimal invariant enforcement.** Clamp at creation + restore + the background-color action +
   paste-styles. Defer gating fillStyle/roughness/roundness/Stats/relative-font/convert-shape (a sticky
   that gets un-stickied by one of these degrades to a plain rectangle — acceptable for an MVP, and the
   dev-only assertion flags it). Hide the irrelevant UI controls (cosmetic, cheap).
5. **No rotation-precise anchoring.** Anchor the unrotated top edge only (the common case). A rotated
   sticky may drift on auto-recompute — listed as a known MVP limitation.
6. **Single-home fields** in `customData.stickyNote` (`maxHeight`, `fontSizeMax`).

## How it meets the §1 requirements
| Requirement | Mechanism | Cut corner |
|---|---|---|
| New tool | rectangle + marker, "more tools" | — |
| Always filled | clamp at create/restore/bg-action/paste | other generic mutators not gated (degrades gracefully) |
| Font-shrink / Y-hug / grow / never-clip | `computeStickyNoteTextLayout` at 3 branch points | — |
| Same-frame | owner `updateElement` runs fit synchronously | — |
| User-pickable max | `fontSizeMax`; font picker + relative actions read/write it | Stats panel not wired (defer) |
| Reuse helpers | maximal | no consolidation refactor |

> **[Review correction — §1 compliance is conditional.]** Two of D's "deferrals" are actually §1
> *requirements*, not hardening: (1) **always-filled** — leaving `fillStyle`/`roughness` (and convert)
> ungated lets a one-click action turn a sticky transparent/sketchy and fail the `collision.ts`
> hit/bind gate. The **background-color action gate + paste-styles bg-clamp are non-negotiable**, and
> the `fillStyle`/`roughness` gates are cheap (~15–40 LOC) and should be kept for a *hard* invariant.
> (2) **user-pickable max** — deferring Stats means `Stats/FontSize.tsx` writes the rendered `fontSize`
> directly and the next fit overrides it. Also: **convert on the `customData` substrate orphans state**
> (clear `customData.stickyNote` on convert, ~5 LOC, non-graceful → pull it forward). With those kept,
> D meets §1; without them, D is **§1-partial** and needs explicit sign-off.

## Changes (file-by-file)
- **Types:** none (`customData`).
- **Guard + core** (`stickyNote.ts`): `isStickyNoteElement`, `clampStickyNoteProps`,
  `computeStickyNoteTextLayout`. (~140–190 LOC incl. the fit algorithm — the irreducible new logic.)
- **Recompute branches:** 3 early-branch insertions (`redrawTextBoundingBox`, the live-edit owner
  `updateElement`, `handleBindTextResize`) + apply container half. (~60–100 LOC.)
- **Tool/creation/lifecycle:** registration + creation arm + pointer-up default-square + auto-edit +
  `startTextEditing` seeding. (~90–140 LOC.)
- **Resize:** fontSize→fontSizeMax bypass + min-clamp bypass + empty-path, gated. (~70–110.)
- **Minimal invariants:** clamp at create/restore/bg/paste; hide UI controls. (~50–90.)
- **Tests:** the fit unit tests + a couple of editor/integration smoke tests. (~120–180.)

## LOC estimate (rough)
| Area | LOC |
|---|---|
| Guard + fit core | 140–190 |
| Recompute branches | 60–100 |
| Tool/creation/lifecycle | 90–140 |
| Resize | 70–110 |
| Minimal invariants + UI hide | 50–90 |
| Tests | 120–180 |
| **Total** | **~530–810** |

## Risks / sharp edges
- **Behavior-vs-spec gap is the whole point** — reviewers must confirm the deferrals are acceptable for
  a first ship. The riskiest deferral is **minimal invariant enforcement**: a sticky can be un-stickied
  by an ungated generic action. Mitigated because (a) it degrades to a valid rectangle, not a crash, and
  (b) the dev assertion + hidden UI reduce the live surface. Still, "always-filled" (§1) is only
  *best-effort* here.
- Rotated-sticky drift is a visible-but-rare defect.
- No consolidation means the sticky branch and the generic autogrow/autoshrink coexist; the early-return
  must be placed so the two never both run (same one-owner discipline as §7, just without the refactor).

## Deferred (explicit)
Rotation-precise anchoring; skeleton API; imperative-API normalization; font-load immediate re-fit;
Phase-0 consolidation; Stats font panel; full perform-level gating of every generic mutator; SVG/canvas
bespoke render. Each is an additive follow-up that does **not** require re-architecting this plan — it's
the same `customData`-rectangle substrate as Plan C, so Plan D can *grow into* Plan C/B incrementally.

## Why pick this / why not
**Pick** to ship the §1 behavior fastest with the least code and iterate. It is a strict subset of
Plan C, so there is no throwaway work — hardening is purely additive. **Avoid** if "always-filled" must
be a hard invariant from day one, rotated stickies are common in your use, or you can't accept shipping
visible deferrals.
