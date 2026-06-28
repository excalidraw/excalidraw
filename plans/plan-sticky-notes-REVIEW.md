# Sticky Notes — Independent Plan Review (synthesis, **revised**)

Three independent Opus-4.8 reviewers (correctness lens / simplicity-LOC lens / adversarial lens) each
read [`sticky_notes.md`](../sticky_notes.md) + all four plans and **verified every load-bearing claim
against the `master` tree**. This file consolidates their code-checked findings, then **re-weights the
recommendation under two product constraints the team has since fixed** (see box below). The verified
facts are unchanged; the conclusion flips.

Plans reviewed: **A** [faithful](plan-sticky-notes-faithful.md) · **B** [rect-marker](plan-sticky-notes-rect-marker.md) ·
**C** [customdata](plan-sticky-notes-customdata.md) · **D** [lean-mvp](plan-sticky-notes-lean-mvp.md).

> ## ⓘ Updated product constraints (this revision)
> 1. **Stickies are NOT convertible** to/from other element types — convert is a *disallowed*
>    operation, not a behavior to handle gracefully. (Previously treated as an open hazard that the
>    substrate choice had to manage.)
> 2. **Stickies will have distinct styling / geometry** — divergent fill/border/corner/shadow and
>    eventually distinct bounds, not a rectangle wearing a flag.
>
> Both constraints point the same way: **they remove the reasons B/C/D won and restore the reasons A
> exists.** The original review already named constraint 2 as the explicit tipping condition for Plan A
> ("Choose A … only if stickies will soon diverge hard from rectangles … then the isolation justifies
> the membership tax"). That condition is now true. **Net recommendation flips from B → A.**

---

## Verified facts (all three reviewers, code-checked) — and how the two constraints re-weight each

1. **The type-membership tax (Plan A) is real and asymmetric: ~21 sites, ~14 compiler-SILENT.** A new
   `"stickynote"` type must be added to OR-chains/Sets/default-switches (`comparisons.hasBackground`,
   `isRectangularElement`, `isBindableElement`, `isTextBindableContainer`, `isEligibleFrameChildType`,
   `isUsingAdaptiveRadius`, `VALID_CONTAINER_TYPES`, `_isRectanguloidElement`, `getElementShape`,
   `generateRoughOptions`, `distanceToElement`, render switches…). A miss compiles green and ships a
   broken sticky. **— Re-weighted:** this tax is unchanged in size, but it is no longer *avoidable cost*.
   Constraint 2 means **B/C/D must re-introduce its geometry/render subset themselves**
   (`getElementShape`, `_isRectanguloidElement`, `generateRoughOptions`, `distanceToElement`,
   `intersectElementWithLineSegment`, render switches, `isUsingAdaptiveRadius`/corner-radius) — but as
   **untyped runtime `isStickyNoteElement(el)` guards inside hot generic functions**, the *exact*
   compiler-silent failure mode the reviewers flagged as the dominant risk. Plan A pays the **same** work
   as **typed switch arms with exhaustiveness help**. The tax doesn't disappear for B/C/D under
   divergence — it reappears in its most error-prone form. (Behavior-membership arms that don't change
   with styling — `hasBackground`, `isBindableElement`, `isTextBindableContainer`, frames,
   `VALID_CONTAINER_TYPES` — B/C/D still inherit for free; that part of the win survives.)

2. **Plan B's "restore whitelist drops the marker" was FALSE.** `restoreElementWithProperties` spreads
   `...element` first for forward-compat (`restore.ts:399`), so a top-level `isStickyNote`/`maxHeight`
   **survives restore with no whitelist change** (same spread preserves `fontSizeMax` on text). → B's
   restore cost ~3 LOC. **— Unaffected by either constraint** (still true; applies to A's marker fields too).

3. **Convert is now a DISALLOWED operation — the substrate distinction it created collapses.** The
   original review's sharpest B-vs-C/D differentiator was convert behavior (typed marker self-clears →
   graceful; `customData` survives → orphaned invalid sticky). **With convert disallowed, that whole axis
   is moot:**
   - **Plan A:** convert-immune **for free** — `"stickynote"` is not in the generic-convertible set, so
     the popup never appears and the path is unreachable. **0 LOC.**
   - **Plans B/C/D:** the convert popup auto-appears for *any* rectangle-typed element, so all three must
     **suppress it** — identical small cost (~5–10 LOC), and identical between typed-marker and
     `customData` (neither performs a conversion, so "self-clears vs orphans" no longer differs). B's old
     edge over C/D here **evaporates**; C/D's old orphan demerit **evaporates** too (path is unreachable
     once the popup is suppressed).
   - **Net:** convert stops being a differentiator *among* B/C/D, and becomes a clean *free win for A*
     vs a *small uniform cost for B/C/D*.

4. **"Data-only flat render, 0 LOC" (B/C/D) is contradicted by constraint 2.** It was visually correct
   only because a sticky looked *exactly* like a solid `roughness:0` rectangle (the embeddable trick).
   **Distinct styling/geometry voids it:** B/C/D now need a real render branch (canvas + SVG) and
   geometry/hit changes — i.e. they inherit Plan A's render/geometry work after all, minus the type
   safety. The "0 render LOC" line in B/C/D is no longer bankable. Plan A budgeted bespoke render from the
   start (`renderElement.ts`/`staticSvgScene.ts` arms) and gets the stroke-control hidden for free via
   `hasStrokeColor("stickynote")===false`; B/C/D still must hide it manually (`hasStrokeColor("rectangle")===true`).

5. **The "single-owner, same-frame" live-edit recompute is bigger than a "3-line branch" in every plan.**
   Three writers today: `updateElement` (`App.tsx:5721`, text dims only), `updateWysiwygStyle`
   (`textWysiwyg.tsx:327–348`, container grow/shrink, re-entrant via `scene.onUpdate:972`), and grow-only
   `redrawTextBoundingBox` (`textElement.ts:107–122`). A sticky must make `updateElement` map the
   **container** too **and** skip `updateWysiwygStyle`'s container block for stickies, or the generic
   autoshrink fights the fit → per-keystroke flash. **Highest-risk task in any plan; substrate-independent**
   (identical in A/B/C/D). Needs a "container height consistent after one `input` event, no flash" test.
   (`triggerUpdate` is synchronous — `Scene.ts:303–309` — so the same-frame guarantee holds once
   ownership is fixed.)

6. **`customData` (C/D) genuinely round-trips for free** (restore/duplicate/collab/export verified).
   **— Re-weighted:** still true, but its remaining advantage was *small schema footprint*, and its cost
   is *no compile-time typing* (`Record<string,any>`). Under constraint 2 the untyped substrate is worse:
   the new geometry/render/style branches read sticky state with **no compiler help** in exactly the
   places a typo shows up as a silently-broken render/hit-test. The orphan-on-convert cost (its other
   demerit) is gone (#3), but the typing gap it trades against is now more expensive.

7. **Resize is the same hard surface in all plans:** two direct bound-text `fontSize` writes
   (`resizeElements.ts:912–916`, `:1489–1494`) → redirect to `fontSizeMax`; the non-aspect min-dim clamp
   (`:783–793`, keyed off *current* font) blocks sticky shrink → bypass; empty-sticky path past
   `handleBindTextResize`'s no-bound-text early return (`textElement.ts:142–152`) → add. ~90–160 LOC.
   **Substrate-independent.**

8. **The font-fit core (`computeStickyNoteTextLayout`) is identical in all four plans** (~65–190 LOC incl.
   tests) — binary search over snapped `[MIN,MAX]`, empty-text-holds-`maxHeight`,
   grow-past-`maxHeight`-on-min-overflow. Quasi-monotone wrapped-height caveat → budget a linear-scan
   fallback test. **The plan choice is only about marker substrate + gating/divergence — never the core.**

---

## Scorecard (1–5; re-scored under the two constraints)

| Plan | Requirement fit (§1) | Simplicity | Architecture fit | Realistic LOC | Overall |
|---|---|---|---|---|---|
| **A** faithful (new type) | Full — own `hasBackground`/`hasStrokeColor`, convert-immune, **home turf for divergent style/geometry** | 2.5 | **5** | ~1100–1900 (now the work the others also need) | **4.3** |
| **B** rect-marker (typed field) | Full *if* gated — but inheritance it banked on is now partly a liability; geometry/render branches become **untyped runtime guards** | 3 | 3 | ~750–1250 (climbs toward A) | 3.3 |
| **C** customdata | Full *if* gated — convert orphan moot, but untyped substrate worst-fit for new style/geometry branches | 2.7 | 2.5 | ~750–1250 | 2.9 |
| **D** lean-mvp | **§1-partial** as written; data-only render corner **voided** by constraint 2 | 4 | 2.2 | ~650–1000 | 2.7 |

## Consensus ranking (revised)
- **Correctness lens:** A > B > C > D — divergent geometry makes "secretly a rectangle" a latent-bug
  generator; the typed `"stickynote"` switch is the only substrate where the compiler enforces the new
  per-type geometry/render arms.
- **Simplicity/LOC lens:** B > A > C > D — B is still the smallest *fully-typed* diff, but its margin
  over A shrinks sharply once the data-only render + free-inheritance wins are voided; D's MVP corner is
  no longer clean.
- **Adversarial lens:** A > B > C > D — with convert disallowed, A's only real demerit (the membership
  tax) is now *necessary, type-checked* work rather than avoidable busywork, and A has **no un-sticky
  gating surface** (its generic mutators don't apply by type), removing the entire class of "missed gate
  → invalid sticky" bugs that B/C/D carry.

**Net: A is the consensus pick** (two #1s + one #2-by-a-shrinking-margin). The two constraints removed
B's winning arguments (free rectangle inheritance, self-clears-on-convert) and activated A's reason to
exist (hard divergence + isolation).

---

## Recommendation — **Plan A (dedicated `"stickynote"` type)**

**Implement Plan A.** Rationale under the fixed constraints:

- **Divergent style/geometry is exactly what a distinct type is for.** B/C/D's central bet — "a sticky
  *is* a rectangle to every generic helper" — becomes a liability the moment fill/border/corner/bounds
  diverge: they must branch the generic geometry/render helpers with **untyped, compiler-silent runtime
  guards** (fact #1, #4), the single highest-risk pattern the reviewers found. Plan A does the same
  isolation as **typed switch arms the compiler checks for exhaustiveness**.
- **Convert-disallow is free for A, a uniform cost for B/C/D** (fact #3), and it erases the only axis on
  which B used to beat C/D. The original review's recommendation rested heavily on that axis.
- **A has no "un-sticky" gating surface.** Because generic style actions key on element type, they simply
  don't apply to a `"stickynote"`; `hasBackground`/`hasStrokeColor` are correct-by-type (always-filled,
  stroke control hidden, for free). B/C/D's robustness instead depends on **gating every generic mutator**
  — a perpetual "did we cover all of §8.2 + new style controls?" surface that grows with each new style
  knob the divergence introduces.
- The LOC gap that justified B is **smaller than the original table shows**: the geometry/render/convert
  work the table credited to A is now also owed by B/C/D (facts #1, #3, #4), just without type safety.

**The membership-tax mitigation (the one real cost of A) is process, not architecture:** add a single
exhaustive `switch (element.type)` (or `assertNever`) checkpoint so the ~14 compiler-silent sites become
compiler-loud. The reviewers' dominant risk against A is a *test/lint* problem, and a cheap one, whereas
B/C/D's dominant risk (missed runtime guard → silently-broken sticky) has no compiler backstop at all.

**Non-negotiables for §1 (substrate-independent — carry these into Plan A unchanged):**
1. **Background-color invariant** — for A this is by-type (`hasBackground("stickynote")===true` +
   `clampStickyNoteProps`); keep the paste-styles bg-clamp. ~10–15 LOC.
2. **Single-owner live-edit recompute** (map the container in `updateElement` + skip `updateWysiwygStyle`
   for stickies) — skipping it = per-keystroke flash = §1 same-frame violation (fact #5). Highest-risk
   task; needs the "no flash after one input event" test.
3. **The ~65-LOC fit core** (fact #8) + auto-start-editing/default-square on click (else click-placed
   stickies vanish via `isInvisiblySmallElement`) + the resize bypasses (fact #7).

**Safe to defer** (graceful / additive, the spec itself defers): Phase-0 consolidation refactor,
Stats/relative-font wiring *(caveat: deferring Stats lets the fit override a user's Stats font)*, skeleton
API, imperative-API normalization, font-load immediate re-fit, rotation-precise anchoring. **Guard the
skeleton/`convertToExcalidrawElements` default arm** so a raw `{type:"stickynote"}` skeleton is rejected,
not passed through unconstructed (Plan A §"Deferred").

**When B would still be defensible:** only if constraint 2 softens — i.e. stickies stay
*visually/geometrically a rectangle* indefinitely and only differ in text-sizing behavior. Then B's
typed-marker keeps the smallest fully-typed diff and A's isolation is unneeded. Given the team has
committed to distinct styling/geometry, that scenario is off the table. **C/D are not recommended under
either constraint:** C trades typing away precisely where the new branches need it; D's MVP corners
(data-only render, deferred gating) are the ones the constraints void.

---

## Open product question (orthogonal to substrate — still unresolved)
The §6 resize model — vertical drag = font-growth ceiling, so it "rubber-bands" past `MAX`/below
min-font content (spec §12) — is a UX decision independent of substrate. Resolve before building resize.
*(The convert question from the prior revision is now closed: convert is disallowed.)*
