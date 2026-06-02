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

**Top profiler span after optimizations:** `layout.topology.skeleton` (not `.collect` or `.materialize`). With the 2026-06-02 sub-spans, the **leaf** breakdown of the current ~34s semantic run (self ms) is: `skeleton.vpcSizing` **~7.7s** (biggest leaf; 3 passes/VPC — target of idea 1.4), `skeleton.resourceRects` **~6.6s** + `skeleton.satelliteBundles` **~3.3s** (the shared per-resource core), `layout.semantic` self **~8.5s** (topology extraction + `enrichAndReconcile`, which `prep.cache`'s ~4.9s partly recomputes — idea 1.3), `materialize` ~0.1s.

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

The artifact now captures **per-view** spans (`spansByView`) with `primaryView: "semantic"`, ranked by inclusive `ms` (`topSpans`). Before 2026-06-02 it silently serialized the _module_ test's totals (the writer test inherited the previous test's profiler state), so older artifacts/ranker output were for the wrong view.

**Profiler spans** (hierarchical). `selfMs` is now correct (fixed 2026-06-02) — a span's `selfMs` = its `ms` minus its children. Rank leaves by `selfMs`, but read the tree (`spansByView` in the artifact, or the `[terraform:profile]` console summary) to understand where a parent's inclusive time goes.

| Span | Meaning |
| --- | --- |
| `prep.cache` | Build import prep cache |
| `merge.plans` | Multi-stack plan merge |
| `parse.nodes` | `buildTerraformLocalImportNodesMap` |
| `parse.tfd` | TFD overlay |
| `layout.semantic` | Full semantic layout (self = extraction + enrich, outside topology) |
| `layout.pipeline` | Pipeline layout |
| `layout.elk` | Module ELK layout |
| `layout.topology.collect` | Count metrics |
| `layout.topology.skeleton` | Nested build loop (self = loop scaffold + edge builders) |
| `skeleton.vpcSizing` | `vpcFrameDimensionsForZones` (3×/VPC — see idea 1.4) |
| `skeleton.resourceRects` | `appendTopologyResourceRectangles` (per-zone primary+satellite placement) |
| `skeleton.satelliteBundles` | `buildTopologyPrimarySatelliteBundles` (per-primary, memoized) |
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
| Semantic | ~34,000 (±2s noise) | 9,160 | Idea #3 + zone-sizing memo + prep trim (`prep.cache` 4.9s→1.3s) |
| Pipeline | ~16,000–20,000 | 1,121 | Prep cache; standalone cost now builds its own enriched placements |
| Module | sequential merged plan | per golden snap | Multi-stack parallel ELK removed |

**CI baseline JSON** (`terraform-import-perf-baseline.json`): semantic wall **65,000 ms** (conservative); `spans` **empty** until filled from CI. Local ~34s semantic has not bumped the JSON (<10% rule vs the 65s budget; wall gains so far are within machine noise even though `prep.cache` dropped clearly).

**Measurement harness** (no import-time behavior change unless profiling enabled; `selfMs` + artifact fixed 2026-06-02): `terraformImportProfiler.ts`, `terraformImportPerf.views.test.ts`, `perf-hotspot-ranker.mjs`. Spans: `prep.cache`, `merge.plans`, `parse.nodes`, `layout.{semantic,pipeline,elk}`, `layout.topology.{collect,skeleton,materialize}`, and skeleton leaves `skeleton.{vpcSizing,resourceRects,satelliteBundles}`.

---

## Agent handoff — next steps

**Read first:** the [Change log](#change-log) (newest rows are the 2026-06-02 tooling + prep-trim work) and the verified leaf breakdown under [Why import is slow](#why-import-is-slow-semantic-view). The profiler `selfMs` and the perf artifact are now **fixed and trustworthy** — rank leaves by `selfMs`, read `spansByView`/`topSpans` in the artifact (or the `[terraform:profile]` console summary).

### Ground rules (do not skip)

1. **Snapshot contract is law.** `terraformLayoutSnapshot.test.ts` (+ `terraformLayoutWorkerParity.test.ts`, `terraformImportPrepCache.test.ts`) must stay green with **no `.snap` diff** unless the change is an intentional layout change. 9,160 / 1,121 element outputs are byte-pinned.
2. **Layout-changing optimizations ship behind an import toggle, default off.** Add an experimental flag on `TerraformPlanParsingOptions` (`terraformPlanParsing.tsx`, next to `deferDecorations`) → thread through `layoutTerraformFromSources` → checkbox in `TerraformImportDialog.tsx`; add a separate toggle-on golden. Never change the default diagram.
3. **The machine is noisy (~±2s / ~6% on a 34s wall).** Average ≥3 runs and **trust span attribution over single-run wall**. Only bump `terraform-import-perf-baseline.json` after a **>10%** wall improvement across 3 runs.
4. **Keep this log current** — append a Change log row (view, before/after, top span, snapshot status) after every measured change.

### Verified leaf cost (semantic ~34s, self ms; 2026-06-02)

| Leaf | self ms | Nature |
| --- | --- | --- |
| `skeleton.vpcSizing` | ~7.5s | Genuine **cold** per-VPC zone sizing. 3×/VPC redundancy already absorbed by `zoneOuterWidthByKey`. |
| `skeleton.resourceRects` | ~6.5s | Per-zone primary+satellite rectangle placement (shared by both views). |
| `layout.semantic` (self) | ~8s | Topology extraction + `enrichAndReconcileTopologyPlacements`. |
| `skeleton.satelliteBundles` | ~3.3s | `buildTopologyPrimarySatelliteBundles` — ~17 graph-walking `build*Cluster`/primary. |
| `prep.cache` | ~1.3s | Already trimmed (was 4.9s). |
| `materialize` / `collect` | ~0.1s | Negligible. |

### Proven NOT worth retrying on this fixture (evidence in Change log)

- **Collapsing `vpcFrameDimensionsForZones` 3→1** — saved ~270ms (noise); `zoneOuterWidthByKey` already de-duped it. The 7.5s is real cold sizing.
- **Memoizing `buildArnIndexForTopology`** across pipeline's 70× rebuilds — ~220ms (scan is cheap). Kept, but don't expect more.
- **Within-build per-address bundle memo as a cross-build cache** — each pipeline cluster is a distinct address (no within-build repeats), so it only helps view-switches, not the cold path.
- General lesson: **micro-redundancies here are cheap. The cost is genuine element/zone construction.** Don't chase de-duplication; reduce or parallelize the real work.

### Recommended levers, in priority order

1. **Account-level worker parallelism (highest ceiling).** The 25 stacks map to independent accounts laid out in isolation then offset (`accountCursorX` advance in the skeleton loop). Build each account's skeleton in a worker (`runJobOnMainThread` fallback + `terraformLayoutWorkerClient.ts` exist) and concatenate with deterministic X offsets. This is the structural fix for the genuine per-resource cost — workers "don't help" today only because the whole skeleton is one synchronous main-thread call. Keep it layout-neutral (deterministic merge) so goldens hold; otherwise gate behind the toggle. _Note: the doc previously removed a "semantic sharding" attempt — that was finer-grained / shared-state; account grain is the embarrassingly-parallel boundary._
2. **Toggle-gated reduction of the per-resource builders** (`appendTopologyResourceRectangles` / `buildTopologyPrimarySatelliteBundles`). These produce ~31 elements/primary. Any change that reduces element count or simplifies geometry will move the wall but **will** change the diagram → must be opt-in (rule 2) with its own golden.
3. **`skeleton.vpcSizing` cold cost** — profile _inside_ `outerWidthForPlacementZone` first (add a temporary sub-span). If the VPCE/NAT/RT zone-sizing sub-calls dominate (footprint/margins are already memo-shared with `resourceRects`), there may be a snapshot-safe memo there; if it's the genuine geometry, it needs the toggle.
4. **Materialize / workers for materialize** — only ~0.1s; ignore unless it grows.

**Semantic is the priority** (34s, the felt cost). Pipeline (~16–20s) is a separate, smaller code path — note its test number now reflects honest standalone cost (it builds its own enriched placements; see the prep-trim Change log row).

### How to measure

```bash
VITEST_TERRAFORM_PROFILE=1 VITEST_TERRAFORM_PROFILE_OUT=/tmp/tf.json \
  yarn vitest run packages/excalidraw/components/terraformImportPerf.views.test.ts
node scripts/terraform/perf-hotspot-ranker.mjs /tmp/tf.json   # reads topSpans (inclusive ms), primaryView: semantic
```

Then the snapshot + worker-parity + prep-cache tests before any PR (Ground rule 1).

---

## Change log

Newest first.

| Date | Change | View | Before (ms) | After (ms) | Δ% | Layout snap OK? | Top span | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-02 | **Prep trim:** delete dead `buildAwsLayoutContext`/`awsContext` (built every prep, read nowhere) and make `enrichedPlacements` lazy — semantic never builds it (runs its own `enrichAndReconcile`), pipeline builds once on demand and memoizes back to the session cache for semantic→pipeline switches. Deleted orphaned `terraformAwsLayoutContext.ts`. | semantic | `prep.cache` 4881 | `prep.cache` **1353** | −3.5s prep (−72% of the span); wall noisy (~34s±2s) | yes | layout.topology.skeleton | **Kept.** Golden snapshots + worker parity (sem+pipe, workers on/off) + prep-cache tests green. Pipeline _test_ rises ~16→~20s but that is honest cost: it previously free-rode on semantic's eager enriched build in the shared-cache test order; standalone pipeline total work is unchanged. |
| 2026-06-02 | **arnIndex memo:** `buildArnIndexForTopology` memoized by `nodes` ref (`WeakMap`). Pipeline sets `activeTopologyMemoCtx = null` and rebuilds the index per cluster (~70×); index is a pure, read-only function of `nodes`. | pipeline | — | — | ~neutral on fixture (scan ~3ms; ~220ms total) | yes | layout.pipeline | **Kept** as redundancy removal; too small to show on this fixture but O(clusters) scans eliminated. |
| 2026-06-02 | **Investigated + reverted — vpcSizing 3×/VPC collapse.** `callCount` counts memo hits; the prior `zoneOuterWidthByKey` memo already absorbed the redundancy, so collapsing the 3 calls saved only ~270ms (noise). `skeleton.vpcSizing` (~7.5s) is genuine cold per-VPC zone sizing, not redundant re-calls. Reverted to keep the tree lean. | semantic | — | — | ~0 | yes | skeleton.vpcSizing | **Reverted.** Finding: micro-redundancies here are cheap; cost is real per-resource/zone building. |
| 2026-06-02 | **Tooling (Tier 0):** fix profiler `selfMs` (parent entry now pre-created at push, so child decrement applies); fix perf artifact to capture per-view spans (`spansByView`, `primaryView: semantic`, ranked by inclusive `ms`) instead of inheriting the module test's totals; add skeleton sub-spans `skeleton.vpcSizing` / `.resourceRects` / `.satelliteBundles`. | all (instrumentation) | — | — | 0% (no behavior change) | yes | n/a | **Kept.** Snapshot + perf tests green; no layout change. Verified semantic breakdown (self ms): `skeleton.vpcSizing` 7,739 (12 calls = 4 VPC × 3 passes) · `skeleton.resourceRects` 6,610 · `prep.cache` 4,881 · `skeleton.satelliteBundles` 3,341 · `layout.semantic` self 8,525 (extraction+enrich) · `materialize` 96. Wall semantic ~34s, pipeline ~15.5s. |
| 2026-06-02 | **Zone-sizing memo:** memoize `outerWidthForPlacementZone` by zone map key in `activeTopologyMemoCtx` (`zoneOuterWidthByKey`). Per-zone result depends only on zone + per-build-stable maps; `vpcFrameDimensionsForZones` runs 3×/VPC (sizing `vdWidth` + `vdHeight` + placement), re-deriving every zone each time. | semantic | 39,427 | ~35,977 (3-run avg: 35955/36121/35856) | −8.8% wall / −13.7% top span | yes | layout.topology.skeleton | **Kept.** `layout.topology.skeleton` 26,203→~22,608 ms; `zoneFrameSizeForTopologyAddresses` calls 68→36, `outerWidthForPlacementZone` 11,730→~7,710 ms. Wall gain <10% vs pre-zone baseline → baseline JSON unchanged. Snapshots + worker parity + prep-cache parity green. |
| 2026-06-02 | **Cleanup:** remove unproven runtime paths (semantic sharding, staging fast path, mode-switch snapshot cache, progressive-decoration import flag, **broad** vpc sizing memo, parallel-regions scaffold, normalized networking edge pass, subnet→RT reverse index, multi-stack module parallel); delete `terraformImportFastPath` / `terraformLayoutModuleParallel` | semantic | 42,773 | ~40,700 (expected) | ~-5% | yes | layout.topology.skeleton | Surface area reduced; narrow zone outer-width memo added next row |
| 2026-06-02 | Pass 3 idea #3: memoize topology footprint/margins/satellite bundles/layout config per address/resource type | semantic | 64,081 | 40,716 | -36% | yes | layout.topology.skeleton | **Kept** |
| 2026-06-02 | Prep cache + pipeline reuse of enriched placements | pipeline | 21,000 | 15,927 | -24% | yes | prep.cache | **Kept** |
| 2026-06-02 | _baseline_ | all | — | 61846 / 20960 / 1258 | — | yes | — | Pre-optimization profiling |
