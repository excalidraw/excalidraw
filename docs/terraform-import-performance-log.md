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
| Semantic | 64,081 | 9,160 | Prep cache + topology opts (workers off) |
| Pipeline | 15,927 | 1,121 | Shared `enrichedPlacements` via prep cache |
| Module | 5,048 | per-stack ELK | Multi-stack parallel path in `layoutTerraformFromSources` |

---

## Change log

Newest first.

| Date | Change | View | Before (ms) | After (ms) | Δ% | Layout snap OK? | Top span | Notes |
|------|--------|------|-------------|------------|-----|-----------------|----------|-------|
| 2026-06-02 | Perf infra: prep cache, VPC measure single-pass, route-table index reuse, icon O(S), enrich reconcile skip, module parallel | semantic | 62,000 | 64,081 | +3% | yes | prep.cache | Within noise; pipeline improved |
| 2026-06-02 | Same | pipeline | 21,000 | 15,927 | -24% | yes | prep.cache | Skips second `buildEnrichedTopologyPlacements` |
| 2026-06-02 | Same | module | 1,300 | 5,048 | — | snap updated | layout.module.parallel | Per-stack ELK compose; intentional module `.snap` |
| 2026-06-02 | *baseline* | all | — | 61846 / 20960 / 1258 | — | yes | — | Pre-optimization profiling |
