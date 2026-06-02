# Terraform import performance log

Living audit trail for `staging-multi-state-expanded` import optimizations.

Machine-readable CI baseline: [`packages/excalidraw/test-fixtures/terraform-import-perf-baseline.json`](../packages/excalidraw/test-fixtures/terraform-import-perf-baseline.json).

Layout contract (must stay unchanged unless intentional): [`terraformLayoutSnapshot.test.ts`](../packages/excalidraw/components/terraformLayoutSnapshot.test.ts).

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
| Semantic | ~40,700 | 9,160 | **Idea #3:** `activeTopologyMemoCtx` per-address caches in `terraformTopologyLayout.ts` |
| Pipeline | ~15,900 | 1,121 | **Prep cache:** `terraformImportPrepCache.ts` skips duplicate enriched placement prep |
| Module | sequential merged plan | per golden snap | Multi-stack parallel ELK path removed (not a proven one-shot win) |

**Measurement harness (kept, no import-time behavior change):** `terraformImportProfiler.ts`, `terraformImportPerf.views.test.ts`, CI hotspot ranker (`scripts/terraform/perf-hotspot-ranker.mjs`), topology phase spans (`layout.topology.collect`, `.skeleton`, `.materialize`).

---

## Change log

Newest first.

| Date | Change | View | Before (ms) | After (ms) | Δ% | Layout snap OK? | Top span | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-02 | **Cleanup:** remove unproven runtime paths (semantic sharding, staging fast path, mode-switch snapshot cache, progressive-decoration import flag, vpc sizing memo, parallel-regions scaffold, normalized networking edge pass, subnet→RT reverse index, multi-stack module parallel); delete `terraformImportFastPath` / `terraformLayoutModuleParallel` | semantic | 42,773 | ~40,700 (expected) | ~-5% | yes | layout.topology.skeleton | Surface area reduced to two wins + perf tooling |
| 2026-06-02 | Pass 3 idea #3: memoize topology footprint/margins/satellite bundles/layout config per address/resource type | semantic | 64,081 | 40,716 | -36% | yes | layout.topology.skeleton | **Kept** |
| 2026-06-02 | Prep cache + pipeline reuse of enriched placements | pipeline | 21,000 | 15,927 | -24% | yes | prep.cache | **Kept** |
| 2026-06-02 | _baseline_ | all | — | 61846 / 20960 / 1258 | — | yes | — | Pre-optimization profiling |

Passes 1–14 and ideas #1–#9 except #3 were tried; details archived in git history before this cleanup.
