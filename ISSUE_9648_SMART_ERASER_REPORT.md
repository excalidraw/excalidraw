# Issue #9648: Smart topmost erasing

## Summary

This change applies topmost-contact erasing to clicks and drags. A drag no longer queues every element intersecting a pointer-move segment. Instead, it visits screen-space contact samples and exact geometric boundary intersections along that segment, choosing the highest-z eligible element at each contact. The chosen IDs are accumulated for the current gesture; the next gesture sees the newly exposed layer.

## Existing implementation and root cause

Before this change, `EraserTrail.updateElementsToBeErased()` iterated over all visible, unlocked elements and queued every element intersecting each eraser path segment. A stationary click was handled separately in `App.tsx` by adding every element returned by `getElementsAtPosition()`. Both paths could erase underlying elements.

`visibleElements` is produced by `Renderer` in scene order, which preserves the element order used for drawing. Elements later in this list are above earlier ones. The renderer also supplies only visible elements; the eraser excludes locked elements, matching the prior eraser rules.

## Independent algorithm

For each newly received path segment:

1. Use the existing `eraserTest()` as a broad geometric filter to retain only visible, unlocked elements the segment can contact.
2. Create contact parameters along the segment at no more than 4 viewport pixels apart. Also add parameters for the exact intersections of candidate element boundaries with the segment; this avoids depending on samples alone at shape edges.
3. At each ordered contact, test candidates from highest to lowest z-order. A contact uses the existing eraser geometry, plus a small screen-space hit radius matching the eraser indicator.
4. Add only the first eligible element to the pending set for that contact. Multiple contacts along one segment can therefore select different elements where the topmost element changes.
5. On pointer-up, feed the final pointer location through this same path logic before committing deletion. This makes an exact click a zero-length contact rather than a separate all-hit code path.

Pending elements stay in scene order and continue to block lower elements for the rest of that gesture. The deletion itself remains the existing operation: groups are expanded, bound text/container rules are applied, frame children are handled, and arrow bindings are removed. A new pointer gesture starts against the updated scene and can erase an exposed lower layer.

The fixed contact spacing is screen-space, not scene-space, so zoom does not make the number of hit tests grow unexpectedly. Boundary intersections are added for narrow shapes; expanded candidate bounds avoid expensive geometry tests for candidates far from each sample.

## Difference from PR #12353

PR #12353 changes only pointer-up click behavior: it replaces the all-hit click query with `getElementAtPosition()` and leaves drag erasing unchanged. Its group expansion follows the selected point hit.

This implementation does not copy its code or tests. Clicks and drags both use the eraser's contact geometry. Drag segments are partitioned into local contacts, so the topmost choice may change as the path crosses the edge of overlapping shapes; it does not select one global topmost element for the entire drag. The PR's click-only approach cannot provide that per-contact drag behavior.

## Files changed

- `packages/excalidraw/eraser/index.ts` — per-contact topmost selection, boundary/sample parameters, and preserved group/binding cascade.
- `packages/excalidraw/components/App.tsx` — submit pointer-up as the final contact for both click and drag paths.
- `packages/excalidraw/tests/eraser.test.tsx` — 26 interaction regression cases.
- `ISSUE_9648_SMART_ERASER_REPORT.md` — this report.

The existing untracked `ISSUE_9648_REPORT.md` from the previous task was left untouched.

## Regression coverage and results

The regression suite verifies actual scene deletion state:

- Overlapping filled shapes: click and drag delete only the top shape.
- Three overlapping shapes: a drag deletes the middle where it is topmost and the top where it is topmost; the bottom remains.
- Thin line and unfilled shape outlines, plus a curved ellipse.
- Low and high zoom (`0.1x` and `4x`).
- A long drag through 40 overlapping shapes.
- Partial overlap: a path confined to the middle's exposed area deletes only the middle.
- Straight and curved freedraw over an image: the annotation is erased and the image remains.
- Image erasure: an unrelated shape remains.
- Repeated passes: a second pass deletes the newly exposed layer.
- Groups and frames: group members are erased together; erasing a framed child leaves its frame intact.
- Bound text and arrows: the text container cascade is retained and deleting an arrow removes its binding reference.
- Empty canvas, locked elements, Alt restore, and undo/redo.
- Click and drag behavior with mouse, touch, and pen pointers.

## Final review and validation

The review found and fixed an avoidable path-processing cost: every pointer move previously converted the entire gesture trail to scene points even though erasure only processes the newest segment. It now reads only the last two trail points, avoiding repeated O(path length) allocation/work on each move. The existing freedraw/line contact tolerances are shared between the broad-phase and contact test to prevent threshold drift.

The full suite was run after the main implementation and before the final two geometry-only tests and tolerance-helper cleanup. That run had one unrelated loading failure; its test passed when rerun alone. Earlier full-suite timeouts in the 20K fractional-index cases and a flip loading failure also passed when rerun individually. The final focused eraser suite includes all 26 tests.

| Command | Result |
| --- | --- | --- |
| `.\node_modules\.bin\vitest.cmd run` | 149/150 files passed; 2,677 passed, 1 failed, 47 skipped, 1 todo. The lone failure was `packages/element/tests/frame.test.tsx > adding elements to frames > should treat an element fully containing a frame as overlapping the frame` (`Error: still loading`). |
| `.\node_modules\.bin\vitest.cmd run packages\excalidraw\tests\eraser.test.tsx` | Passed: all 26 eraser tests. |
| `.\node_modules\.bin\vitest.cmd run packages\element\tests\fractionalIndex.test.ts` | Passed: all 54 tests, including the two 20K cases that timed out during an earlier full-suite run. |
| `.\node_modules\.bin\vitest.cmd run packages\excalidraw\tests\eraser.test.tsx packages\element\tests\frame.test.tsx -t "eraser topmost contact | should treat an element fully containing a frame as overlapping the frame"` | Passed: 25 selected tests; the isolated frame test passed. |
| `.\node_modules\.bin\vitest.cmd run packages\excalidraw\tests\eraser.test.tsx packages\element\tests\fractionalIndex.test.ts packages\excalidraw\tests\flip.test.tsx` | Eraser and flip tests passed (46 flip tests, 8 skipped); two fractional-index 20K tests timed out at the default 5-second limit in this combined run, then passed in isolation. |
| `.\node_modules\.bin\tsc.cmd --noEmit` | Passed on the final source and test changes. |
| `.\node_modules\.bin\eslint.cmd --max-warnings=0 packages\excalidraw\eraser\index.ts packages\excalidraw\components\App.tsx packages\excalidraw\tests\eraser.test.tsx` | Passed on the final source and test changes. |
| `.\node_modules\.bin\prettier.cmd --check packages\excalidraw\eraser\index.ts packages\excalidraw\components\App.tsx packages\excalidraw\tests\eraser.test.tsx` | Passed. |
| `Set-Location .\excalidraw-app; $env:VITE_APP_DISABLE_SENTRY='true'; ..\node_modules\.bin\vite.cmd build` | Passed. Vite emitted a non-fatal unresolved font-reference warning and a Node child-process deprecation warning. |
| `yarn test:app ...` | Not run: `yarn` is unavailable; local Vitest executables were used. |

No manual browser or physical-device testing was performed.

## Before/after comparison

| Scenario | Original behavior | New expected behavior | Test result |
| --- | --- | --- | --- |
| Click overlapping shapes | All point hits could be deleted | Only the topmost eligible contact is deleted | Passed |
| Drag within overlapping shapes | All intersecting elements were deleted | Only the topmost element at each contact is deleted | Passed |
| Drag through three layers | All intersected layers were deleted | Each layer is selected only where it is topmost | Passed |
| Thin line and unfilled outline | Narrow boundaries could be missed or underlying hits also erased | Contact uses line tolerance and exact boundary parameters; only topmost is erased | Passed |
| Curved ellipse/freedraw | Every intersecting layer could be erased | Curved geometry is tested per contact; underlying image/shape remains | Passed |
| Zoom and long drag | No local topmost filtering | Same contact selection at `0.1x` and `4x`; overlapping layers remain below the top | Passed |
| Partially exposed shape | Underlying elements could be deleted too | Exposed middle is deleted; bottom and uncontacted top remain | Passed |
| Repeated passes | First path could erase all layers | Subsequent path can erase newly exposed layer | Passed |
| Groups, frames, bound text, arrows | Existing eraser cascades apply | Existing cascades and binding cleanup retained | Passed |
| Undo, Alt restore, empty canvas | Existing behavior | Deletion is undoable, pending erasure can be restored, empty canvas remains unchanged | Passed |
| Mouse, touch, pen | Shared all-hit behavior | Shared per-contact behavior | Passed |

## Manual testing instructions

1. From the repository root, run `yarn start` and open the local URL printed by the app.
2. Create a large filled rectangle, a circle overlapping it, and a smaller filled rectangle on top. Select the eraser and drag through the region where all three overlap. Confirm only the top rectangle disappears and the circle and large rectangle remain.
3. Drag from an area where only the circle overlaps the large rectangle into the area covered by the top rectangle. Confirm the circle is erased in the exposed section and the top rectangle is erased only where the path reaches it; the large rectangle should remain.
4. Repeat the same drag. Confirm the newly exposed lower layer can now be erased.
5. Draw a freehand line over an image and erase along the line. Confirm the annotation disappears while the image remains where it was covered by the annotation. Extend the path beyond the line and observe that an exposed image can become the topmost contact.
6. Put two shapes in a group and erase one. Confirm the existing group deletion behavior remains. Put a shape inside a frame and erase the child; confirm the frame remains.
7. Add bound text to a shape and bind an arrow to a shape. Erase the label and arrow separately; confirm bound text follows its container deletion and arrow references are cleaned up.
8. Repeat click and drag tests with mouse, touch, and pen where available. Click empty canvas and try a locked top element to ensure no locked element is deleted.
9. Compare with the pre-change behavior by running the same scenarios on the base commit `701b901a`; before this change, overlapping elements hit by a drag could all be deleted.

## Limitations and recommendation

- Contact sampling is bounded to 4 CSS pixels and augmented by exact boundary crossings. This avoids per-pixel stepping; as with any finite hit sampling, unusual highly complex geometry deserves manual validation.
- The long-drag regression is functional coverage, not a benchmark. Performance on unusually dense real-world scenes should still be checked in a browser.
- Group erasure intentionally retains the existing behavior of erasing the entire group, including group members away from the contact.
- A drag can erase a lower element if it reaches a point where that element is the topmost eligible contact. This is intentional; a later gesture is not required when the path reaches an exposed region during the current drag.
- The full suite had one transient `still loading` failure; the affected frame test passed in isolation. Manual browser and physical-device tests remain unverified.

The implementation is ready for contributor review, with the noted full-suite instability and manual browser/device checks recommended before proposing a PR.
