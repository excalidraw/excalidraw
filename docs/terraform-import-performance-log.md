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
| Layout cache (KV) | [`functions/_terraformLayoutCache.ts`](../functions/_terraformLayoutCache.ts), [`terraformLayoutCacheClient.ts`](../packages/excalidraw/components/terraformLayoutCacheClient.ts) |

---

## Layout cache (Cloudflare KV)

Built-in **preset** imports can skip client-side layout when a precomputed scene exists in KV.

| Item | Detail |
| --- | --- |
| API | `GET /api/terraform-import-layout-cache?v={sha}&preset={id}&view={semantic\|pipeline\|module}&pack={default\|box\|rectpacking}` (pack only for module) |
| Key | `v{version}/{presetId}/{view}[/pack]` — `version` = first 12 chars of deploy git SHA (`VITE_TERRAFORM_LAYOUT_CACHE_VERSION`) |
| Populate | `yarn precompute:terraform-layout-cache` (CI on **master** deploy after purge) |
| Purge | `yarn purge:terraform-layout-cache` (production KV); runs automatically on master in [`pages-deploy.yml`](../.github/workflows/pages-deploy.yml) |
| Local dev | Version env empty → cache skipped; layout always runs |
| File uploads | Not cached server-side in v1 |

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

CI perf budgets in `terraformImportPerf.views.test.ts` use higher limits under `VITEST_COVERAGE=1` (prepush) than plain CI, matching the semantic tier pattern — pipeline standalone on GitHub runners is ~5× local wall time.

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

All line numbers below are in `terraformTopologyLayout.ts` unless stated; they drift, so grep the named symbol. The hot loop is `buildTerraformTopologyExcalidrawScene` (the `layout.topology.skeleton` `terraformImportProfilerMeasure` block, ~L3294+).

**2026-06-02 correction:** the current `staging-multi-state-expanded` golden has `accountCount: 1`, `regionCount: 4`, `vpcCount: 4`. Account-level sharding is therefore not a useful parallel boundary for this fixture; it would create one AWS topology job. Use region/VPC-level sharding for this fixture, with the same deterministic parallel-then-pack shape and the same global edge/dataflow pass after packing.

---

#### Lever 1 — Account-level parallelism (highest ceiling, the real structural fix)

**Why this and not "workers" generically:** the existing worker path (`layoutSemanticViewParallel` / `runSemanticAwsLayoutJob`) runs the **entire** AWS topology as **one** synchronous job, so a worker just moves the same 22s to another thread — no speedup. The 25 stacks, however, map to independent **accounts** that are laid out in isolation and then packed left-to-right. That's the embarrassingly-parallel boundary. (The previously-removed "semantic sharding" was finer-grained and shared mutable state — see Do-not-retry. Account grain is coarser and has exactly one shared- state problem, addressed below.)

**Current structure to refactor:**

- The account loop starts at `let accountCursorX = MARGIN` (~L3291) and iterates `collectTopologyAccountBuildUnits(model)`. Each account appends its region/VPC/zone skeletons into the single shared `skeleton[]`, tracks `maxRegionRight`, pushes an account `frame` at `x: accountCursorX` (~L4270), then advances `accountCursorX += accountWidth + ACCOUNT_GAP` (~L4287). So account _N_'s X is a **prefix sum** of accounts `0..N-1` widths — a pack step, not a per-account input.
- After the loop, a **global, inherently-sequential** pass runs once over the assembled boxes (~L4336–4410): `filteredSatelliteLineSpecs` → `buildTopologySatelliteLineSkeletons`, `collectDirectedEdges`, `partitionDirectedEdgesByNetworking`, `buildTerraformDeclaredDataFlowLineSkeletons`. These build cross-account edges/dataflow and **must stay on the main thread after** the parallel phase.

**Target shape (parallel-then-pack, same pattern `terraformPipelineLayout.ts` already uses via `translateSkeleton`):**

1. **Phase A (parallelizable):** build each account's skeleton at **local origin (x=0)**, returning `{ accountId, skeleton, width, height, satelliteLineSpecs, zoneRouteAnchorDebug, … }`. No `accountCursorX` inside; no shared `skeleton[]`.
2. **Phase B (sequential, cheap, main thread):** sort accounts deterministically (the current iteration order — keep `collectTopologyAccountBuildUnits`’s order), compute prefix-sum X offsets, `translateSkeleton(acc.skeleton, offsetX, 0)`, concat, push account frames, then run the **existing** global edge/dataflow pass unchanged over the assembled boxes.

**The one correctness blocker — global satellite dedup (`globalPlaced*` sets, declared ~L3278–3288, mutated inside `appendTopologyResourceRectangles`, ~L3516+):** these 11 `Set<string>` (IAM, KMS, SG, CloudWatch, S3, SQS, ALB, ECS, ApiGateway, TGW, LambdaPermission) dedup satellites **across the whole scene by mutation order** — the first primary to reach a shared satellite places it; later ones skip. Plus `vpceLayoutDuplicateRegistry` (~L3259) is a second cross-account registry. Parallel accounts would race these → non-deterministic → golden break.

**De-risk it in one cheap, sequential step before writing any worker code:** make these sets **per-account** (allocate fresh inside the account loop body instead of before it) and run the snapshot test. Two outcomes:

- **Snapshot stays green** → no satellite is shared across accounts on this fixture (very likely: addresses are stack/account-namespaced, e.g. `43-east-api-4::module.api…`, and IAM/KMS/SG are per-stack). Per-account sets are then equivalent → Phase A is genuinely independent and **layout-neutral**. Proceed to parallelize.
- **Snapshot changes** → real cross-account sharing exists. Add a deterministic pre-assignment pass (walk primaries in the current global order, assign each shared satellite to its first owner into a `Map<satelliteAddr, ownerPrimaryAddr>`), pass that map into each account build so accounts honor assignments without runtime coordination. Then per-account sets are safe.

**Worker/serialization notes:** start with **main-thread parallel-then-pack** (Phase A/B split, still synchronous) — that alone restructures the code and is independently testable. Only then move Phase A into workers via the existing `runJobWithFallback` machinery (`terraformLayoutWorkerClient.ts`). Each account job must receive serializable inputs; filter `nodes`/`plan`/zones to the account's namespaced addresses to shrink the structured-clone payload (the full `nodes` map + plan are large — don't clone them 25×). Keep `runJobOnMainThread` as the fallback (jsdom/tests have no `Worker`, so the parity test exercises the sequential Phase-A/B path — it must match the old golden).

**Payoff & gating:** if Phase A (`vpcSizing` + `resourceRects` + `satelliteBundles` ≈ 17s of the 22s skeleton) parallelizes across ~4 busy cores, semantic could approach ~12–15s wall. The main-thread parallel-then-pack restructure should be **layout-neutral** (deterministic pack) → no toggle needed. If you cannot make the pack/merge byte-identical, gate behind the import toggle (Ground rule 2) with a toggle-on golden.

**First commit suggestion:** the per-account-`globalPlaced` snapshot experiment above (no perf change, just proves independence). Record the result in the Change log — it unblocks everything else here.

---

#### Lever 2 — The per-resource builders (`resourceRects` ~6.5s + `satelliteBundles` ~3.3s)

This is the shared per-resource core (both views funnel through `appendTopologyResourceRectangles`, ~L2700). `buildTopologyPrimarySatelliteBundles` (`terraformTopologySatelliteRegistry.ts:171`) runs up to ~17 `build*Cluster` calls per primary, each a graph walk keyed off `arnIndex`. It already gates by `enabledKindsForPrimaryType`, so only relevant kinds run — the cost is the genuine walks for the kinds that ARE present, not wasted work.

**Snapshot-safe sub-targets (try first, no toggle):**

- **Profile inside the bundle build.** Add temporary sub-spans around the individual `build*Cluster` families (iam / sg / kms / ecs / alb / apiGateway) to find which 2–3 dominate the 3.3s, then optimize only those (e.g. a shared per-primary `SatelliteBuildContext` index instead of re-walking `arnIndex`/plan inside each family). `buildSatelliteContext` (`…SatelliteRegistry.ts:123`) is built once per primary already — check whether the individual builders re-derive things it could hold.
- **`resourceRects` self (6.5s)** is the placement/loop logic in `appendTopologyResourceRectangles` _minus_ the bundle build. Profile its own body (grid math, `pushResourceRectangleSkeleton`, `renderPrimarySatellitesFromConfig`). Watch for per-address recomputation that isn't in `activeTopologyMemoCtx` yet.

**Toggle-gated reductions (change the diagram → Ground rule 2 + own golden):** collapse satellites by default and expand on demand; coarser satellite geometry; cap satellites per primary. Note: element **count** is not the cost (`materialize` is ~0.1s) — the cost is the **building logic**, so "fewer elements" only helps if it also skips the build walks.

---

#### Lever 3 — `skeleton.vpcSizing` cold cost (~7.5s, genuine)

`vpcFrameDimensionsForZones` (~L820) → `outerWidthForPlacementZone` (~L664, result memoized by `zoneOuterWidthByKey`) → `zoneFrameSizeForTopologyAddresses` (~L590). The 3×/VPC redundancy is **already gone** (memo); the 7.5s is the **cold first compute per unique zone**. Per zone it runs: `partitionVpcEndpointsForClusterLayout`, `vpcEndpointClusterBodyPadPx` / `vpcEndpointClusterRowMinInnerWidth`, `natClustersForZone`

- NAT band sizing, route-table sizing, and `maxTopologyCellFootprintPx` + per-address margins (these last two **are** memo-shared with `resourceRects` via `primaryFootprintByAddr` / `primaryMarginsByAddr`).

**Most promising snapshot-safe angle:** the **VPCE/NAT/route-table** per-zone sub-computations are _also_ recomputed in the placement pass (the second loop, the `vd` call ~L3788 and the zone-placement body below it) — i.e. the sizing pass and the placement pass both derive the same per-zone cluster/NAT/RT data. Build a **per-zone derived context once** (keyed by `topologyZoneMapKey(account,region,vpc,subnetSignature)` in `activeTopologyMemoCtx`) holding `{ clusterAddrs, compactAddrs, natClusters, rtSizing, vpceBodyPad, … }` and consume it in **both** passes. This is the correctly-scoped version of the reverted Lever-1.4 attempt (that one memoized the final dims, which the existing memo already covered; this memoizes the _expensive intermediate per-zone data_ that is currently derived twice). Snapshot-safe if it's pure memoization. Add the temporary sub-spans inside `outerWidthForPlacementZone` first to confirm these sub-calls dominate before investing.

If profiling shows the cost is irreducible geometry (not duplicated derivation), it falls to Lever 1 (parallelize it) since `vpcSizing` runs inside the per-account work.

---

#### Lever 4 — Materialize / collect

`materialize` ~0.1s, `collect` ~0.0001s. **Ignore** unless a future change makes them grow.

---

**Priority recap:** Lever 1 (parallelism) has by far the highest ceiling and, done as deterministic parallel-then-pack, can be layout-neutral. Levers 2–3 are incremental and partly snapshot-safe. **Semantic is the priority** (34s, the felt cost). Pipeline (~16–20s) is a separate, smaller path — its test number now reflects honest standalone cost (it builds its own enriched placements; see the prep-trim Change log row).

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
| 2026-06-23 | **nodesByType pre-index for `prep.satelliteBundles` — TODO-3 complete (T-1 consolidation + T0 infra + T1 IAM/ECS + T2 ALB/SG/S3/SQS + T3 EKS/APIGW/TGW/CloudWatch/Route).** Built a `nodesByType: Map<type, address[]>` index once per build (O(N)) in `buildAllSatellitePrimaryMappings` (`terraformTopologySatelliteRegistry.ts`) and threaded it as an optional trailing positional param through 10 satellite plugin link files (~15 call levels deep). Each plugin's internal `Object.keys(nodes)` scan (O(N) per primary×kind call) became a type-bucket lookup (O(N_type)), reducing the aggregate O(P×K×N) cost to O(N + P×K×N_type). Introduced `terraformSatelliteFallbackCounter.ts` (standalone zero-dependency module) to avoid circular imports between the engine and link files; verified zero fallback scans after a full build via a new assertion in `terraformSatelliteOwnerMapBatchEquivalence.test.ts`. T-1 consolidation commit also deleted 3 byte-identical duplicate `getResourceTypeFromPath` private copies (Iam/Sg/CloudWatch) and added `terraformResourceTypeConsolidationRegression.test.ts`. Profiler checkpoints (all-resources fixture, 3-run median): T1 IAM+ECS ~594ms; T2 +ALB/SG/S3/SQS ~380ms; T3 +EKS/APIGW/TGW/CloudWatch **~174ms** (final). `prep.resourceRects` unchanged (~17ms). | pipeline | `prep.satelliteBundles` **~1,364** (after T1/T2 batch-resolver pass, 2026-06-23 baseline, commit `140f85aac`) | **~174** (median of 3 runs: 174/182/174) | **−87%** | yes | `pipeline.rcll.stage.placement` (~312ms, now the dominant span; satelliteBundles no longer the bottleneck) | **Kept.** Typecheck clean; `yarn lint:arch` clean (0 violations, 911 modules, 3472 deps). Full required gating suite (11 files / 59 tests) green, zero `.snap` diffs, verified at every checkpoint (T0/T1/T2/T3). Commits: T-1 (consolidation) `c7f3c4da7`, T0 (infra) `c301cc8f5`, T1 (IAM/ECS) `a89ad68b8`, T2 (ALB/SG/S3/SQS) `a30013f0f`, T3 (EKS/APIGW/TGW/CloudWatch) `70ebb3cc9`. Out of scope/untouched: `terraformTopologyDatastoreLinks.ts` (module-scope filter, not type-indexable), `terraformTopologyKmsLinks.ts` (companions mode — TODO-4), `terraformTopologyLambdaPermissionLinks.ts` (reverseRef mode), `terraformTopologyRouteLinks.ts` (plan-changes-based, no nodes scans). |
| 2026-06-23 | **Eliminate the duplicate satellite scan in placement enrichment (T3); batch satellite→primary resolver factored out (T1/T2).** `buildSatelliteOwnerMap` (`terraformPipelineLayoutShared.ts`) and `enrichTopologyPlacementsWithManagedResources` (`terraformTopologyPlacementEnrich.ts:385`) independently derived the same satellite→primary set via `collectTopologySatelliteAddressesFromRegistry`/`collectTopologySatelliteAddressesForPrimaries` — two near-identical O(P×K×N) scans per build. Added `buildAllSatellitePrimaryMappings` (`terraformTopologySatelliteRegistry.ts`) as the single source of truth for the satellite→primary map (first-claim-wins by sorted primary address, matching prior semantics exactly), then threaded its result (`new Set(satelliteOwners.keys())`) through `buildPlacementMap` → `buildEnrichedTopologyPlacements` → `enrichAndReconcileTopologyPlacements` → `EnrichTopologyPlacementsOptions.precomputedSatelliteAddresses` to let the enrichment scan short-circuit instead of re-deriving the same set. New equivalence test (`terraformSatelliteOwnerMapBatchEquivalence.test.ts`) cross-checks the batch resolver against an independently-written reference (collects all claimants per satellite, then explicitly picks the lexicographically-first one — different control flow than the production "iterate sorted, first writer wins" trick) on `staging-extended-localstack-v2`; also asserts the fixture has real contested satellites (not vacuous) and that all are resolved identically. **Scope note:** this pass only removes the *second* scan; `buildAllSatellitePrimaryMappings` itself is still O(P×K×N) — 16 of 18 satellite kinds are `plugin`-mode (IAM, ECS, ALB, S3, etc.) with their own internal per-primary `Object.keys(nodes)` scans, so a true O(K×N) batch (one scan per kind across all primaries) would require touching ~15 plugin files, not just the registry. That's out of scope here; tracked as a new TODO. | pipeline | `prep.satelliteBundles` ~1,418 + `prep.resourceRects` ~1,402 = **~2,820** (2026-06-23 baseline, commit 140f85aac) | `prep.satelliteBundles` ~1,364 (median of 3 runs: 1363.52/1364.11/1412.19) + `prep.resourceRects` ~10.4 (median of 3 runs: 10.41/10.61/10.24) = **~1,375** | **−51%** | yes | `pipeline.prep.satelliteBundles` (now ~99% of remaining prep cost) | **Kept.** Typecheck clean; full required gating suite (7 files / 50 tests) + all 15 other dependent test files (169 tests) green, zero `.snap` diffs; new equivalence test green (2/2), confirms ≥1 contested satellite in the fixture. `prep.resourceRects` dropped ~99% (1,402ms → ~10ms) — the second scan was effectively its entire cost; the projected residual zone-resolution O(N×Z) tail (TODO-2 in `TODOS.md`) turned out negligible, so that TODO is now resolved/moot. `prep.satelliteBundles` is unchanged (still O(P×K×N)) since T1/T2 only refactored the existing per-primary loop into a named function — no plugin-level batching was attempted. Follow-up not bundled: add a `nodesByType` pre-index (built once, O(N)) to `SatelliteBuildContext` and thread it through the ~15 plugin helpers in `terraformTopology{Iam,Ecs,Alb,S3,Sqs,...}Links.ts` so each currently does O(N_type) instead of O(N) per primary — projected ~10-40x further reduction on `satelliteBundles` depending on per-type cardinality; tracked as TODO-3. |
| 2026-06-23 | **Scoped node-key index — fixes the O(N²) named by the 2026-06-22 RCA row below.** `resolveTerraformPlanNodeKey` (`terraformPlanParsing.tsx`) did up to 5 full `Object.keys(nodes)`+regex scans per call, ~12,000 calls/build over N≈3,886 resources. Added `buildTerraformPlanNodeKeyIndex`/`withTerraformPlanNodeKeyIndex`: a one-time-per-call-scope index (`byBareKey`, `byGraphId`, `knownStackIds`), explicitly activated/restored (set/try/finally, mirroring `activeTopologyMemoCtx`) around `preparePipelineLayout`'s `buildPlacementMap`/`buildSatelliteOwnerMap` calls — not a `WeakMap`-by-`nodes`-ref cache (rejected: `sanitizeTerraformPlanNodes`'s in-place delete + `attachModuleTree`'s in-place add on the same `nodes` ref can mask staleness behind an unchanged `Object.keys().length`). `resolveTerraformPlanNodeKey` uses the index when active and ref-matched, else falls back to the original unmodified 5-scan body (so the ~38 other call sites and all construction-time call sites are byte-identical, zero risk). New equivalence test (`terraformPlanNodeKeyIndexEquivalence.test.ts`) dual-runs the indexed path against an independent naive reference resolver over a harvested real-call-site corpus (tens of thousands of (nodes, address) pairs) — zero discrepancies. | pipeline | `prep.satelliteBundles`+`prep.resourceRects` ~7,900 (combined, staging-extended-localstack-v2 RCLL/compact/all-resources/no-debanding/all-stages) | `prep.satelliteBundles` ~1,418 + `prep.resourceRects` ~1,402 = **~2,820** | **−64%** | yes | `pipeline.prep.satelliteBundles` / `.resourceRects` | **Kept.** Typecheck clean; 147/147 tests green across the full required gating list + new equivalence test, zero `.snap` diffs. Remaining ~2.8s is per-resource/satellite work in `buildArnIndexForTopology`/`buildSatelliteOwnerMap`/`buildPlacementMap` itself — outside this fix's scope (only `resolveTerraformPlanNodeKey`'s O(N²) scans were targeted); the resolver's call-count cost is now collapsed to O(N). Follow-ups not bundled: consolidate `stripTerraformAddressIndexes`/`stripInstanceIndexes` (byte-identical duplicate regex), speed up the other ~38 call sites if they ever show up in a profile. |
| 2026-06-22 | **RCA tooling (instrumentation only): RCLL all-resources slowness.** Added Tier A/B/C profiler spans (`pipeline.prep`, `.prep.resourceRects`, `.prep.satelliteBundles`, `.prep.materialize`, `.rcll.model`, `.rcll.ancillaryStrips`, `.rcll.run`, `.rcll.stage.<name>`, `.rcll.ancillaryInsert(.greedy/.stripReduction/.inject/.validate)`, `.rcll.crossingMin.count`, `.rcll.scene`) + gated `[terraform:rcll-instr]` iteration counters; no behavior change. Full RCA: [`docs/terraform-pipeline-rcll-v2-allresources-rca.md`](terraform-pipeline-rcll-v2-allresources-rca.md). | pipeline | — | — | 0% (instrumentation only) | yes | `pipeline.prep.resourceRects` / `.satelliteBundles` | **Kept.** staging-extended-localstack-v2, RCLL/compact/all-resources/no-debanding/all-stages: isolated build ~8.2s, of which `prep.resourceRects` (`buildPlacementMap`) + `prep.satelliteBundles` (`buildSatelliteOwnerMap`) are ~7.9s (>97%), both configs (ancillary on/off identical). RCLL stages + ancillary allocator together <400ms. Node CPU flame graph traced the cost to `resolveTerraformPlanNodeKey`/`collectKnownStackIdsFromNodes` doing a full linear `Object.keys(nodes)`+regex scan per address lookup (O(N²) over N resources) instead of a one-time index — same root-cause class as this doc's Lever 2. Browser trace reproduced 57-60s wall-clock (matches reported 30-60s range); Node/browser gap (~49s) not yet attributed — outside `preparePipelineLayout`'s boundary (parse/merge upstream, DOM/canvas apply downstream). Optimization (indexed lookup, expected snapshot-safe) deferred to a follow-up pass. |
| 2026-06-12 | **Pull-left guard made hierarchical (bug fix):** the root-only never-regress guard let local regressions hide inside band slack — on v2, acct-02's non-us-east-1 regions (us-west-1/2, us-east-2) sat in vertical slack under the dominant us-east-1 band, so pull-left dragged db/receiver lanes back over their sibling app lanes' spans and stacked them (region heights 713→1694 etc.) while global bounds were unmoved. `measurePackedSceneForDepths` now returns per-pack-node heights and `fitsWithinBaseline` rejects any candidate that grows **any** node's height (plus the global width check). | pipeline | — | — | packed+pull-left only; flag-off untouched | yes (flag off) | layout.pipeline | **Kept.** v2: db-lane pulls rejected (region frames byte-match plain packed); pulls 39→41 and `aws_sns_topic.ops` improves 13,712→6,666 px (rejecting bad stacks early preserves side-by-side structure, opening better slots). New per-frame height regression assertions in `terraformPipelineLayoutPacked.test.ts`. |
| 2026-06-12 | **Packed pull-left compaction (feature, opt-in, default off):** new `pipelinePackedPullLeft` flag (Height → "Packed + pull-left"; demo URL `packedPullLeft=1`, implies packed). After the group-uniform packed shifts, `computePackedPullLeftShifts` greedily pulls each slack cluster toward its TFD lower bound (`max(pred)+1`), accepting a candidate column only if a skeleton-free re-measure of the pack tree (`measurePackedSceneForDepths`) does not grow scene height or width. Bounds computed at visit time so pulls cascade through chains in one sweep; eval budget scales with clusterCount×columnCount (`pipelinePackedPullLeftCapped` in meta if hit). | pipeline | — | — | layout-neutral when off; adds measure evals inside packed only | yes (flag off) | layout.pipeline | **Kept.** staging-extended-localstack-v2 (compound+packed): 39 pulls, height/width unchanged; `aws_sns_topic.ops` x 13,712→11,002 px, `lake_replica_west["raw"]` 8,834→8,292. Group-shift pass untouched; pull-left scenes skip the KV layout cache like packed. |
| 2026-06-11 | **Packed pipeline layout (feature, opt-in, default off):** `pipelinePacked` now does real work — group-uniform rightward depth shifts for sink-only units (ALAP bounded by outgoing TFD edges) + hierarchical skyline Y re-packing in `terraformPipelineLayoutPacked.ts`. Flag-off path untouched. | pipeline | — | — | layout-neutral when off; packed adds two small passes on top of the classic grid | yes (flag off) | layout.pipeline | **Kept.** staging-extended-localstack-v2 height 18,522→7,748 px (−58%), width 8,038→15,718 (+96%); receiver regions/accounts share Y bands beside their sources. Bottom-up shift order + zero-slack closures + depth compaction + packed column gap. Packed scenes skip the KV preset layout cache (flag is not in the cache key yet). |
| 2026-06-02 | **Correction + region-independence proof:** verified golden metadata is `accountCount: 1`, so account sharding is not useful for this fixture. Moved satellite dedup to region scope and collected VPCE duplicate registries per region with deterministic merge. | semantic | — | — | 0% expected | yes | layout.topology.skeleton | **Kept.** Snapshot, worker parity, prep-cache, and perf tests green. This proves region-local satellite dedup is layout-neutral on the current fixture and unblocks a future region/VPC parallel-then-pack refactor. |
| 2026-06-02 | **Zone-derived context memo:** cache per-zone filtered primary addresses, frame sizing, NAT, route-table sizing, and zone VPCE partition data for reuse between VPC sizing and placement. | semantic | 31,452 local research run | 31,728 local run | noise / ~neutral | yes | layout.topology.skeleton | **Kept for now as pure memoization, but not a baseline bump.** Single-run spans stayed within machine noise (`layout.topology.skeleton` ~21.7s, `vpcSizing` ~7.8s, `resourceRects` ~10.2s inclusive). Do not claim a wall-clock win without 3-run evidence. |
| 2026-06-02 | **Prep trim:** delete dead `buildAwsLayoutContext`/`awsContext` (built every prep, read nowhere) and make `enrichedPlacements` lazy — semantic never builds it (runs its own `enrichAndReconcile`), pipeline builds once on demand and memoizes back to the session cache for semantic→pipeline switches. Deleted orphaned `terraformAwsLayoutContext.ts`. | semantic | `prep.cache` 4881 | `prep.cache` **1353** | −3.5s prep (−72% of the span); wall noisy (~34s±2s) | yes | layout.topology.skeleton | **Kept.** Golden snapshots + worker parity (sem+pipe, workers on/off) + prep-cache tests green. Pipeline _test_ rises ~16→~20s but that is honest cost: it previously free-rode on semantic's eager enriched build in the shared-cache test order; standalone pipeline total work is unchanged. |
| 2026-06-02 | **arnIndex memo:** `buildArnIndexForTopology` memoized by `nodes` ref (`WeakMap`). Pipeline sets `activeTopologyMemoCtx = null` and rebuilds the index per cluster (~70×); index is a pure, read-only function of `nodes`. | pipeline | — | — | ~neutral on fixture (scan ~3ms; ~220ms total) | yes | layout.pipeline | **Kept** as redundancy removal; too small to show on this fixture but O(clusters) scans eliminated. |
| 2026-06-02 | **Investigated + reverted — vpcSizing 3×/VPC collapse.** `callCount` counts memo hits; the prior `zoneOuterWidthByKey` memo already absorbed the redundancy, so collapsing the 3 calls saved only ~270ms (noise). `skeleton.vpcSizing` (~7.5s) is genuine cold per-VPC zone sizing, not redundant re-calls. Reverted to keep the tree lean. | semantic | — | — | ~0 | yes | skeleton.vpcSizing | **Reverted.** Finding: micro-redundancies here are cheap; cost is real per-resource/zone building. |
| 2026-06-02 | **Tooling (Tier 0):** fix profiler `selfMs` (parent entry now pre-created at push, so child decrement applies); fix perf artifact to capture per-view spans (`spansByView`, `primaryView: semantic`, ranked by inclusive `ms`) instead of inheriting the module test's totals; add skeleton sub-spans `skeleton.vpcSizing` / `.resourceRects` / `.satelliteBundles`. | all (instrumentation) | — | — | 0% (no behavior change) | yes | n/a | **Kept.** Snapshot + perf tests green; no layout change. Verified semantic breakdown (self ms): `skeleton.vpcSizing` 7,739 (12 calls = 4 VPC × 3 passes) · `skeleton.resourceRects` 6,610 · `prep.cache` 4,881 · `skeleton.satelliteBundles` 3,341 · `layout.semantic` self 8,525 (extraction+enrich) · `materialize` 96. Wall semantic ~34s, pipeline ~15.5s. |
| 2026-06-02 | **Zone-sizing memo:** memoize `outerWidthForPlacementZone` by zone map key in `activeTopologyMemoCtx` (`zoneOuterWidthByKey`). Per-zone result depends only on zone + per-build-stable maps; `vpcFrameDimensionsForZones` runs 3×/VPC (sizing `vdWidth` + `vdHeight` + placement), re-deriving every zone each time. | semantic | 39,427 | ~35,977 (3-run avg: 35955/36121/35856) | −8.8% wall / −13.7% top span | yes | layout.topology.skeleton | **Kept.** `layout.topology.skeleton` 26,203→~22,608 ms; `zoneFrameSizeForTopologyAddresses` calls 68→36, `outerWidthForPlacementZone` 11,730→~7,710 ms. Wall gain <10% vs pre-zone baseline → baseline JSON unchanged. Snapshots + worker parity + prep-cache parity green. |
| 2026-06-02 | **Cleanup:** remove unproven runtime paths (semantic sharding, staging fast path, mode-switch snapshot cache, progressive-decoration import flag, **broad** vpc sizing memo, parallel-regions scaffold, normalized networking edge pass, subnet→RT reverse index, multi-stack module parallel); delete `terraformImportFastPath` / `terraformLayoutModuleParallel` | semantic | 42,773 | ~40,700 (expected) | ~-5% | yes | layout.topology.skeleton | Surface area reduced; narrow zone outer-width memo added next row |
| 2026-06-02 | Pass 3 idea #3: memoize topology footprint/margins/satellite bundles/layout config per address/resource type | semantic | 64,081 | 40,716 | -36% | yes | layout.topology.skeleton | **Kept** |
| 2026-06-02 | Prep cache + pipeline reuse of enriched placements | pipeline | 21,000 | 15,927 | -24% | yes | prep.cache | **Kept** |
| 2026-06-02 | _baseline_ | all | — | 61846 / 20960 / 1258 | — | yes | — | Pre-optimization profiling |
