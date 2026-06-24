# Canvas "unrendering" during rapid hover + pan — repro & root cause

**Status:** Root-caused **and fixed** 2026-06-24 — relationship focus is now **click/selection-only**
(hover no longer triggers the reconcile). See "Implemented fix" below.
**Symptom (reported):** While zoomed out on a large imported scene, hovering over many
resources in quick succession and panning makes resources **temporarily disappear /
"unrender"**, then come back.

---

## TL;DR

It is **not** data loss and **not** a culling bug. Elements are never deleted, and the
viewport culler returns correct counts throughout. The cause is **render-cache thrash driven
by the hover relationship-focus reconcile**:

- Every time the hover focus target changes, the focus reducer re-color-"washes" the scene to
  dim unrelated nodes. This replaces **~93% of element objects with new identities** (measured:
  **7397 / 7949** on a single hover) — even when nothing visible changes.
- `ShapeCache` / `elementWithCanvasCache` are keyed by **element object identity** (WeakMaps),
  so new identities = cache miss = the next static repaint must **re-rasterize ~7400 elements**.
- With LOD off at zoom ≈ 0.1 that repaint is heavy, and there is **no hover debounce by
  default**. Rapid hover (esp. crossing back and forth between resources and empty space, which
  toggles focus on/off) fires a storm of full-scene re-washes that **saturate the main thread**.
- The static canvas then lags many frames behind the viewport → at the panned-to position the
  resources are momentarily absent → perceived "unrendering," which resolves once the thread
  catches up.

## Reproduction URL

The exact configuration that triggers it (LOD **off**, zoomed out, large preset):

```
http://localhost:3001/demo?preset=staging-extended-localstack-v2&view=rcll&compact=0&ancillary=1&swimlaneRise=1&reorder=1&crossingMin=1&deBandLevel=none&rankSeparate=1&straighten=1&columnPacking=compact&staircaseBandOverlap=1&lodEnabled=0&lodPreset=detailed&minimap=0&layers=declared
```

Steps: load it, wait for import, `Shift+1` (zoom to fit ≈ 0.1), then hover rapidly across the
resources while panning. The harness below makes this deterministic and measurable.

## Deterministic harness (paste into DevTools console)

Run on the loaded demo URL. It drives a hover-only burst (no panning needed — hover alone
reproduces the stall) and reports frame stalls + per-reconcile element-identity churn.

```js
(async () => {
  const app = window.h.app;
  const scene = window.h.scene;

  // --- instrument: identity churn per scene replace ---
  let prevById = new Map(window.h.elements.map((e) => [e.id, e]));
  const churn = [];
  const base = scene.replaceAllElements.bind(scene);
  scene.replaceAllElements = function (next) {
    const arr = Array.isArray(next) ? next : next?.elements ?? [];
    let changed = 0, opacity = 0, del = 0;
    for (const e of arr) {
      const p = prevById.get(e.id);
      if (p && p !== e) { changed++; if (p.opacity !== e.opacity) opacity++; if (p.isDeleted !== e.isDeleted) del++; }
    }
    churn.push({ total: arr.length, changedIdentity: changed, opacityChange: opacity, deletedToggle: del });
    const r = base(next);
    prevById = new Map(arr.map((e) => [e.id, e]));
    return r;
  };

  // --- drive a rapid hover burst & time frames ---
  const canvas = document.querySelector("canvas.interactive");
  const rect = canvas.getBoundingClientRect();
  const move = (x, y) => canvas.dispatchEvent(new PointerEvent("pointermove",
    { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", isPrimary: true }));
  const frames = [];
  let prev = performance.now();
  for (let i = 0; i < 120; i++) {
    for (let j = 0; j < 3; j++)
      move(rect.left + 200 + ((i * 3 + j) * 53) % (rect.width - 400),
           rect.top + 120 + ((i * 3 + j) * 89) % (rect.height - 240));
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now(); frames.push(Math.round(now - prev)); prev = now;
  }
  scene.replaceAllElements = base; // unhook

  const sorted = [...frames].sort((a, b) => a - b);
  console.table({
    zoom: app.state.zoom.value,
    frameP50: sorted[Math.floor(sorted.length * 0.5)],
    frameP90: sorted[Math.floor(sorted.length * 0.9)],
    frameMax: sorted[sorted.length - 1],
    framesOver100ms: frames.filter((x) => x > 100).length + "/" + frames.length,
    reconciles: churn.length,
    maxChangedIdentity: Math.max(...churn.map((c) => c.changedIdentity)),
    sceneTotal: window.h.elements.length,
  });
})();
```

### Measured (M4 Pro, this repo, 2026-06-24)

| Configuration | frameP50 | frameP90 | frameMax | frames >100ms | identity churn / reconcile |
| --- | --- | --- | --- | --- | --- |
| Hover burst, zoom 0.1, LOD off | 38 ms | **279 ms** | **500 ms** | 33 / 119 | **7397 / 7949** |
| Pan only (isolated single step) | — | — | **3–12 ms** | 0 | 0 |

The contrast is the proof: **panning a static scene is cheap (3–12 ms); hovering is 100–500 ms**
because each focus change re-clones and re-rasterizes ~93% of the scene. `replaceAllElements`
itself is cheap (≈1.6 ms) — the cost is the cache-busted repaint that follows.

## Why it bypassed earlier instrumentation notes

- The static canvas is **not** `desynchronized` in this build, so `getImageData` works for
  pixel-coverage sampling (contrary to an earlier session's assumption).
- The static renderer reaches the bitmap through cached/bound context method references, so
  monkey-patching `CanvasRenderingContext2D.prototype` (or the live context instance) does **not**
  observe its draws. Time renders via `requestAnimationFrame` gaps instead, or sample pixels.

## Existing mitigation levers (all OFF by default)

`TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS` (`terraformRuntimePerformance.ts`) — dev "Runtime
performance" experiments, all default `false`:

- `debounceHoverFocus` — coalesces rapid hover focus changes (would directly cut the storm).
- `suppressHoverFocusBelowZoom` — skips hover focus while zoomed out (where the symptom lives).
- `skipBindingRepairDuringFocus` — skips `repairTerraformEdgeBindings` on focus-only changes.
- `hideAwsIconGlyphsBelowZoom` — fewer elements drawn at low zoom.

Turning these on is a workaround, not a fix.

## Implemented fix (2026-06-24): relationship focus on click, not hover

`useTerraformRelationshipFocusEffect.ts` previously drove `activeFocusNodePath` from
`hoveredPeek || selectedGraphKey`. The hover term meant every pointer move that changed the
hovered resource re-ran the full focus reconcile (the 7397-element re-wash). The fix removes the
hover term entirely — focus is driven by **selection only**:

```ts
const activeFocusNodePath = selectedGraphKey; // was: effectiveHoveredPeek || selectedGraphKey
```

The hovered-peek locals and the hover-debounce effect were deleted along with it. `hoveredElementIds`
is untouched (core Excalidraw still uses it for the element-link selector), and the now-vestigial
`appState.terraformEdgeHoverPeekKey` (never assigned in source) is unaffected.

**Verified live** on the repro URL (M4 Pro, zoom 0.1, LOD off):

| Interaction | Before | After |
| --- | --- | --- |
| Hover sweep (120 moves) | 28 reconciles; frame p90 279 ms / max 500 ms | **0 reconciles**, no stall |
| Click / select a resource | focus (but buried under the hover storm) | **1 reconcile**, focus dimming engages (7389 elements dimmed) |

Now a click selects a resource → exactly one focus reconcile dims the unrelated neighborhood;
clicking empty canvas clears it. Tests: `terraformFocusHoverLoop` + `terraformRuntimePerformance`
green; typecheck clean.

> **Unrelated pre-existing bug observed:** during this session the scene occasionally **emptied to
> 0 elements** after interaction, accompanied by a burst of `restore.ts:256` "Could not repair
> binding for element undefined out of (undefined) elements" errors. This is independent of the
> hover change (it reproduced before any edit) and is **not yet diagnosed** — worth a separate look.

## Candidate fixes (superseded by the click-only fix above — kept for reference)

1. **Debounce hover focus by default** (or rAF-coalesce in `useTerraformRelationshipFocusEffect`)
   so a fast pointer sweep produces one reconcile, not 28.
2. **Preserve element identity when the wash is visually a no-op.** The per-element guard in
   `dimmedTerraformElementOverrides` already returns `null` for already-dimmed-at-same-level
   elements; verify it actually fires across a focus *change* (the measured churn suggests most of
   the 7397 are genuine level transitions when the neighborhood changes — but the very common
   "resource ↔ empty space" toggle re-washes the whole scene each way and is the prime target).
3. **Suppress hover focus while zoomed out** (below the LOD label/icon threshold) — at 0.1 the
   dimming is barely legible anyway, so the full-scene wash buys almost nothing.
4. **Decouple dimming from element identity** — drive focus dimming via a render-time opacity/
   wash overlay keyed by focus set, instead of mutating element color/customData (keeps render
   caches warm). Largest change; best long-term.

## Key files

- `packages/excalidraw/components/useTerraformRelationshipFocusEffect.ts` — hover → focus effect, `replaceAllElements`.
- `packages/excalidraw/components/terraformRelationshipFocus.ts` — `buildTerraformRuntimeFocusUpdate`, per-element `buildTerraformFocusUpdate` (`allElements.map`, line ~388).
- `packages/excalidraw/components/terraformColorWash.ts` — `dimmedTerraformElementOverrides` / `restoredTerraformElementOverrides` (idempotency guards).
- `packages/excalidraw/components/terraformRuntimePerformance.ts` — mitigation flags + defaults.
- `docs/excalidraw-canvas-architecture.md` — render pipeline (this confirms its #1 ranked hotspot).
</content>
</invoke>
