# C4 implementation proposal — viewport-center math must use the canonical client→scene transform

Fixes finding **C4** from [tta.md](tta.md): *`getViewportCenter` mishandles canvas offset — library embeds insert off-center*.

Companion to [tta_c1.md](tta_c1.md) / [tta_c2.md](tta_c2.md) (same conventions: code anchors are quoted as snippets — line numbers are from review time and may drift, match on the snippet, not the number; implementable without re-deriving the analysis). The change is one function in `packages/excalidraw/TTA/insertAISkeletons.ts` plus tests. No call-site, type, server, or i18n changes.

---

## 1. The bug

[insertAISkeletons.ts:24-45](packages/excalidraw/TTA/insertAISkeletons.ts#L24-L45) hand-rolls the "viewport center in scene coordinates" computation:

```ts
const getViewportCenter = (appState: AppClassProperties["state"]) => {
  const {
    width = 0,
    height = 0,
    scrollX = 0,
    scrollY = 0,
    offsetLeft = 0,
    offsetTop = 0,
    zoom,
  } = appState as AppClassProperties["state"] & {
    offsetLeft?: number;
    offsetTop?: number;
  };

  const zoomValue =
    (zoom && typeof zoom.value === "number" ? zoom.value : 1) || 1;

  return {
    sceneX: (width / 2 - offsetLeft) / zoomValue - scrollX,
    sceneY: (height / 2 - offsetTop) / zoomValue - scrollY,
  };
};
```

The canonical transform is `viewportCoordsToSceneCoords` ([packages/common/src/utils.ts:433-453](packages/common/src/utils.ts#L433-L453)):

```ts
const x = (clientX - offsetLeft) / zoom.value - scrollX;
const y = (clientY - offsetTop) / zoom.value - scrollY;
```

where `clientX/clientY` are **page** coordinates, `offsetLeft/offsetTop` are the canvas container's position in the page (set from `getBoundingClientRect()` in `App.updateDOMRect`/`getCanvasOffsets`), and `width/height` are the canvas dimensions. The viewport center in page coordinates is therefore `clientX = offsetLeft + width / 2`. Substituting:

```
correct:  ((offsetLeft + width / 2) - offsetLeft) / zoom - scrollX  =  (width / 2) / zoom - scrollX
current:  (width / 2 - offsetLeft) / zoom - scrollX
```

`offsetLeft` cancels out of the correct formula; the current code instead treats `width / 2` as if it were already a `clientX`, so the result is wrong by exactly `offsetLeft / zoom` scene units (i.e. `offsetLeft` *screen* pixels) to the left, and `offsetTop / zoom` up. On excalidraw.com the editor is mounted at the page origin (`offsetLeft = offsetTop = 0`), so the two formulas agree there — which is why this was never noticed. Any host embedding the editor with a left/top offset (sidebar layout, page margin, second column) gets AI generations inserted off the visible center, possibly entirely off-screen for large offsets.

Empirically confirmed against the current code (unit-level, 2026-06-12): with `width: 1000, height: 800, offsetLeft: 480, offsetTop: 120, zoom: 1, scroll: 0`, an inserted generation's bounds center lands at `(20, 280)` instead of the visible center `(500, 400)`; with `zoom: 2, scrollX: 100, scrollY: -50` added, it lands at `(-90, 190)` instead of `(150, 250)`.

The in-repo precedent confirming the correct form is `App.addElementsFromPasteOrLibrary` with `position: "center"` ([components/App.tsx](packages/excalidraw/components/App.tsx), search for `addElementsFromPasteOrLibrary`):

```ts
        : this.state.width / 2 + this.state.offsetLeft;
// ...
    const { x, y } = viewportCoordsToSceneCoords(
      { clientX, clientY },
      this.state,
    );
```

— library inserts and paste already center correctly in embeds; TTA inserts don't. (`centerScrollOn` in [scene/scroll.ts](packages/excalidraw/scene/scroll.ts#L31-L58) corroborates: the scene point at the visual center satisfies `scenePoint.x = width / 2 / zoom - scrollX` — no offset term.)

Two adjacent facts, verified:

1. **The `as ... & { offsetLeft?: number }` cast is dead weight.** `AppClassProperties["state"]` is `AppState` ([types.ts:785-787](packages/excalidraw/types.ts#L785-L787)), and `AppState` declares all seven fields as required: `scrollX`/`scrollY` ([types.ts:378-379](packages/excalidraw/types.ts#L378-L379)), `zoom: Zoom` ([types.ts:385](packages/excalidraw/types.ts#L385)), `width`/`height`/`offsetTop`/`offsetLeft` ([types.ts:439-442](packages/excalidraw/types.ts#L439-L442)). The cast (and the `= 0` defaults it enables) papers over nothing real.
2. **The zoom guard is equally vestigial.** `zoom.value` is a `NormalizedZoomValue` clamped to `MIN_ZOOM = 0.1` ([packages/common/src/constants.ts:303](packages/common/src/constants.ts#L303), `getNormalizedZoom`), so `0`/`NaN` is unreachable through the app.

### Blast radius — who reaches `getViewportCenter`

`getViewportCenter` has exactly one consumer, `convertAISkeletonsToSceneElements` ([insertAISkeletons.ts:143-149](packages/excalidraw/TTA/insertAISkeletons.ts#L143-L149)), and is **only** used when `options.targetCenter` is absent. Every call path, verified:

| Call path | `targetCenter` | Affected? |
|---|---|---|
| [useAIStreamingCanvasPreview.ts:223-239](packages/excalidraw/TTA/useAIStreamingCanvasPreview.ts#L223-L239) — streaming canvas draft | `previousHandle?.targetCenter ?? undefined` | **Yes, on the first rendered frame of each generation** (handle is `null`); every later frame is pinned to where the first one landed (see §3) |
| [TTADialog.tsx:653](packages/excalidraw/TTA/TTADialog.tsx#L653) — `handleInsertResult` (insert a chat result onto the canvas) | none | **Yes** — the most user-visible path |
| [TTADialog.tsx:1149](packages/excalidraw/TTA/TTADialog.tsx#L1149) — `executeDelete` re-inserting the latest remaining result | none | **Yes** |
| [TTADialog.tsx:552](packages/excalidraw/TTA/TTADialog.tsx#L552) — `getElementsForMessage`, consumed only by `exportImageFromMessageSkeletons` (retry reference image) | none | Calls the buggy code, but `exportToBlob` crops to element bounds — absolute placement is irrelevant, **no observable effect** |
| [useAIAssistantPreview.ts:105-107](packages/excalidraw/TTA/useAIAssistantPreview.ts#L105-L107) — `renderAIAssistantPreviewDataUrl` (chat thumbnails) | `{ x: 0, y: 0 }` | **No** — bypasses `getViewportCenter` entirely |

Fixing the one function fixes all three affected paths at once; the two unaffected paths can't regress because they never reach it (or don't observe position).

## 2. Desired behavior

| Scenario | Today | After fix |
|---|---|---|
| Host embeds editor at page origin (excalidraw.com: `offset = 0`) | centered | **unchanged** — formulas are identical at offset 0 |
| Host embeds editor with `offsetLeft/offsetTop > 0`, insert AI result | shifted left/up by `offset / zoom` scene units (`offset` screen px) | dead center of the visible canvas |
| Streaming draft, first rendered frame | whole generation appears off-center once | appears centered |
| Streaming draft, subsequent frames | pinned to the first frame's (wrong) center — no jitter | pinned to the first frame's (correct) center — still no jitter |
| Any caller passing `targetCenter` (previews, tests) | bypasses the formula | unchanged |
| Empty-bounds fallback (`Number.isFinite` guard at [insertAISkeletons.ts:151-156](packages/excalidraw/TTA/insertAISkeletons.ts#L151-L156)) | falls back to destination | unchanged |
| Zoomed/scrolled viewport, offset 0 | centered | unchanged (regression-pinned by a new test) |

Non-goals (explicitly out of scope): accounting for UI overlays (the TTA panel is `position: fixed` and covers part of the canvas — "center of the canvas" ≠ "center of the unobscured area"; see §8); refactoring `convertAISkeletonsToSceneElements`; touching the preview hooks; the two pre-existing unrelated test failures in this file (§6).

## 3. Design decisions (so nobody re-litigates them mid-implementation)

- **Reuse `viewportCoordsToSceneCoords`, don't fix the inline formula.** A corrected inline formula (`(width / 2) / zoomValue - scrollX`) would be right *today*, but this bug exists precisely because a hand-rolled copy of the transform drifted from the canonical one. Routing through the shared helper kills the formula-drift class of bug and makes TTA inserts provably consistent with library/paste inserts (`addElementsFromPasteOrLibrary` uses the identical `offsetLeft + width / 2` → `viewportCoordsToSceneCoords` pattern). Feasibility verified: the helper is exported from `@excalidraw/common` (`export * from "./utils"` in [packages/common/src/index.ts:12](packages/common/src/index.ts#L12)); sibling TTA files already import from that package ([TTADialog.tsx:10](packages/excalidraw/TTA/TTADialog.tsx#L10) `randomId`, `TTAComposer.tsx`, `useAIStreamingLifecycle.ts`), as do `App.tsx`, `scene/scroll.ts`, and `Hyperlink.tsx` for this very function — no import-cycle risk (`common`'s only reference back to `@excalidraw/excalidraw` is type-only), and the test environment resolves the alias (the test file itself imports `getFontString` from `@excalidraw/common` today).
- **Drop the cast, the `= 0` defaults, and the zoom guard.** All fields are required on `AppState` (§1), the zoom value is clamped (§1), the canonical helper and every other consumer of these fields (`addElementsFromPasteOrLibrary`, `centerScrollOn`, `sceneCoordsToViewportCoords`) do zero defensive checking, and both TTA test harnesses construct complete fixtures (`width/height/scrollX/scrollY/offsetLeft/offsetTop/zoom`). Keeping bespoke defensiveness here would preserve the "this code distrusts its own types" smell the review flagged. A host passing a hand-rolled partial `AppClassProperties` mock is the same (accepted) trust model as everywhere else in the editor.
- **Keep the `{ sceneX, sceneY }` return shape.** `viewportCoordsToSceneCoords` returns `{ x, y }` (branded `GlobalCoord` — structurally `{ x: number; y: number }`, so destructuring yields plain numbers). Mapping to `{ sceneX, sceneY }` inside `getViewportCenter` keeps the single consumer at [insertAISkeletons.ts:143-144](packages/excalidraw/TTA/insertAISkeletons.ts#L143-L144) untouched — zero call-site churn.
- **Why the bug shows as a one-shot offset, not per-frame jitter** (worth knowing for QA): the streaming preview's insert options use `targetCenter: previousHandle?.targetCenter ?? undefined` ([useAIStreamingCanvasPreview.ts:225](packages/excalidraw/TTA/useAIStreamingCanvasPreview.ts#L225)); after each partial insert the handle stores `targetCenter: getElementsCenter(inserted)` ([useAIStreamingCanvasPreview.ts:264-267](packages/excalidraw/TTA/useAIStreamingCanvasPreview.ts#L264-L267)), so only the **first** rendered frame of a generation consults `getViewportCenter` — every later frame (including the final `isComplete` one) re-centers onto wherever the first frame landed. The fix therefore changes where the generation *first* appears and nothing about frame-to-frame stability. No changes to the hook are needed or wanted.
- **Fix the source, not the callers.** It would be tempting to make affected call sites pass an explicit `targetCenter` — that would triplicate the center computation and leave the broken helper as a trap for the next caller. Scope stays: one function.

## 4. Implementation steps

All in `packages/excalidraw/TTA/insertAISkeletons.ts`.

### Step 1 — add the import

Find:

```ts
import { convertToExcalidrawElements } from "@excalidraw/element";
```

Replace with:

```ts
import { convertToExcalidrawElements } from "@excalidraw/element";

import { viewportCoordsToSceneCoords } from "@excalidraw/common";
```

(Placing `@excalidraw/common` after the `@excalidraw/element` block matches [TTADialog.tsx:3-10](packages/excalidraw/TTA/TTADialog.tsx#L3-L10) and `scene/scroll.ts`; run `yarn fix` and let the import-order lint settle the exact slot.)

### Step 2 — replace `getViewportCenter`

Find (the whole function, quoted in §1):

```ts
const getViewportCenter = (appState: AppClassProperties["state"]) => {
  const {
    width = 0,
    height = 0,
    scrollX = 0,
    scrollY = 0,
    offsetLeft = 0,
    offsetTop = 0,
    zoom,
  } = appState as AppClassProperties["state"] & {
    offsetLeft?: number;
    offsetTop?: number;
  };

  const zoomValue =
    (zoom && typeof zoom.value === "number" ? zoom.value : 1) || 1;

  return {
    sceneX: (width / 2 - offsetLeft) / zoomValue - scrollX,
    sceneY: (height / 2 - offsetTop) / zoomValue - scrollY,
  };
};
```

Replace with:

```ts
const getViewportCenter = (appState: AppClassProperties["state"]) => {
  // Viewport center in client (page) coordinates: the canvas occupies
  // `width`×`height` px starting at `offsetLeft`/`offsetTop`. Routing through
  // the canonical client→scene transform (rather than hand-rolling it) keeps
  // this in lockstep with how the rest of the editor centers content — see
  // `addElementsFromPasteOrLibrary`'s `position: "center"` handling. Note the
  // offsets cancel out of the math; a previous inline version dropped them on
  // the wrong side and inserted off-center in embedded hosts (C4 in tta.md).
  const { x, y } = viewportCoordsToSceneCoords(
    {
      clientX: appState.offsetLeft + appState.width / 2,
      clientY: appState.offsetTop + appState.height / 2,
    },
    appState,
  );

  return { sceneX: x, sceneY: y };
};
```

That's the entire production change. ⚠️ Do **not** be tempted to "simplify" to `viewportCoordsToSceneCoords({ clientX: appState.width / 2, ... })` — that reintroduces exactly the original bug (treating a canvas-local coordinate as a page coordinate); the `offsetLeft + width / 2` shape is load-bearing and mirrors `addElementsFromPasteOrLibrary` verbatim.

> If reuse were ever blocked (it isn't — verified in §3), the fallback would be the corrected inline formula `sceneX: (width / 2) / zoomValue - scrollX` with a comment citing `viewportCoordsToSceneCoords`. Tradeoff: no new import, but the transform exists in two places again and can drift again. Not recommended; documented only so the decision is visible.

## 5. Invariants to preserve (regression watch-list)

- **Offset-0 behavior is bit-identical.** At `offsetLeft = offsetTop = 0` the new and old formulas are algebraically equal (`(0 + w/2 − 0)/z − s` vs `(w/2 − 0)/z − s`) — excalidraw.com sees no change. Pinned by test (c) in §6.
- **`targetCenter` callers bypass this function entirely** ([insertAISkeletons.ts:146-149](packages/excalidraw/TTA/insertAISkeletons.ts#L146-L149) — `options?.targetCenter ?? { x: viewportCenterSceneX, ... }`): the assistant-preview thumbnails (`{x: 0, y: 0}`), all streaming frames after the first, and every existing test that passes `targetCenter: { x: 0, y: 0 }` are unaffected by construction.
- **Return shape `{ sceneX, sceneY }`** stays — the destructuring at [insertAISkeletons.ts:143-144](packages/excalidraw/TTA/insertAISkeletons.ts#L143-L144) compiles unchanged.
- **The non-finite-bounds fallback** ([insertAISkeletons.ts:151-156](packages/excalidraw/TTA/insertAISkeletons.ts#L151-L156)) is downstream of the destination and untouched.
- **Streaming pinning** (`previousHandle.targetCenter` round-trip in `useAIStreamingCanvasPreview`) is untouched — only the value the first frame derives changes.
- **`exportImageFromMessageSkeletons`** keeps working: it converts at whatever center and exports bounds-cropped; the center change is invisible to it.

## 6. Tests

Extend [insertAISkeletons.test.ts](packages/excalidraw/TTA/insertAISkeletons.test.ts). The harness builds a mock `app` whose `state` is a hard-coded object cast `as AppClassProperties["state"]` (`width/height: 1000`, zeros elsewhere, `zoom: { value: 1 }`); nearly every existing test passes `targetCenter: { x: 0, y: 0 }`, and the two that don't ("handles arrows that bind to frames", "does not force cross-frame arrows into a child frame") never assert positions — **there is currently no centering assertion anywhere**, which is the test-level reason C4 survived.

⚠️ **Pre-existing failures, not yours**: on the current branch this file already fails 2/12 tests for unrelated reasons (`verifies near-threshold bound text wraps and restores single-line text` — text stays wrapped; `does not force cross-frame arrows into a child frame` — `frameId` is set). Verified failing *before* any C4 change (2026-06-12). Don't chase them here; acceptance is scoped to "no test that passed before regresses" (§7, and see §8).

### 6a. Harness: allow `appState` overrides

Find:

```ts
const createTestApp = (initialElements: ExcalidrawElement[] = []) => {
```

Replace with:

```ts
const createTestApp = (
  initialElements: ExcalidrawElement[] = [],
  appStateOverrides: Partial<AppClassProperties["state"]> = {},
) => {
```

Find:

```ts
      zoom: { value: 1 },
      selectedElementIds: {},
    } as AppClassProperties["state"],
```

Replace with:

```ts
      zoom: { value: 1 },
      selectedElementIds: {},
      ...appStateOverrides,
    } as AppClassProperties["state"],
```

All existing call sites pass one argument and are unaffected.

### 6b. Imports

Find:

```ts
import {
  getBoundTextMaxWidth,
  isTextElement,
  measureText,
  type ExcalidrawElementSkeleton,
} from "@excalidraw/element";
```

— add `getCommonBounds,` to the list (after `getBoundTextMaxWidth,`). Find:

```ts
import type { AppClassProperties } from "../types";
```

Replace with:

```ts
import type { AppClassProperties, NormalizedZoomValue } from "../types";
```

⚠️ `zoom.value` is the branded `NormalizedZoomValue`; a bare `zoom: { value: 2 }` inside a `Partial<AppClassProperties["state"]>` argument fails `yarn test:typecheck` (the existing harness only gets away with `{ value: 1 }` because the *whole* state literal is cast). Use the established test idiom `2 as NormalizedZoomValue` (see `tests/flip.test.tsx`, `tests/clipboard.test.tsx`). Plain-number fields (`width`, `offsetLeft`, `scrollX`, …) need no cast.

### 6c. Shared assertion helper

Add below the existing `getById` helper:

```ts
const getInsertedBoundsCenter = (
  inserted: readonly NonDeletedExcalidrawElement[],
) => {
  const [minX, minY, maxX, maxY] = getCommonBounds(inserted);
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
};
```

(`convertAISkeletonsToSceneElements` itself centers via `getCommonBounds`, so asserting on the same bounds is exact, not approximate. Use plain rectangles in these tests — no bound text — so `fixBoundTextElements` can't shift geometry post-insert.)

### 6d. New cases

Append inside the existing `describe("insertAISkeletons", ...)` block, after the last `it`. Expected values below are derived in §1 and were verified empirically against the current code (the "before" values are what today's code actually produces).

```ts
  it("centers inserted elements in the visible viewport when the canvas has a page offset", () => {
    const { app } = createTestApp([], {
      width: 1000,
      height: 800,
      offsetLeft: 480,
      offsetTop: 120,
    });

    const inserted = insertAISkeletons(app, [
      { type: "rectangle", id: "rect-1", x: 0, y: 0, width: 100, height: 50 },
    ]);

    // Scene-space viewport center is (width / 2) / zoom - scroll; the canvas
    // page offset cancels out of the client→scene transform and must NOT
    // shift the result (C4 in tta.md: the old formula landed this at
    // (20, 280) — i.e. offset px to the left/top of the visible center).
    const center = getInsertedBoundsCenter(inserted);
    expect(center.x).toBeCloseTo(500);
    expect(center.y).toBeCloseTo(400);
  });

  it("centers inserted elements with offset, zoom and scroll combined", () => {
    const { app } = createTestApp([], {
      width: 1000,
      height: 800,
      offsetLeft: 480,
      offsetTop: 120,
      scrollX: 100,
      scrollY: -50,
      zoom: { value: 2 as NormalizedZoomValue },
    });

    const inserted = insertAISkeletons(app, [
      { type: "rectangle", id: "rect-1", x: 0, y: 0, width: 100, height: 50 },
    ]);

    // x: (1000 / 2) / 2 - 100 = 150 ; y: (800 / 2) / 2 - (-50) = 250
    // (old formula: (-90, 190))
    const center = getInsertedBoundsCenter(inserted);
    expect(center.x).toBeCloseTo(150);
    expect(center.y).toBeCloseTo(250);
  });

  it("keeps offset-0 centering unchanged at zoom/scroll (excalidraw.com regression)", () => {
    const { app } = createTestApp([], {
      width: 1000,
      height: 800,
      scrollX: 100,
      scrollY: -50,
      zoom: { value: 2 as NormalizedZoomValue },
    });

    const inserted = insertAISkeletons(app, [
      { type: "rectangle", id: "rect-1", x: 0, y: 0, width: 100, height: 50 },
    ]);

    // Identical before and after the fix — pins the offset-0 behavior.
    const center = getInsertedBoundsCenter(inserted);
    expect(center.x).toBeCloseTo(150);
    expect(center.y).toBeCloseTo(250);
  });
```

Tests (a) and (b) fail against current code with exactly the "before" values noted in the comments; test (c) passes both before and after (verified — current code already yields `(150, 250)` at offset 0).

### 6e. Commands

```bash
yarn test:typecheck
yarn vitest run packages/excalidraw/TTA/insertAISkeletons.test.ts
```

### 6f. Manual QA (honest version)

There is no zero-effort end-to-end repro in the repo: `examples/with-script-in-browser` *does* embed the editor with real offsets (`.excalidraw-wrapper { height: 800px; margin: 50px }` plus a button header above — `offsetLeft = 50`, larger `offsetTop`), but TTA is not wired into it and `insertAISkeletons` is not on the package export surface, so you can't trigger the affected path there without wiring `TTADialog` up. The unit tests in §6d carry the regression burden; for a visual sanity check use excalidraw-app with a forced offset:

1. Run excalidraw-app (`yarn start`) against a TTA backend; open devtools.
2. Force an offset: `document.body.style.paddingLeft = "400px"` (or add a margin to the editor's container). The editor's `ResizeObserver` → `updateDOMRect` picks it up; confirm with the dev handle: `h.app.state.offsetLeft` → `400` (call `h.app.refresh()` if it hasn't updated).
3. **Comparator**: paste any elements (or insert a library item) — the paste path uses the correct transform today and lands dead center. 
4. **Before**: generate via TTA (or click an existing chat result's insert-to-canvas action — [TTADialog.tsx:653](packages/excalidraw/TTA/TTADialog.tsx#L653) path, no backend round-trip needed if history has a result) → the generation lands ~400 px left of where the pasted comparator landed. **After**: both land in the same place, centered in the visible canvas.
5. Regression: remove the padding (offset back to 0), repeat — placement unchanged from today. Also spot-check a streamed generation at zoom ≠ 1: the draft should appear centered on its first frame and stay put while streaming (no jitter — §3).

## 7. Acceptance criteria

- [ ] `getViewportCenter` computes the center via `viewportCoordsToSceneCoords({ clientX: offsetLeft + width / 2, clientY: offsetTop + height / 2 }, appState)`; the `as ... & { offsetLeft?: number }` cast, the `= 0` defaults, and the zoom guard are gone.
- [ ] Return shape `{ sceneX, sceneY }` and the `convertAISkeletonsToSceneElements` call site are unchanged; no other production file is touched.
- [ ] With `offsetLeft/offsetTop > 0`, inserted generations' bounds center equals `((width / 2) / zoom - scrollX, (height / 2) / zoom - scrollY)` — not shifted by the offset (tests 6d-a, 6d-b pass).
- [ ] Offset-0 behavior is unchanged (test 6d-c passes before *and* after the change).
- [ ] `yarn test:typecheck` clean (including the `NormalizedZoomValue` cast in the new test).
- [ ] `yarn vitest run packages/excalidraw/TTA/insertAISkeletons.test.ts`: the three new tests pass and no previously-passing test in the file regresses (the two pre-existing failures noted in §6 are tracked separately).
- [ ] Manual QA per §6f: TTA insert lands where a paste lands, with and without a forced container offset.

## 8. Follow-ups (do not bundle)

- **Two pre-existing failures in this test file** (`verifies near-threshold bound text wraps...`, `does not force cross-frame arrows into a child frame`) fail on the branch before this change — they look like behavior drift in text wrapping / frame-membership of bound arrows, unrelated to centering. Triage separately before release.
- **UI-aware centering**: `getViewportCenter` (like `addElementsFromPasteOrLibrary`) centers on the raw canvas, but the TTA panel is `position: fixed` over the canvas — a generation can appear centered-yet-half-covered while the dialog is open. `App.getEditorUIOffsets()` + the `offsets` parameter of `centerScrollOn` already exist for exactly this; a product-level decision on whether AI inserts should center in the *unobscured* region.
- **Duplicate mock-state fixtures**: `insertAISkeletons.test.ts` and `useAIStreamingCanvasPreview.test.tsx` hand-roll the same `app.state` shape; if a third TTA harness appears, extract a shared `createMockAppState(overrides)`.
- **tta.md C4 wording nit**: generations land shifted by `offset / zoom` *scene units* — which is `offset` *screen pixels* — left/up of center; the entry says "shifted by `offset/zoom`" without the unit/direction. Cosmetic; the entry is otherwise accurate (and its claim that the fields exist on `AppState` is confirmed above).
