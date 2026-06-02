# Terraform import performance log

Living audit trail for `staging-multi-state-expanded` import optimizations. Update this file on **every** optimization attempt (including reverts).

Machine-readable CI baseline: [`packages/excalidraw/test-fixtures/terraform-import-perf-baseline.json`](../packages/excalidraw/test-fixtures/terraform-import-perf-baseline.json).

Layout contract (must stay unchanged unless intentional): [`terraformLayoutSnapshot.test.ts`](../packages/excalidraw/components/terraformLayoutSnapshot.test.ts).

---

## Baseline (frozen — pre-optimization)

Measured locally (25 stacks, 792 merged `resource_changes`, workers on/off ~same for semantic).

| Metric | Semantic | Pipeline | Module |
|--------|----------|----------|--------|
| Wall-clock total | ~62,000 ms | ~21,000 ms | ~1,300 ms (skipped layout) |
| DB load | ~100 ms | ~100 ms | ~100 ms |
| `buildTerraformLocalImportNodesMap` | ~800 ms | (in core) | N× stacks |
| Placement prep (`enrichAndReconcile…`) | ~3,500 ms | re-run in pipeline | — |
| `buildTerraformTopologyExcalidrawScene` | ~57,000 ms | — | — |
| Elements produced | 9,160 | 1,121 | 0 (`vertex_count_exceeds_600`) |

---

## Current best

| View | Wall-clock (ms) | Elements | Notes |
|------|-----------------|----------|-------|
| Semantic | 40,716 | 9,160 | Idea #3 memoization caches in topology layout |
| Pipeline | 15,927 | 1,121 | Shared `enrichedPlacements` via prep cache |
| Module | 5,048 | per-stack ELK | Multi-stack parallel path in `layoutTerraformFromSources` |

---

## Change log

Newest first.

| Date | Change | View | Before (ms) | After (ms) | Δ% | Layout snap OK? | Top span | Notes |
|------|--------|------|-------------|------------|-----|-----------------|----------|-------|
| 2026-06-02 | Pass 9 idea #9: CI hotspot auto-ranker (semantic perf test with `VITEST_TERRAFORM_PROFILE=1`, JSON artifact via `VITEST_TERRAFORM_PROFILE_OUT`, summary script `scripts/terraform/perf-hotspot-ranker.mjs`) | process | n/a | n/a | n/a | n/a | profiling spans | Kept: non-blocking PR prepush step; uploads `terraform-import-hotspot-profile` artifact and writes top spans/regressions to job summary |
| 2026-06-02 | Pass 8 idea #8: staging preset fast path (`VITE_TERRAFORM_STAGING_FASTPATH=1`) — skip non-AWS provider jobs + `skipZoneRouteAnchorDebug` in topology for 25-stack AWS-only preset | semantic | 40,716 | 41,904 | +3% | yes | layout.topology.skeleton | Kept opt-in only; no sustained win (noise-level regression). Default path unchanged. |
| 2026-06-02 | Pass 7 idea #7 attempt: IndexedDB-backed persistent prep cache (`VITE_TERRAFORM_PERSIST_PREP_CACHE=1`) | semantic | 40,924 | 39,859 | -2.6% | yes | prep.cache | Reverted: persistent write/load path caused large module regression |
| 2026-06-02 | Pass 7 idea #7 attempt (same run) | pipeline | 16,238 | 15,854 | -2.4% | yes | prep.cache | Reverted with idea #7 |
| 2026-06-02 | Pass 7 idea #7 attempt (same run) | module | 5,173 | 8,852 | +71% | yes | layout.module.parallel | Reverted; unacceptable regression despite semantic gain |
| 2026-06-02 | Pass 6 idea #6: optional progressive decoration (`deferDecorations`) skips icon/glyph pass on first semantic render when `VITE_TERRAFORM_PROGRESSIVE_DECORATION=1` | semantic | 41,031 | 40,924 | -0.3% | yes | layout.topology.materialize | Kept as opt-in UX mode; tiny benchmark gain |
| 2026-06-02 | Pass 6 idea #6 (same run, opt-in mode) | pipeline | 16,363 | 16,238 | -0.8% | yes | layout.pipeline | Small improvement |
| 2026-06-02 | Pass 6 idea #6 (same run, opt-in mode) | module | 5,251 | 5,173 | -1.5% | yes | layout.module.parallel | Small improvement |
| 2026-06-02 | Pass 5 idea #5: subnet→route-table reverse index for fanout filtering (`subnetToRouteTableAddrs`) | semantic | 41,358 | 41,031 | -1% | yes | layout.topology.skeleton | Kept; small but consistent win in fanout-heavy path |
| 2026-06-02 | Pass 5 idea #5 (same run) | pipeline | 16,547 | 16,363 | -1% | yes | layout.pipeline | Small improvement |
| 2026-06-02 | Pass 5 idea #5 (same run) | module | 5,329 | 5,251 | -1% | yes | layout.module.parallel | Small improvement |
| 2026-06-02 | Pass 4 idea #4: incremental semantic↔pipeline switch via `snapshotsByLayoutMode` cache keyed by source fingerprint | semantic | 40,716 | 41,358 | +2% | yes | layout.semantic | Kept for interactive mode-switch latency; not expected to improve one-shot import benchmark |
| 2026-06-02 | Pass 4 idea #4 (same run) | pipeline | 16,290 | 16,547 | +2% | yes | layout.pipeline | Noise-level change; feature benefit is reusing cached switch state |
| 2026-06-02 | Pass 4 idea #4 (same run) | module | 5,308 | 5,329 | +0% | yes | layout.module.parallel | Neutral |
| 2026-06-02 | Pass 3 idea #3: memoize topology footprint/margins/satellite bundles/layout config per address/resource type in semantic layout run | semantic | 64,081 | 40,716 | -36% | yes | layout.topology.measure / skeleton | Kept; major win with no snapshot drift |
| 2026-06-02 | Pass 3 idea #3 (same run) | pipeline | 15,927 | 16,290 | +2% | yes | layout.pipeline | Noise-level change |
| 2026-06-02 | Pass 3 idea #3 (same run) | module | 5,048 | 5,308 | +5% | yes | layout.module.parallel | Noise-level change |
| 2026-06-02 | Pass 2 idea #2 attempt: edge precompute + single-pass filtering in topology edge pipeline | semantic | 64,081 | 65,527 | +2% | yes | layout.topology.edges | Reverted (no gain; slower) |
| 2026-06-02 | Pass 2 idea #2 attempt (same run) | pipeline | 15,927 | 16,967 | +7% | yes | layout.pipeline | Reverted with semantic change |
| 2026-06-02 | Pass 2 idea #2 attempt (same run) | module | 5,048 | 5,374 | +6% | yes | layout.module.parallel | Reverted with semantic change |
| 2026-06-02 | Pass 1 idea #1 attempt: semantic AWS sharding scaffolding (`semanticAwsShard`) with region-split compose path behind `VITE_TERRAFORM_SEMANTIC_SHARDING=1` | semantic | 64,081 | 64,799 | +1% | yes | layout.semantic.workers | No measurable gain; keep scaffolding guarded and move to idea #2 |
| 2026-06-02 | Pass 1 idea #1 attempt (same run) | pipeline | 15,927 | 16,205 | +2% | yes | layout.pipeline | Noise-level regression |
| 2026-06-02 | Pass 1 idea #1 attempt (same run) | module | 5,048 | 5,156 | +2% | yes | layout.module.parallel | Noise-level regression |
| 2026-06-02 | Perf infra: prep cache, VPC measure single-pass, route-table index reuse, icon O(S), enrich reconcile skip, module parallel | semantic | 62,000 | 64,081 | +3% | yes | prep.cache | Within noise; pipeline improved |
| 2026-06-02 | Same | pipeline | 21,000 | 15,927 | -24% | yes | prep.cache | Skips second `buildEnrichedTopologyPlacements` |
| 2026-06-02 | Same | module | 1,300 | 5,048 | — | snap updated | layout.module.parallel | Per-stack ELK compose; intentional module `.snap` |
| 2026-06-02 | *baseline* | all | — | 61846 / 20960 / 1258 | — | yes | — | Pre-optimization profiling |

---

## Candidate ideas backlog (next passes)

Goal: reduce semantic import wall-clock from ~64s toward <40s first, then <20s.

### Priority order

1. Semantic worker sharding by region/VPC
2. Edge precompute and single-pass filtering
3. Topology memoization for footprint/satellite bundles
4. Incremental semantic↔pipeline mode switching
5. Route-table fanout reverse index
6. Progressive decoration (icons/glyphs after first paint)
7. Persistent prepared-graph cache (IndexedDB)
8. Preset-specific fast path for `staging-multi-state-expanded`
9. CI auto-ranker for next hotspot

### 1) Semantic worker sharding by region/VPC

- Idea: split `buildTerraformTopologyExcalidrawScene` into independent jobs by `(account, region)` or `(account, region, vpc)` and compose scenes.
- Expected impact: high (largest CPU block today).
- Risk: medium (must preserve deterministic ordering and bindings).
- Validation:
  - `terraformLayoutSnapshot.test.ts` unchanged (except intentional).
  - `terraformLayoutWorkerParity.test.ts` unchanged.
  - Compare `layout.topology.*` spans before/after.

### 2) Edge precompute and single-pass filtering

- Idea: compute dependency/network/dataflow edge collections once, then filter by placed vertex sets for each layer instead of re-building partitions.
- Expected impact: high.
- Risk: medium (edge semantics easy to drift).
- Validation:
  - Snapshot and parity tests must stay green.
  - Add focused tests around cross-stack and dataflow edge counts.

### 3) Topology memoization (footprint + satellite bundles)

- Idea: memoize repeated computations keyed by `(address, role, flags)`:
  - primary footprint sizing
  - satellite bundle resolution
  - endpoint SG cluster calculations
- Expected impact: medium-high.
- Risk: low-medium (cache invalidation scope must be per-layout-run).
- Validation: no snapshot diffs; measure span self-time drop in topology measure/skeleton phases.

### 4) Incremental semantic↔pipeline mode switch

- Idea: reuse precomputed placements/geometry when toggling views; rebuild only differing edge layers and wrappers.
- Expected impact: medium for interactive UX.
- Risk: medium.
- Validation:
  - Add mode-switch parity tests from same source session.
  - Ensure no stale data after source changes.

### 5) Route-table fanout reverse index

- Idea: build `subnetId -> routeTableAddresses[]` index once, replacing per-table/per-zone intersection checks.
- Expected impact: medium.
- Risk: low.
- Validation: route-table specific topology tests + snapshot stability.

### 6) Progressive decoration (icons/glyphs post-layout)

- Idea: render structural scene first; inject icons/glyph duplicates in follow-up pass for perceived latency improvements.
- Expected impact: low-medium wall-clock, medium UX.
- Risk: medium (async consistency with undo/session snapshots).
- Validation: ensure final scene equals baseline scene after decoration completes.

### 7) Persistent prepared-graph cache (IndexedDB)

- Idea: store prepared `nodes + placements + indexes` keyed by fingerprint across reloads.
- Expected impact: medium on repeated imports.
- Risk: medium-high (versioning/invalidation complexity).
- Validation: cache-hit parity tests and strict fingerprint versioning.

### 8) Preset-specific fast path (`staging-multi-state-expanded`) — done (opt-in)

- Implemented: `terraformImportFastPath.ts` + `VITE_TERRAFORM_STAGING_FASTPATH=1` skips non-AWS provider worker jobs and `zoneRouteAnchorDebug` collection for the 25-stack AWS-only preset.
- Result: no measurable win (~+3% noise on one local run); kept behind flag for future branch pruning.
- Enable: `VITE_TERRAFORM_STAGING_FASTPATH=1` when importing `staging-multi-state-expanded` (25 `planDotBundles`).

### 9) CI auto-ranker for next hotspot

- Idea: parse profiler output in CI and post top regressions/hotspots as next target candidates.
- Expected impact: process improvement, not direct runtime.
- Risk: low.
- Validation: stable reporting, no noisy false positives.

### Working rule for each idea

For each optimization attempt:

1. Record pre-run timings (semantic/pipeline/module).
2. Implement one focused change.
3. Run layout + parity + perf tests.
4. Append new row in this log with before/after and decision (kept/reverted).
