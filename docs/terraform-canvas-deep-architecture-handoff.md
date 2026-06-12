# Terraform canvas deep runtime architecture handoff

**Audience:** The next agent implementing post-Phase-1 runtime performance work.

**Read first:**

- [terraform-canvas-runtime-performance.md](./terraform-canvas-runtime-performance.md)
- [excalidraw-canvas-architecture.md](./excalidraw-canvas-architecture.md)
- [terraform-pipeline-import-agent-guide.md](./terraform-pipeline-import-agent-guide.md)

This document is an implementation handoff for deeper architectural changes. It is intentionally separate from the import/layout performance log.

## Current status

Phase 1 added dev-only, default-off experiments for low-zoom icon filtering, hover suppression/debounce, focus-only binding-repair skipping, and Terraform-only frame-clipping suppression.

Five-run benchmark:

| Profile                      | Combined p95 | Change vs baseline |
| ---------------------------- | -----------: | -----------------: |
| baseline                     |    `49.98ms` |                  — |
| icons                        |    `50.00ms` |            `-0.0%` |
| hover suppression + debounce |    `36.72ms` |            `26.5%` |
| clipping                     |    `49.96ms` |             `0.0%` |
| skip repair                  |    `56.70ms` |           `-13.4%` |
| all                          |    `36.72ms` |            `26.5%` |

The 50% target was not met. The strongest evidence is:

1. Preventing hover focus churn reduced combined `replaceAllElements` calls from `4` to `1` in every measured run.
2. Icon filtering and clipping did not materially improve p95 at the measured viewport.
3. Skipping binding repair alone regressed the measured workload.

Therefore, the recommended next change is **render-time relationship focus backed by indexed runtime data**, not broader renderer changes.

## Working-tree warning

Phase 1 may still be uncommitted when this handoff is picked up. Preserve existing changes and inspect:

```bash
git status --short
git diff --stat
```

Do not revert the current runtime experiment modules or the user's existing documentation changes.

## Reference workload

Use the same workload until a new benchmark is explicitly approved:

```text
/demo?preset=staging-extended-localstack-v2&view=pipeline&pipelineVariant=compound&packedPullLeft=1&ancillary=1
```

Required state:

- Pipeline view
- Full
- Compound
- Packed
- Pull-left
- Ancillary/all resources
- Normal Zoom LOD disabled
- Zoom approximately `0.10`
- Viewport centered over scene content

Measured scene composition:

| Kind                                    |   Count |
| --------------------------------------- | ------: |
| Total elements                          | `8,160` |
| Frames                                  |   `577` |
| Resource rectangles                     |   `932` |
| Arrows                                  |   `166` |
| AWS icon primitives                     | `5,553` |
| Text                                    |   `932` |
| Visible at benchmark reference viewport |   `113` |

Run:

```bash
yarn benchmark:terraform-canvas --url http://localhost:3000 --runs 5
```

Raw output defaults to `/tmp/terraform-canvas-runtime-results.json`.

## Hard constraints

Preserve these throughout deeper work:

1. Do not add fork-specific fields to generic `AppState`, persisted scene data, collaboration payloads, history, or the public root API.
2. Keep Terraform runtime state in Terraform-owned modules.
3. All new behavior remains dev-only and default-off until benchmark and correctness review.
4. Generic non-Terraform scenes must remain unchanged.
5. Image and SVG exports must use canonical complete scene data and remain unchanged.
6. Geometry-changing paths must retain correct arrow endpoints and bindings.
7. Keep upstream-sensitive edits narrow and guarded.
8. Stop after each architectural phase for benchmark review. Do not stack several deep changes before measuring.

## Architecture diagnosis

### Focus currently mutates canonical scene elements

`useTerraformRelationshipFocusEffect.ts` currently:

1. Resolves hover/selection graph address.
2. Walks the complete element array in `applyTerraformRelationshipFocus`.
3. Optionally repairs bindings.
4. Reconciles visibility.
5. Calls `scene.replaceAllElements`.

`Scene.replaceAllElements` then:

- Converts/replaces the full element array.
- Clears and rebuilds scene maps.
- Recomputes non-deleted arrays/maps and frame arrays.
- Changes `sceneNonce`.
- Triggers React and canvas rendering.

This is disproportionate for transient hover state.

### Hit testing scans the complete non-deleted scene

`App.getElementsAtPosition()` filters `scene.getNonDeletedElements()` and runs exact hit testing for each candidate on a hot pointer path. Large Terraform scenes therefore pay an O(scene-elements) candidate scan before exact tests.

### Rendering is viewport-culled, but scene invalidation is broad

The benchmark viewport had only `113` visible elements. This explains why hiding thousands of offscreen icon primitives did not materially change p95. The expensive part is not necessarily drawing all `8,160` elements; it is repeated runtime work and invalidation caused by focus transitions.

### Expand-all repeats expensive finalize work

`TerraformScenePanel.handleExpandAll()` calls `expandPipelineCluster()` sequentially. Each expansion currently performs visibility reconciliation and binding repair before the final single `replaceAllElements`.

## Recommended program

Implement and benchmark the phases in this order.

## Phase A: Improve instrumentation before changing architecture

Do this first. The current benchmark proves relative behavior but does not attribute time to specific runtime stages.

### Add counters and timings

Add dev-only instrumentation around:

- Hover graph-key resolution
- Focus projection/focus apply
- `repairTerraformEdgeBindings`
- `reconcileTerraformVisibility`
- `Scene.replaceAllElements`
- `Renderer.getRenderableElements`
- Viewport culling
- Static render
- Interactive render
- Hit-test candidate count and exact hit-test count

Record count, total duration, p95 duration, and worst duration per workload/profile.

### Benchmark corrections and extensions

- Keep the viewport centered over content.
- Record visible element count before every workload, not only once.
- Record hover graph-key transitions separately from primitive hover transitions.
- Record scene nonce changes.
- Record renderer cache hits/misses.
- Add a hover-only profile that sweeps repeatedly across primitives belonging to one graph address.
- Add a hover-only profile that switches between different graph addresses.
- Add an expand-one and expand-all workload outside the combined acceptance workload.

### Gate

Do not start Phase B until the benchmark can identify where the remaining combined p95 time is spent.

## Phase B: Render-time Terraform relationship focus

**Recommended first architecture change.**

Goal: Hover and selection focus transitions must not mutate canonical scene elements or call `replaceAllElements`.

### Proposed ownership

Add Terraform-owned modules:

```text
packages/excalidraw/components/terraformRuntimeSceneIndex.ts
packages/excalidraw/components/terraformRuntimeFocusStore.ts
packages/excalidraw/components/terraformRuntimeFocusProjection.ts
```

Suggested responsibilities:

```ts
type TerraformRuntimeSceneIndex = {
  sceneNonce: number | undefined;
  elementById: ReadonlyMap<string, ExcalidrawElement>;
  graphAddressByElementId: ReadonlyMap<string, string>;
  resourceElementIdsByAddress: ReadonlyMap<string, readonly string[]>;
  incidentEdgeIdsByAddress: ReadonlyMap<string, readonly string[]>;
  relatedAddressesByAddress: ReadonlyMap<string, ReadonlySet<string>>;
  parentGroupIdsByAddress: ReadonlyMap<string, readonly string[]>;
};

type TerraformRuntimeFocusState = {
  revision: number;
  hoveredGraphAddress: string | null;
  selectedGraphAddress: string | null;
  effectiveGraphAddress: string | null;
};

type TerraformRuntimeFocusProjection = {
  revision: number;
  revealedElementIds: ReadonlySet<string>;
  focusedElementIds: ReadonlySet<string>;
  relatedElementIds: ReadonlySet<string>;
  parentGroupIds: ReadonlySet<string>;
};
```

Exact types may differ, but keep the index and transient state separate from canonical elements.

### Index lifecycle

Build/rebuild the index when canonical Terraform scene topology or geometry changes:

- Import/apply
- Persistence restore
- Layout refresh
- Expand/collapse
- Edge-layer pin changes if index contents depend on them
- Any geometry-changing edit that changes graph bindings

Do not rebuild it on pointer movement or transient focus changes.

### Focus transition behavior

Refactor `useTerraformRelationshipFocusEffect` so hover/selection transitions only:

1. Resolve effective graph address.
2. Update `terraformRuntimeFocusStore`.
3. Increment a runtime focus revision.
4. Refresh the renderer without mutating scene elements.

The graph-address equality check must remain. Pointer movement across card/icon/label primitives with one address must be a no-op.

### Renderer projection

The renderer needs a Terraform-only runtime projection after viewport culling:

1. Start from canonical elements.
2. Include canonically soft-deleted elements that the focus projection reveals.
3. Apply focus visual overrides only to visible/revealed Terraform elements.
4. Leave canonical element objects and persisted fields unchanged.

Important implementation issue: `ShapeCache` and `elementWithCanvasCache` use element object identity. Creating fresh projected objects every render will destroy cache effectiveness.

Use a projection cache keyed by:

```text
canonical element identity + focus projection class + background/theme inputs
```

Reuse derived render elements while those inputs remain stable. Do not bump canonical element versions.

### Visual parity challenge

Current focus behavior washes/dims most Terraform-managed elements and can reveal soft-deleted related nodes/edges. A render-time implementation must preserve:

- Focused/related/container dim levels
- Bound label readability
- Preview reveal/hide behavior
- Edge-layer pins
- Selection precedence
- Duplicate resource highlighting
- Clearing focus back to ambient styling

Do not simplify visual semantics merely to make the optimization easier.

### Renderable maps challenge

Revealed elements may not exist in `scene.getNonDeletedElementsMap()`. Rendering, frame lookup, bound text lookup, and arrows may require a runtime renderable map containing projected/revealed elements.

Keep this map runtime-only. Do not change canonical deletion state.

### Hit testing challenge

Decide explicitly whether transiently revealed focus-preview elements are hit-testable:

- If current behavior allows interaction, runtime hit testing must include them.
- If they are intentionally visual-only, document and test that behavior.

### Phase B acceptance

- Hover transitions perform zero `replaceAllElements` calls.
- Hover transitions perform zero binding repairs.
- Same-address primitive movement performs zero focus projection recomputations.
- Selection focus remains immediate.
- Existing focus visuals and revealed edge/card bindings remain correct.
- Combined p95 improves at least 50% versus the default-off baseline, or profiling clearly identifies the next dominant bottleneck.
- Generic scenes and exports remain byte/structure-equivalent where currently tested.

## Phase C: Terraform runtime spatial hit-test index

Only start this after Phase B and new profiling show hit testing is material.

### Current issue

`App.getElementsAtPosition()` scans the complete non-deleted scene and then runs exact hit tests. Pointer movement therefore considers thousands of elements even when only a small viewport region matters.

### Recommended design

Create a Terraform-owned spatial candidate index, preferably a simple uniform grid before introducing an external R-tree dependency.

The index stores element bounding boxes and z-order position. Query returns candidates near a scene point; existing exact hit-test logic remains authoritative.

Required categories:

- Normal Terraform elements
- Large frames spanning many cells
- Iframe-like elements
- Bound text/container relationships
- Runtime-revealed focus-preview elements if hit-testable
- Generic non-Terraform elements in mixed scenes

### Integration strategy

Keep the upstream-sensitive App change narrow:

```text
if Terraform runtime spatial index is enabled and valid:
  get ordered candidates from index
  run existing exact hit/filter logic on candidates
else:
  run existing full-scene path
```

Preserve z-order, selected-element preference, locked-element filtering, frame clipping rules, bound text behavior, and iframe ordering.

### Correctness testing

Build parity tests that compare indexed and full-scan results:

- Random points across representative scenes
- Overlapping elements
- Nested frames
- Rotated elements
- Thin arrows/lines
- Bound text
- Locked elements
- Selected elements
- Mixed Terraform/generic scenes
- Low and high zoom thresholds

### Phase C acceptance

- Indexed hit-test results equal full-scan results.
- Pointer workloads show materially fewer exact hit tests.
- Hover/pan p95 improves measurably beyond Phase B.
- Index rebuild cost is measured and does not regress geometry-changing operations.

## Phase D: Batch geometry-changing Terraform operations

This phase targets expand/collapse, layer changes, and other geometry/visibility operations, not transient hover.

### Expand-all first

Refactor expansion into:

1. A raw cluster expansion that returns element additions/patches without final global repair/reconcile.
2. A batch coordinator that expands all requested clusters.
3. One final visibility reconciliation.
4. One final binding repair.
5. One scene commit.

Current `expandPipelineCluster()` and `collapsePipelineCluster()` should preserve their existing external behavior. Add internal raw helpers rather than duplicating logic.

### Incremental scene commit

After batching is proven, evaluate a narrow generic `Scene` patch API.

Potential API:

```ts
scene.applyElementPatches({
  updated: readonly ExcalidrawElement[],
  added: readonly ExcalidrawElement[],
  removedIds: ReadonlySet<string>,
});
```

This is upstream-sensitive and must be justified by profiling. It must correctly maintain:

- Ordered element array
- `elementsMap`
- Non-deleted array/map
- Frames and non-deleted frames
- Selection caches
- Fractional indices
- Scene callbacks and nonce behavior

Do not expose it through the public root API unless separately approved.

### Phase D acceptance

- Expand-all performs one final repair/reconcile pair.
- Expand/collapse correctness tests preserve frame sizes, satellites, edge endpoints, and bindings.
- Expansion wall-clock and long tasks improve materially.
- No regression to history, collaboration, persistence, or generic editing.

## Phase E: Render representation and layer separation

Only pursue after Phase B-D profiling.

### AWS icon representation

The scene contains `5,553` AWS icon primitives. Low-zoom filtering did not improve the measured p95 because most were offscreen, but they still affect memory, indexing, serialization, and broad-view rendering.

Possible experiment:

- Replace each multi-primitive AWS icon group with a single cached image/SVG-backed Excalidraw element.
- Preserve canonical resource card and graph address metadata.
- Ensure image and SVG exports remain correct.
- Measure import size, scene size, memory, zoom performance, and export cost.

This changes persisted scene representation and should remain a separate reviewed experiment.

### Runtime overlay/layer separation

If focus visuals still force expensive static redraws, evaluate a dedicated Terraform focus canvas layer:

- Canonical static canvas remains unchanged during hover.
- Focus layer draws dim overlay plus focused/related elements.
- Clear/redraw only the focus layer on focus transitions.

This can outperform projected static rendering but has substantial visual-parity and ordering complexity. Treat it as higher risk than Phase B projection.

### Dirty-region rendering

Do not begin with generalized dirty-region rendering. It has a large upstream conflict surface and complex correctness interactions with frames, clipping, arrows, bound text, and caches.

## Phase F: Worker/off-main-thread experiments

Only offload work that profiling proves remains CPU-heavy after avoiding unnecessary work.

Candidates:

- Building Terraform relationship/spatial indexes after geometry changes
- Batch expansion preparation
- Expensive graph-address relationship projection preparation

Do not move rendering or canonical Scene mutation off-thread without a separate design review.

## Recommended first implementation slice

The next agent should implement only this slice before asking for review:

1. Add Phase A instrumentation.
2. Build `terraformRuntimeSceneIndex` for relationship focus.
3. Move hover/selection focus state into a runtime store.
4. Implement render-time focus projection with canonical scene untouched.
5. Remove `replaceAllElements` from transient focus transitions.
6. Run focused correctness tests and the five-run benchmark.
7. Update [terraform-canvas-runtime-performance.md](./terraform-canvas-runtime-performance.md) with results.
8. Stop for review.

Do not combine spatial indexing, incremental Scene mutation, icon replacement, or dirty-region rendering into the first slice.

## Key source files

| Concern | File |
| --- | --- |
| Runtime experiments/store | `packages/excalidraw/components/terraformRuntimePerformance.ts` |
| Current focus hook and pure decision helper | `packages/excalidraw/components/useTerraformRelationshipFocusEffect.ts` |
| Focus visual semantics | `packages/excalidraw/components/terraformRelationshipFocus.ts` |
| Visibility/binding repair | `packages/excalidraw/components/terraformVisibility.ts` |
| Terraform metadata/address helpers | `packages/excalidraw/components/terraformElementMetadata.ts` |
| Renderer viewport culling/runtime filtering | `packages/excalidraw/scene/Renderer.ts` |
| Static rendering | `packages/excalidraw/renderer/staticScene.ts` |
| Interactive rendering | `packages/excalidraw/renderer/interactiveScene.ts` |
| Canvas wrappers/memoization | `packages/excalidraw/components/canvases/StaticCanvas.tsx`, `InteractiveCanvas.tsx` |
| Generic scene replacement/invalidation | `packages/element/src/Scene.ts` |
| Generic pointer hit testing | `packages/excalidraw/components/App.tsx` |
| Per-element canvas/shape caches | `packages/element/src/renderElement.ts`, `packages/element/src/shape.ts` |
| Pipeline expansion | `packages/excalidraw/components/terraformPipelineLayoutExpand.ts` |
| Expand-all coordinator | `packages/excalidraw/components/TerraformScenePanel.tsx` |
| Benchmark | `scripts/terraform/benchmark-canvas-runtime.mjs` |

## Required tests

At minimum, keep these green:

```bash
yarn vitest run packages/excalidraw/components/terraformRuntimePerformance.test.ts
yarn vitest run packages/excalidraw/components/terraformRelationshipFocus.test.ts
yarn vitest run packages/excalidraw/components/terraformFocusHoverLoop.test.ts
yarn vitest run packages/excalidraw/components/terraformLod.test.ts
yarn vitest run packages/excalidraw/components/main-menu/DefaultItems.TerraformZoomLod.test.tsx
yarn vitest run packages/excalidraw/tests/export.test.tsx
yarn test:typecheck
yarn lint:arch
yarn test:code
```

Add focused tests for:

- Runtime index build/rebuild and stale-index fallback
- Projection parity with current focus output
- Zero canonical element mutation on hover
- Zero scene nonce changes on hover
- Zero `replaceAllElements` calls on hover
- Projection cache identity stability
- Revealed edge/card/frame/bound-text rendering
- Selection and hover precedence
- Edge-layer pins
- Clearing focus
- Generic scene and export invariance
- Indexed/full-scan hit-test parity if Phase C begins

## Review gate

After the first deeper architecture slice, report:

1. Before/after five-run benchmark table.
2. Stage timings and counts from Phase A instrumentation.
3. `replaceAllElements`, scene nonce, and binding-repair counts per workload.
4. Correctness test results.
5. Any visual or interaction differences.
6. Recommended next phase based on evidence.

Stop for user review before continuing to spatial indexing, incremental generic Scene mutation, icon representation changes, dedicated render layers, or dirty-region rendering.
