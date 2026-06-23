# RCA: slow RCLL all-resources import (`staging-extended-localstack-v2`)

**Date:** 2026-06-22
**Scope:** Root-cause measurement only. No optimization landed in this pass — see `docs/terraform-import-performance-log.md` for where to pick that up.

## The question

Importing `staging-extended-localstack-v2` with pipeline view **RCLL**, **Compact** detail, **All resources**
(`includeAncillary: true`), **no debanding** (`deBandLevel: "none"`), all optional stages on (crossingMin,
straighten, reorder, rankSeparate, columnCompact, swimlaneLaneRise, staircaseBandOverlap) takes **17-25s in a Node
test harness** and **30-60s felt in the browser**. Before this pass, the entire build ran inside one opaque
`layout.pipeline` profiler span — there was no way to attribute the time to a specific step.

## Method — four independent, cross-validating measurement layers

1. **Deterministic span + counter instrumentation** (Layer 4) — added profiler spans (`terraformImportProfiler.ts`)
   around every phase of `buildTerraformPipelineRcllExcalidrawScene` and its sub-calls, plus gated
   `[terraform:rcll-instr]` counters for loop/iteration counts. Verified a true no-op: typecheck clean, 50/50
   targeted tests green, **zero `.snap` diffs** across `terraformLayoutSnapshot`, `terraformLayoutWorkerParity`,
   `terraformImportPrepCache`, `terraformPipelineRcll*`, `terraformPipelineRcllAncillaryIntegration`.
2. **Node CPU profile / flame graph** (Layers 2-3) — ran the exact `buildV2()` config from
   `terraformPipelineRcllAncillaryIntegration.test.ts` standalone via `vite-node` (main-thread, so `--cpu-prof`
   actually attributes samples — vitest's own worker threads defeat sampling) under `node --cpu-prof` and `npx 0x`.
   Produced a real `.cpuprofile` + `flamegraph.html`.
3. **Browser performance trace** (Layer 1) — drove the real Terraform Import dialog via chrome-devtools-mcp with
   the exact preset/options, `performance_start_trace` → import → `performance_stop_trace`.
4. **3-run statistical aggregation** — every Node number below is a median of 3 runs; noise reported, not hidden.

## Finding 1 — the build is ~8.2s in Node, not 17-25s, when isolated to pure layout computation

Calling `buildTerraformPipelineRcllExcalidrawScene` directly (skipping plan-merge/parse, which the original 17-25s
anchor included) takes **~8.2s median**. This isolates the RCLL pipeline's own cost from upstream parsing —
useful for attribution, but it means the 17-25s Node anchor and the 30-60s browser anchor both contain phases
*outside* this function (parse/merge upstream, and DOM/canvas/React apply downstream in the browser). See Finding
4 for the browser-side reconciliation.

## Finding 2 — two prep sub-spans are >97% of the isolated build, both configs

Median self-ms across 3 runs, all-resources config:

| span | ms (median) | calls |
| --- | --- | --- |
| `pipeline.prep.satelliteBundles` (`buildSatelliteOwnerMap`) | **3,958.3** | 1 |
| `pipeline.prep.resourceRects` (`buildPlacementMap`) | **3,942.0** | 1 |
| `pipeline.rcll.stage.placement` | 305.2 | 1 |
| `pipeline.rcll.scene` | 99.2 | 1 |
| `pipeline.rcll.ancillaryInsert` | 82.9 | 1 |
| `pipeline.rcll.ancillaryStrips` | 6.0 | 1 |
| `pipeline.rcll.crossingMin.count` | 5.1 | 4 |
| `pipeline.prep.materialize` | 4.0 | 1 |

`pipeline.prep` (the parent span) is ~7.9s inclusive but only ~1.9ms self — i.e. essentially 100% of `prep` is
these two sub-calls. **Dataflow-only** (`includeAncillary: false`) shows the identical ~3,950-3,980ms for both
spans — ancillary inclusion does not touch this cost at all. RCLL's own stages (layering, placement,
crossingMin, reorder, straighten, rankSeparate, columnCompact) and the ancillary allocator together are **under
400ms combined** — a rounding error against the ~7.9s prep phase.

**Ancillary surcharge (by subtraction):** isolating `includeAncillary: true` vs `false` gives a surcharge signal of
+55ms / -221ms / +2.5ms across 3 runs — i.e. it does not cleanly reconcile by subtraction because it's *smaller
than the run-to-run noise* (~150-200ms) of the dominant 7.9s prep phase. The ancillary spans' own direct
measurement is more reliable: `ancillaryStrips` + `ancillaryInsert` sum to a consistent **~94-95ms** across all 3
runs. **Conclusion: ancillary processing genuinely costs ~90-95ms and is not a contributor to the slowness.**

## Finding 3 — the flame graph names the exact mechanism: a shared O(N²) lookup, not the builders themselves

The Node CPU profile shows `buildSatelliteOwnerMap` and `buildPlacementMap` bottom out in the **same shared
function**: `resolveTerraformPlanNodeKey` (`terraformPlanParsing.tsx:545`). On every address resolution it does a
**full `Object.keys(nodes)` scan**, running `parseStackAddress` against every key, and on a cache miss falls
through to `collectKnownStackIdsFromNodes(nodes)` (`terraformStackAddress.ts:110`) — **another** full
`Object.keys(nodes)` scan with `parseStackAddress` per key. Both builders call this transitively per
resource/satellite/ARN-field (via `terraformModulePrefixForAddress`, `resolveS3BucketFieldToBucketPath`,
`findIamRoleInModuleByRoleField`, `resolveRestApiIdToRestApiPath`, etc.) — once per lookup, not once per build. With
N = thousands of resources on this fixture, that's **N lookups × O(N) scan-with-regex each = O(N²)**.

In the flame graph, `terraformModulePrefixForAddress` is the single hottest leaf (~3,000-3,100 self-hits per
subtree out of ~31k total) — a cheap O(1) string-split, dominant purely from **call-count blowup**, not per-call
cost. The address-index regexes (`stripInstanceIndexes`/`stripTerraformAddressIndexes`'s `/\[[^\]]+\]/g`, plus
`STACK_ID_PATTERN.test`) independently show up as hot anonymous leaves (~1,000-2,200 self-hits each occurrence),
confirming the regex cost compounds the quadratic scan rather than being the primary driver on its own.

**Root cause, precisely stated:** `preparePipelineLayout`'s two dominant sub-calls are slow not because the
per-resource/per-satellite logic they run is expensive, but because every one of those per-resource/satellite
lookups re-derives stack/address metadata from `nodes` from scratch via a linear-with-regex scan, instead of
building an address→key (and known-stack-id) index **once** and reusing it. This is the same class of
already-documented finding as `docs/terraform-import-performance-log.md`'s Lever 2 (per-resource builders) for the
**semantic** view — confirming the underlying defect is shared infrastructure-level, not view-specific.

## Finding 4 — the browser reproduces the reported 30-60s range; the Node/browser gap is real and separate

A real chrome-devtools-mcp trace of the actual import dialog (same exact config, preset picker → RCLL → Compact →
All resources → De-band none → all optional stages) measured **57-60s wall-clock**, squarely in the reported
30-60s range — confirming the slowness reproduces outside the test harness. The `[terraform:rcll-instr]` debug
logs fired mid-import, confirming the instrumented spans execute on the real path. Two infrastructure gaps
prevented pulling the granular browser-side script-vs-paint breakdown and the in-page profiler numbers in this
pass (trace JSON didn't persist to disk via the MCP tool; `terraformImportProfilerSummary()` isn't exposed on
`window`) — both are tooling gaps, not failures of the import itself, and are cheap follow-ups (expose the
summary function behind the existing `terraformImportProfile` flag) if a future pass wants the exact browser-side
split. Given Finding 1-3 isolate ~8.2s to the pure layout computation, the remaining ~49-52s of browser wall-clock
is upstream parsing/merge and/or downstream DOM/canvas/React element-apply for ~3,886 elements — outside this
function's boundary and not yet attributed at the same granularity as the prep phase.

## Root cause statement

The dominant, unambiguous cost (>97% of the isolated RCLL build, ~7.9 of ~8.2s) is **not** the RCLL layout
algorithm (layering/placement/crossingMin/reorder/straighten/rankSeparate/columnCompact), **not** the ancillary
allocator (~90-95ms, confirmed directly), and **not** scene materialization (~0.1s) — it is `preparePipelineLayout`'s
two builders (`buildPlacementMap`, `buildSatelliteOwnerMap`), both of which funnel every per-resource/per-satellite
address lookup through `resolveTerraformPlanNodeKey`, which performs a full linear `Object.keys(nodes)` scan with
regex per call instead of an index built once. This is genuine algorithmic redundancy (O(N²) where O(N) is
achievable with a one-time index), not irreducible per-resource work — evidenced by the flame graph's hottest leaf
being a trivially-cheap function (`terraformModulePrefixForAddress`) whose cost is purely call-count, and by
`collectKnownStackIdsFromNodes` independently re-scanning the same `nodes` map on every cache miss.

**Optimization (next pass, not in this RCA):** build the address→key / known-stack-id index once per `nodes`
object (memoize `collectKnownStackIdsFromNodes` the same way `buildArnIndexForTopology` is already memoized per
the 2026-06-02 change log row) and have `resolveTerraformPlanNodeKey` consult it instead of scanning. This is
expected to be snapshot-safe (pure memoization, no layout change) and should collapse the ~7.9s prep phase toward
the per-call cost of an O(1) (or O(log N)) lookup.

## Visual artifacts (scratchpad)

- `rca-run-{1,2,3}.log` — raw Layer-4 profiler test output, 3 runs
- `rca-profile-run-{1,2,3}.json` — per-run profiler summaries
- `rca-layer4-summary.json` — min/median/max aggregation + ancillary surcharge analysis
- `rca-pipeline.cpuprofile` — Node CPU profile (drag into Chrome DevTools Performance panel, or `npx speedscope`)
- `0x-profile/flamegraph.html` — self-contained 0x flame graph

(Scratchpad: `/private/tmp/claude-501/-Users-tusharsariya-Projects-excalidraw-tf/82aa1772-7ee9-4bb1-a9a9-aaa45fc24181/scratchpad/` — not committed; copy out if you want these to persist past the session.)

## Verification

- Typecheck: clean.
- Tests: 50/50 green across `terraformLayoutSnapshot`, `terraformLayoutWorkerParity`, `terraformImportPrepCache`,
  `terraformPipelineRcll`, `terraformPipelineRcllAncillaryIntegration`, `terraformPipelineRcllAncillaryAllocator`,
  `terraformPipelineRcllCrossingMin`.
- Zero `.snap` diffs — the instrumentation is confirmed layout-neutral.
- New measurement-only test file (uncommitted by design — it's a manual profiling aid, not a CI-gating test):
  `packages/excalidraw/components/terraformPipelineRcllProfile.measure.test.ts`.
