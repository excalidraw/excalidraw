# RCLL pipeline — code map

Direct code links for the **Recursive Compound Layered Layout (RCLL)** pipeline. Normative spec: [`docs/pipeline-rcll-layout-design.md`](pipeline-rcll-layout-design.md). Appendix B in that RFC is stale; this doc reflects the as-built code.

---

## Entry & routing

| What | Where |
| --- | --- |
| **Select RCLL builder** | `packages/excalidraw/components/terraformLayoutCore.ts` — `pipelineLayoutVariant === "rcll"` → `buildTerraformPipelineRcllExcalidrawScene` |
| **Main builder** | `packages/excalidraw/components/terraformPipelineLayoutRcll.ts` |
| **Headless proof API** | `excalidraw-app/dev/terraformImportPresetDevPlugin.mjs` — `GET /api/terraform-layout?layoutMode=rcll&…` |
| **Canonical fixture** | preset `staging-extended-localstack-v2` (used in `terraformPipelineRcll.test.ts`) |

### Call graph

```
layoutTerraformFromSources (terraformLayoutCore.ts)
  → applyRcllToggleGuards (terraformPipelineToggleGuards.ts)
  → resolveRcllLayoutProfile (terraformPipelineLayoutProfiles.ts)  // optional profile bundle
  → buildTerraformPipelineRcllExcalidrawScene (terraformPipelineLayoutRcll.ts)
       → preparePipelineLayout (terraformPipelineLayoutShared.ts)
       → buildRcllModel (terraformPipelineRcllModel.ts)           // M1
       → runRcllPipeline (terraformPipelineLayoutRcll.ts)         // M2 + M3
            → layeringStage (terraformPipelineRcllLayering.ts)
            → placementStage (terraformPipelineRcllPlacement.ts)
       → buildSceneFromBoxedTree OR compound fallback (§27)
```

---

## Core types & stage registry

**Stage registry** (`terraformPipelineLayoutRcll.ts`):

```typescript
const RCLL_STAGES: readonly RcllPipelineStage[] = [
  { name: "layering", stage: layeringStage },
  { name: "placement", stage: placementStage },
];
```

| Symbol | File | Notes |
| --- | --- | --- |
| `CompoundNode`, `Lattice`, `RcllOptions`, `Stage` | `terraformPipelineRcllTypes.ts` | §28 module-contract types |
| `runRcllPipeline` | `terraformPipelineLayoutRcll.ts:161` | Stage runner + §27 guard |
| `buildTerraformPipelineRcllExcalidrawScene` | `terraformPipelineLayoutRcll.ts:382` | Main scene builder |

---

## M1 — Model (tree + lattice)

**File:** `packages/excalidraw/components/terraformPipelineRcllModel.ts`

| Function | Role |
| --- | --- |
| `buildRcllModel` | Entry: prep → `{ tree, lattice }` |
| `buildCompoundTree` | Topology tree `root → provider → … → primaryCluster` |
| `computeUpperBounds` | `UB` / slack |
| `buildFanSets` | fan-out / fan-in sets |
| `buildHullEdges` | per-container `D_H` hull-edge DAG |
| `detectContainerCycles` | flags `lattice.cyclicContainers` (v2 has 6) |
| `summarizeRcllModel` | meta scalars for diagnostics |

---

## M2 — Layering (columns, no pixels yet)

**File:** `packages/excalidraw/components/terraformPipelineRcllLayering.ts`

| Function | Role |
| --- | --- |
| `layeringStage` | Stage entry |
| `layerTree` | Walk tree, write `localColumn` |
| `columnsForContainer` | Longest-path floors + fan-out pinning + cyclic fallback |
| `layeringMeta` | Gate metrics → `rcllStageMeta.layering` |

Shared longest-path kernel: `longestPath` in `terraformPipelineLayoutShared.ts`.

---

## M3 — Placement (first real geometry)

**File:** `packages/excalidraw/components/terraformPipelineRcllPlacement.ts` (~1500 lines)

| Function | ~Line | Role |
| --- | --- | --- |
| `placementStage` | 1496 | Stage entry |
| `layoutPlacement` | 1251 | Clone tree, de-band pre-pass, size+arrange |
| `sizeAndArrange` | 1153 | Recursive placement dispatcher |
| `arrangeByHullMatrix` | — | Cyclic path: 2-way SCC → swimlane, 1-way → staircase |
| `arrangeSwimlaneGroup` | 879 | Shared-axis swimlane interior |
| `layoutLanesOnAxis` | 752 | Y-stacking / lane-rise inside swimlanes |
| `buildLaneContext` | 563 | Column floor → `colByCluster`, optional passes |
| `placePackedColumns` | 415 | Acyclic forced/packed/mixed policies |
| `collapseTreeForDeBand` | 344 | De-band hierarchy collapse |
| `policyForContainer` | 275 | `passthrough` / `forced` / `packed` / `mixed` |
| `backwardEdgeGate` | 1433 | **CON-12** iron rule gate |
| `placementMeta` | 1338 | Gate metrics → `rcllStageMeta.placement` |

**Placement policy by role** (`policyForContainer`): root passthrough, provider+account forced bands, region+subnetZone packed, vpc mixed.

---

## Optional passes (wired inside placement, not separate stages)

| Milestone | File | Key export | Trigger flag |
| --- | --- | --- | --- |
| **M4** swimlane lane-rise | `terraformPipelineRcllPlacement.ts` | `swimlaneLaneRise` in `PlaceCtx` | `swimlaneLaneRise` |
| **M6** leaf reorder | `terraformPipelineOrdering.ts` | `barycenterReorder` | `reorder` |
| **M6c** cross-container crossing-min | `terraformPipelineRcllCrossingMin.ts` | `minimizeCrossings`, `countPlacedCrossings` | `crossingMin` |
| **M5** straighten | `terraformPipelineStraighten.ts` | `straightenColumns` | `straighten` |
| **M5b** de-densify | `terraformPipelineDeDensify.ts` | `deDensifyColumns` | `deDensify` / profile `columnPacking:"spread"` |
| **M5c** column compact | `terraformPipelineColumnCompact.ts` | `compactColumns` | `columnCompact` / profile `columnPacking:"compact"` |
| **M8r** rank separate | `terraformPipelineRcllRankSeparate.ts` | `computeGlobalSeparatedFloor` | `rankSeparate` (needs M4) |
| **M7s** de-band | `terraformPipelineRcllPlacement.ts` + `terraformPipelineSubnetAnnotation.ts` | `collapseTreeForDeBand`, `appendSubnetMembershipAnnotations` | `deBandLevel` |
| **M5 gate-fix** hub metrics | `terraformPipelineCoordinateAssignment.ts` | `hubCenteringOverBoxes`, `median` | metrics only |

**Toggle coupling (single source of truth):** `terraformPipelineToggleGuards.ts` — `applyRcllToggleGuards`, suppressions like `rankSeparate-needs-rise`, `ordering-conflict-crossing-min-wins`.

**Profile bundles:** `terraformPipelineLayoutProfiles.ts` — `resolveRcllLayoutProfile("readable" | "balanced" | "compact")` expands to the flag set.

---

## Export (boxes → Excalidraw scene)

After placement runs, `buildSceneFromBoxedTree` in `terraformPipelineLayoutRcll.ts`:

```
leaf boxes
  → buildCompoundFramesFromLayoutBoxes (terraformPipelineTopologyFrames.ts)
  → applyCompoundHierarchicalLayout (terraformPipelineLayoutCompoundHierarchy.ts)
  → appendPipelineEdgeSkeletons (terraformPipelineLayoutFinalize.ts)
  → appendCompoundTopologyFrameEdgeSkeletons (terraformPipelineLayoutCompoundSiblingEdges.ts)
  → assignCompoundEdgeFrameParents
  → convertPipelineSkeletonToElements
  → appendSubnetMembershipAnnotations (if de-banded)
  → styleBackEdges (EXT-12 dashed back-edges in cyclic SCCs)
```

If placement degrades (§27), falls back to `buildTerraformCompoundPipelineExcalidrawScene`.

---

## Diagnostics & acceptance gates

**File:** `packages/excalidraw/components/terraformPipelineCollisionDiagnostics.ts`

- `diagnosePipelineScene` — final-scene collision, crossings, readability metrics
- `segmentsCross` — shared crossing kernel (M6c uses the same basis)

**Meta stamped on scene:** `rcllMilestone`, `rcllStageMeta.layering`, `rcllStageMeta.placement`, `rcllModules.stages`, `rcllDegraded`.

---

## UI / URL / session threading

| Layer | File |
| --- | --- |
| Dialog controls | `packages/excalidraw/components/TerraformImportPipelineSettings.tsx` |
| State + profile fan-out | `packages/excalidraw/components/useTerraformImportDialog.ts` |
| URL params | `packages/excalidraw/components/terraformDemoUrlParams.ts` (also `profile=`, `deBandLevel=`, aliases) |
| Session round-trip | `terraformImportSession.ts`, `terraformSceneApply.ts`, `terraformPresetImport.ts` |
| Option types | `terraformPlanParsing.tsx` |

---

## Tests (by concern)

| Test file | Covers |
| --- | --- |
| `terraformPipelineRcll.test.ts` | **Integration** — full v2 seam, M2+M3 gates, §27 fallback, determinism |
| `terraformPipelineRcllModel.test.ts` | M1 model |
| `terraformPipelineRcllLayering.test.ts` | M2 layering |
| `terraformPipelineRcllPlacement.test.ts` | M3/M4 placement + iron rule |
| `terraformPipelineRcllRankSeparate.test.ts` | M8r rank separate |
| `terraformPipelineRcllCrossingMin.test.ts` | M6c engine units |
| `terraformPipelineCrossingMin.test.ts` | M6c v2 integration |
| `terraformPipelineRcllDeBand.test.ts` | De-band per level |
| `terraformPipelineSubnetDeBand.test.ts` | Subnet de-band alias |
| `terraformPipelineLayoutProfiles.test.ts` | Profile bundles |
| `terraformLayoutCoreRcllThreading.test.ts` | **Real import path** flag forwarding |
| `terraformPipelineToggleGuards.test.ts` | Footgun guards |
| `TerraformImportDialog.test.tsx` | UI toggle wiring |

Run the main gate:

```bash
yarn vitest run packages/excalidraw/components/terraformPipelineRcll.test.ts
```

Headless layout probe:

```bash
curl 'http://localhost:5173/api/terraform-layout?preset=staging-extended-localstack-v2&profile=compact&crossingMin=1'
```

---

## Agent cheat sheet — “where do I edit X?”

| Task | Start here |
| --- | --- |
| Change column assignment | `terraformPipelineRcllLayering.ts` → `columnsForContainer` |
| Change box placement / swimlanes | `terraformPipelineRcllPlacement.ts` → `sizeAndArrange` / `arrangeSwimlaneGroup` |
| Change fan-out column pinning | `terraformPipelineRcllLayering.ts` (T4) |
| Change crossing order | `terraformPipelineRcllCrossingMin.ts` or `terraformPipelineOrdering.ts` |
| Change height/width trade (lane split) | `terraformPipelineRcllRankSeparate.ts` + M4 in placement |
| Change hull frame emission | `terraformPipelineTopologyFrames.ts` |
| Change iron-rule gate | `backwardEdgeGate` in placement + `diagnosePipelineScene` |
| Add a new toggle | `RcllOptions` → `terraformLayoutCore` sceneContext → guards → profiles → UI → dev API |
| Register a new pipeline stage | Add to `RCLL_STAGES` + implement `Stage` in a new module |

---

## Doc ↔ code mapping

| RFC section | Code |
| --- | --- |
| §6 data model | `terraformPipelineRcllTypes.ts`, `terraformPipelineRcllModel.ts` |
| §7.2a layering | `terraformPipelineRcllLayering.ts` |
| §7.2 placement | `terraformPipelineRcllPlacement.ts` |
| §7.2c ordering | `terraformPipelineOrdering.ts`, `terraformPipelineRcllCrossingMin.ts` |
| §8 per-level policy | `policyForContainer`, de-band in placement + `terraformPipelineSubnetAnnotation.ts`; ancillary reserved bands in `terraformPipelineLayoutRcll.ts` + `terraformPipelineRcllPlacement.ts` |
| §9 straightening | `terraformPipelineStraighten.ts` |
| §12 routing/parenting | `terraformPipelineLayoutFinalize.ts`, `terraformPipelineLayoutCompoundHierarchy.ts` |
| §13 gates | `backwardEdgeGate`, `diagnosePipelineScene` |
| §22 stage registry | `RCLL_STAGES`, `runRcllPipeline` |
| §28 options API | `RcllOptions`, `terraformLayoutCore.ts` sceneContext |
| §34 decisions | change-log in `docs/pipeline-rcll-layout-design.md` (decision IDs like DI-M6-_, DI-DEB-_) |

---

## Ancillary Bands

RCLL **All Resources** support is implemented as post-placement reserved bands with a recursive slack allocator:

- `terraformPipelineLayoutAncillary.ts` selects VPC/region/account/provider scopes.
- `terraformPipelineLayoutRcll.ts` runs Dataflow-only placement, calls the allocator/inserter, renders strips, and stamps ancillary/allocator meta.
- `terraformPipelineRcllAncillaryAllocator.ts` computes per-strip rightward slack ceilings through the host/ancestor chain, accepts measured row-saving wrap-width breakpoints, rebuilds/gates the final ancillary tree, inserts measured `ancillaryBand` leaves into a clone of the placed tree, expands host hulls, and pushes only lower overlapping siblings downward. `diagnoseRcllAncillaryBands` (DI-ANC-6) is a read-only dry-run that materializes each breakpoint as a candidate FINAL rectangle and reuses the gate to emit a per-scope `bandBlockStatus` into `rcllAncillaryAllocator.diagnostics` — it does NOT influence allocation (the dev probe surfaces it under `ancillaryAllocator`; on v2 the target VPC reports `shared-slack-consumed`).
- `terraformPipelineRcllPlacement.ts` excludes `ancillaryBand` from normal dataflow child placement and places bands below normal content.
- `terraformPipelineTopologyFrames.ts` uses `ancillaryScopeRole` so account/provider strips parent to the intended hull rather than synthetic descendants.
