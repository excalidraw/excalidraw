# Terraform import performance log

**Agent handoff:** This file is the single source of truth for Terraform import performance work on preset `staging-multi-state-expanded`. Read this entire doc before optimizing. Workflow details also appear in [`docs/code-quality.md`](code-quality.md) § Terraform import performance.

**Goal:** Speed up **client-side** Terraform import (plan JSON + graph DOT → Excalidraw elements) without changing layout unless intentional. Parsing, DB load, and workers are **not** the bottleneck for semantic view.

**Related files:**

| Purpose | Path |
| --- | --- |
| CI wall-clock budgets | [`packages/excalidraw/test-fixtures/terraform-import-perf-baseline.json`](../packages/excalidraw/test-fixtures/terraform-import-perf-baseline.json) |
| Layout golden contract | [`packages/excalidraw/components/terraformLayoutSnapshot.test.ts`](../packages/excalidraw/components/terraformLayoutSnapshot.test.ts) |
| Preset fixture DB | [`packages/excalidraw/test-fixtures/terraform-import-presets.db`](../packages/excalidraw/test-fixtures/terraform-import-presets.db) |
| Profiler | [`packages/excalidraw/components/terraformImportProfiler.ts`](../packages/excalidraw/components/terraformImportProfiler.ts) |
| Perf tests (all views) | [`packages/excalidraw/components/terraformImportPerf.views.test.ts`](../packages/excalidraw/components/terraformImportPerf.views.test.ts) |
| Hotspot ranker | [`scripts/terraform/perf-hotspot-ranker.mjs`](../scripts/terraform/perf-hotspot-ranker.mjs) |

---

## Fixture

| Field | Value |
| --- | --- |
| Preset id | `staging-multi-state-expanded` |
| Stacks | 25 independent Terraform roots (staging multi-state) |
| Merged `resource_changes` | ~792 |
| DB / preset load | ~100 ms (not worth optimizing first) |
| Semantic elements | **9,160** (must stay unless layout change is intentional) |
| Pipeline elements | **1,121** |
| Module view | Often **0** elements — ELK skipped (`vertex_count_exceeds_600`) |

Hydrate preset locally: `yarn hydrate:terraform-preset staging-multi-state-expanded` (or `yarn seed:terraform-presets`).

---

## Why import is slow (semantic view)

Import runs entirely in the browser. For semantic view, ~**90%+** of wall time is building a large nested AWS topology diagram (account → region → VPC → subnet zones → primary resources + satellites + edges), not merging plans or loading SQLite.

| Phase | Approx. share (pre-opt baseline) | Notes |
| --- | --- | --- |
| `buildTerraformTopologyExcalidrawScene` | ~57s of ~62s | Dominates semantic |
| Placement prep (`enrichAndReconcileTopologyPlacements`, etc.) | ~3.5s | Partially cached when switching views |
| `buildTerraformLocalImportNodesMap` | ~0.8s | Graph + plan → dependency nodes |
| Workers on/off | ~same | Skeleton work stays on main thread |

**Top profiler span after optimizations:** `layout.topology.skeleton` (not `.collect` or `.materialize`).

---

## Call graph (where to edit)

```
layoutTerraformFromSources          terraformLayoutCore.ts
  prep.cache                        terraformImportPrepCache.ts (merge + nodes + enriched placements)
  merge.plans
  parse.nodes                       buildTerraformLocalImportNodesMap — terraformPlanParsing.tsx
  parse.tfd
  layout.semantic                   buildSemanticLayoutSceneBody
    extractTerraformTopologyFromPlan, buildMergedTopologyZones, …
    enrichAndReconcileTopologyPlacements   terraformTopologyPlacementBuild.ts
    buildTerraformTopologyExcalidrawScene  terraformTopologyLayout.ts  ← BOTTLENECK
      layout.topology.collect
      layout.topology.skeleton     nested loops; hot inner calls below
      layout.topology.materialize    materializeTopologyScene
  layout.pipeline                   buildTerraformPipelineExcalidrawScene (smaller graph)
  layout.elk                        module view (often skipped on this fixture)
```

**Hot functions inside `layout.topology.skeleton`:**

| Function | Role |
| --- | --- |
| `vpcFrameDimensionsForZones` | Per-VPC grid sizing; calls `outerWidthForPlacementZone` for every zone |
| `outerWidthForPlacementZone` | Zone outer width / body height / route inset (was called ~11k×; now memoized per zone key) |
| `zoneFrameSizeForTopologyAddresses` | Sizes zone from sorted addresses |
| `appendTopologyResourceRectangles` | Primary + satellite placement per resource |
| `buildTopologyPrimarySatelliteBundles` | IAM, SG, KMS, ECS, ALB, API Gateway, etc. |
| Edge builders at end of skeleton | `buildTopologySatelliteLineSkeletons`, dataflow / declared dataflow lines |

**Parallel import path:** `layoutSemanticViewParallel` in `terraformLayoutSemanticParallel.ts` (`prep.semantic`, `layout.semantic.workers`) — workers do not materially speed semantic skeleton; do not assume workerization fixes semantic wall time.

**Session memo scope:** `activeTopologyMemoCtx` in `terraformTopologyLayout.ts` is set for the duration of one `buildTerraformTopologyExcalidrawScene` call only.

---

## Optimizations kept in tree

| Win | File | Mechanism |
| --- | --- | --- |
| **Idea #3** — per-address memo | `terraformTopologyLayout.ts` | `activeTopologyMemoCtx`: `primaryFootprintByAddr`, `primaryMarginsByAddr`, `satHeightCtxByAddr`, `satelliteBundlesByAddr`, `layoutConfigByResourceType` |
| **Zone-sizing memo** (2026-06-02) | `terraformTopologyLayout.ts` | `zoneOuterWidthByKey`: cache `outerWidthForPlacementZone` by `topologyZoneMapKey(account, region, vpc, subnetSignature)`. Safe because VPC-level args (`vpcStripVpceClusterBodyPadPx`, `sideGutterPx`) do not affect zone outer sizing; `vpcFrameDimensionsForZones` runs 3×/VPC with identical zone-level inputs. **Not** the broad “vpc sizing memo” removed in cleanup — this is a narrow, proven cache. |
| **Prep cache** | `terraformImportPrepCache.ts` | Fingerprinted session cache: merged plan, nodes, `buildEnrichedTopologyPlacements` — avoids duplicate prep when switching semantic ↔ pipeline |

---

## Do not re-try without new evidence

Removed 2026-06-02 cleanup (unproven or regressed); details in git history before that commit:

- Semantic sharding, staging fast path, mode-switch snapshot cache
- Progressive-decoration import flag
- Broad **vpc sizing memo** (distinct from 2026-06-02 **zone outer-width** memo above)
- Parallel-regions scaffold, normalized networking edge pass, subnet→RT reverse index
- Multi-stack module parallel ELK (`terraformLayoutModuleParallel`, `terraformImportFastPath` deleted)

Passes **1–14** and ideas **#1–#9** except **#3** were tried pre-cleanup; no index in-repo — use `git log` on `terraformTopologyLayout.ts` / `terraformLayoutCore.ts` if investigating past attempts.

---

## Measure and validate

### Required before any perf PR (layout contract)

```bash
yarn vitest run packages/excalidraw/components/terraformLayoutSnapshot.test.ts
yarn vitest run packages/excalidraw/components/terraformLayoutWorkerParity.test.ts
yarn vitest run packages/excalidraw/components/terraformImportPrepCache.test.ts
```

- Golden snapshots: `packages/excalidraw/components/__snapshots__/`
- **Do not** run `yarn test:update` to mask a perf regression.
- Snapshots must not change unless the PR **intentionally** changes layout.

### Wall-clock budgets (all views)

```bash
yarn vitest run packages/excalidraw/components/terraformImportPerf.views.test.ts
```

### Profiling (span self-times)

```bash
VITEST_TERRAFORM_PROFILE=1 yarn vitest run packages/excalidraw/components/terraformImportPerf.views.test.ts
```

Optional artifact + ranker:

```bash
VITEST_TERRAFORM_PROFILE=1 VITEST_TERRAFORM_PROFILE_OUT=/tmp/tf-profile.json \
  yarn vitest run packages/excalidraw/components/terraformImportPerf.views.test.ts
node scripts/terraform/perf-hotspot-ranker.mjs /tmp/tf-profile.json
```

**Profiler spans** (hierarchical; sort by `selfMs`):

| Span | Meaning |
| --- | --- |
| `prep.cache` | Build import prep cache |
| `merge.plans` | Multi-stack plan merge |
| `parse.nodes` | `buildTerraformLocalImportNodesMap` |
| `parse.tfd` | TFD overlay |
| `layout.semantic` | Full semantic layout |
| `layout.pipeline` | Pipeline layout |
| `layout.elk` | Module ELK layout |
| `layout.topology.collect` | Count metrics |
| `layout.topology.skeleton` | **Primary target** |
| `layout.topology.materialize` | Skeleton → elements |

Enable in browser: `localStorage.terraformImportProfile = "1"` or dev `VITE_TERRAFORM_IMPORT_PROFILE=1`.

### Iteration checklist

1. Layout + worker parity + prep-cache tests green (no `.snap` diff).
2. Profile semantic (and pipeline if prep touched); append a row to **Change log** below.
3. **One** focused optimization; re-run tests.
4. Update `terraform-import-perf-baseline.json` only after **>10%** wall-clock improvement over **3** local runs — prefer seeding `spans` from a **CI-representative** run, not a single laptop, to avoid hardware flakiness.

Slow suite before commit: `yarn test:slow` or `yarn test:update`.

---

## Baseline (frozen — pre-optimization)

Measured locally (25 stacks, 792 merged `resource_changes`, workers on/off ~same for semantic).

| Metric | Semantic | Pipeline | Module |
| --- | --- | --- | --- |
| Wall-clock total | ~62,000 ms | ~21,000 ms | ~1,300 ms (skipped layout) |
| DB load | ~100 ms | ~100 ms | ~100 ms |
| `buildTerraformLocalImportNodesMap` | ~800 ms | (in core) | N× stacks |
| Placement prep (`enrichAndReconcile…`) | ~3,500 ms | re-run in pipeline | — |
| `buildTerraformTopologyExcalidrawScene` | ~57,000 ms | — | — |
| Elements produced | 9,160 | 1,121 | 0 (`vertex_count_exceeds_600`) |

---

## Current best (runtime optimizations kept)

| View | Wall-clock (ms) | Elements | Notes |
| --- | --- | --- | --- |
| Semantic | ~35,977 | 9,160 | Idea #3 + zone-sizing memo (`zoneOuterWidthByKey`) |
| Pipeline | ~15,900 | 1,121 | Prep cache |
| Module | sequential merged plan | per golden snap | Multi-stack parallel ELK removed |

**CI baseline JSON** (`terraform-import-perf-baseline.json`): semantic wall **65,000 ms** (conservative); `spans` **empty** until filled from CI. Local ~36s semantic has not yet bumped JSON (<10% rule vs old 65s budget; latest local gain ~8.8% vs ~39.4s pre-zone-memo).

**Measurement harness** (no import-time behavior change unless profiling enabled): `terraformImportProfiler.ts`, `terraformImportPerf.views.test.ts`, `perf-hotspot-ranker.mjs`, topology spans `layout.topology.{collect,skeleton,materialize}`.

---

## Suggested next targets

Work in **`layout.topology.skeleton`** unless profiling shows a new top self-time span.

| Area | Hypothesis |
| --- | --- |
| `appendTopologyResourceRectangles` / `buildTopologyPrimarySatelliteBundles` | Still heavy per resource; extend memo keys carefully (address + stable inputs) |
| `zoneFrameSizeForTopologyAddresses` | Fewer calls or memo by sorted address list signature |
| Placement prep | Further reuse from `terraformImportPrepCache` on semantic path (pipeline already benefits) |
| `layout.topology.materialize` | Usually smaller than skeleton; profile before investing |
| Workers | Unlikely to help semantic until skeleton is chunked or moved off hot path |

**Pipeline view** is a separate, smaller code path (~16s, 1,121 elements) — optimize only if pipeline-specific regressions appear.

---

## Change log

Newest first.

| Date | Change | View | Before (ms) | After (ms) | Δ% | Layout snap OK? | Top span | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-02 | **Zone-sizing memo:** memoize `outerWidthForPlacementZone` by zone map key in `activeTopologyMemoCtx` (`zoneOuterWidthByKey`). Per-zone result depends only on zone + per-build-stable maps; `vpcFrameDimensionsForZones` runs 3×/VPC (sizing `vdWidth` + `vdHeight` + placement), re-deriving every zone each time. | semantic | 39,427 | ~35,977 (3-run avg: 35955/36121/35856) | −8.8% wall / −13.7% top span | yes | layout.topology.skeleton | **Kept.** `layout.topology.skeleton` 26,203→~22,608 ms; `zoneFrameSizeForTopologyAddresses` calls 68→36, `outerWidthForPlacementZone` 11,730→~7,710 ms. Wall gain <10% vs pre-zone baseline → baseline JSON unchanged. Snapshots + worker parity + prep-cache parity green. |
| 2026-06-02 | **Cleanup:** remove unproven runtime paths (semantic sharding, staging fast path, mode-switch snapshot cache, progressive-decoration import flag, **broad** vpc sizing memo, parallel-regions scaffold, normalized networking edge pass, subnet→RT reverse index, multi-stack module parallel); delete `terraformImportFastPath` / `terraformLayoutModuleParallel` | semantic | 42,773 | ~40,700 (expected) | ~-5% | yes | layout.topology.skeleton | Surface area reduced; narrow zone outer-width memo added next row |
| 2026-06-02 | Pass 3 idea #3: memoize topology footprint/margins/satellite bundles/layout config per address/resource type | semantic | 64,081 | 40,716 | -36% | yes | layout.topology.skeleton | **Kept** |
| 2026-06-02 | Prep cache + pipeline reuse of enriched placements | pipeline | 21,000 | 15,927 | -24% | yes | prep.cache | **Kept** |
| 2026-06-02 | _baseline_ | all | — | 61846 / 20960 / 1258 | — | yes | — | Pre-optimization profiling |
