# TODOS

## Deferred from RCLL satellite scan optimization (2026-06-23)

### TODO-1: Semantic view satellite scan — same O(P×K×N) pattern at `terraformTopologyLayout.ts:288`

**What:** `terraformTopologyLayout.ts:288` calls `collectTopologySatelliteAddressesFromRegistry` directly on zone-anchored primaries — the same O(P×K×N) scan pattern fixed in RCLL by the batch function. Apply the batch pattern to this callsite after RCLL batch is proven.

**Why:** Once `buildAllSatellitePrimaryMappings` is stable and the equivalence test is green on the RCLL path, applying the same batch to the semantic view's satellite scan is low-risk and follows the same pattern.

**Pros:** Closes the last known O(P×K×N) scan in the non-RCLL topology pipeline. Reduces the semantic view's prep cost (currently the dominant cost is skeleton build ~20s, but satellite scan is still a measurable fraction).

**Cons:** Semantic view's dominant bottleneck is skeleton build (not this scan), so this won't move the headline number much. Don't prioritize over skeleton-build investigation.

**Context:** The semantic view has a separate `~22s` bottleneck profile from `staging-multi-state-expanded`. This scan is in `buildTerraformTopologyExcalidrawScene` (the non-RCLL path). The RCLL optimization (this branch) does NOT touch it. The caller is `filterTopologyAddressesExcludingPrimarySatellites` at `terraformTopologyLayout.ts:150`.

**Depends on:** RCLL batch function (T1-T2) shipped and equivalence test green.

---

### TODO-2: ~~Zone resolution O(N×Z) tail in `prep.resourceRects`~~ — RESOLVED, no longer applicable (2026-06-23)

**Resolution:** T1-T4 shipped and measured. `prep.resourceRects` dropped from ~1,402ms to ~10ms (median of 3 runs) — the satellite scan removed by T3 was effectively its *entire* cost. The projected zone-resolution O(N×Z) residual this TODO anticipated did not materialize as a meaningful cost on `staging-extended-localstack-v2`. No further action needed here.

---

### TODO-3: True O(K×N) batch for `prep.satelliteBundles` — requires plugin-level type indexing

**What:** `buildAllSatellitePrimaryMappings` (`terraformTopologySatelliteRegistry.ts`) still runs the original O(P×K×N) per-primary loop — T1/T2 only factored it into a named, reusable function (so T3 could reuse its result), they did not reduce its complexity. `prep.satelliteBundles` is unchanged at ~1,364ms (median). To actually cut this, add a `nodesByType: Map<string, string[]>` pre-index (built once per build, O(N)) to `SatelliteBuildContext`, and thread it through the ~15 plugin helpers in `terraformTopology{Iam,Ecs,Alb,S3,Sqs,Eks,ApiGateway,TransitGateway,Sg,Datastore}Links.ts` so each plugin's internal `Object.keys(nodes)` scan becomes a `nodesByType.get(type) ?? []` lookup, i.e. O(N_type) instead of O(N) per (primary, kind) call.

**Why:** 16 of the 18 `TOPOLOGY_SATELLITE_KINDS` are `plugin`-mode (only `kms_policies` and `lambda_permission` are `reverseRef`/`companions`), and each plugin does its own per-primary `Object.keys(nodes)` scan internally (confirmed by reading `terraformTopologyEcsLinks.ts`, `terraformTopologyIamLinks.ts`). A registry-level batch (scanning once per kind across all primaries, as originally scoped in the eng-reviewed plan) can't reach inside opaque plugin functions without rewriting each one — out of scope for a single pass.

**Pros:** Projected ~10-40x further reduction on `prep.satelliteBundles` (N=3,886 over ~100 resource types → N_type_avg ≈ 39), since the per-primary-per-kind cost is currently dominated by scanning irrelevant-type nodes.

**Cons:** Touches ~15 files instead of 2-3; each plugin helper needs the same mechanical edit (replace `Object.keys(nodes)` with the indexed lookup, with a `?? Object.keys(nodes)` fallback for callers outside the indexed context) and needs its own equivalence check since each plugin has slightly different filtering logic.

**Context:** Confirmed by reading plugin call sites (e.g. `terraformTopologyIamLinks.ts:163`, `terraformTopologyIamLinks.ts:194`, `terraformTopologyIamLinks.ts:402`, `terraformTopologyEcsLinks.ts:270`) — these helper functions iterate `Object.keys(nodes)` and filter by resource type inline.

**Depends on:** None (T1-T4 already shipped and measured per the 2026-06-23 perf log row).

**Status (2026-06-23):** Implementation plan locked via `/plan-eng-review` — see `nodesByType` index design (T-1 consolidation commit + T0 infra + T1 IAM/ECS + T2 ALB/SG/S3/SQS + T3 EKS/APIGW/TGW/CloudWatch/Route + T4 measure). Not yet implemented.

---

### TODO-4: Consolidate `terraformTopologyKmsLinks.ts`'s `getResourceTypeFromPath` duplicate

**What:** Delete `terraformTopologyKmsLinks.ts:31`'s private copy of `getResourceTypeFromPath`, import the canonical exported `getTopologyResourceType` (`terraformTopologySatelliteEngine.ts`) instead.

**Why:** This is the 4th of 4 byte-identical duplicate copies of this function. TODO-3's implementation plan consolidates the other 3 (IAM, SG, CloudWatch — all otherwise touched by the `nodesByType` threading work) but explicitly leaves this one alone since KMS is companions-mode and not touched by that pass.

**Pros:** Zero-risk mechanical cleanup once TODO-3's T-1 consolidation commit proves the pattern is safe (same delete-and-reimport move, just on a 4th file).

**Cons:** `terraformTopologyKmsLinks.ts` isn't otherwise touched by anything else right now, so this is a standalone 1-file PR for a small DRY gain — low urgency.

**Context:** Surfaced during `/plan-eng-review` of TODO-3's implementation plan (2026-06-23).

**Depends on:** TODO-3's T-1 consolidation commit landing cleanly (establishes the pattern/precedent).

---

## Deferred from graph-layout-rag reranker/GraphRAG cancellation (2026-06-23)

### TODO-5: Consolidate rejected-technique memory entries for graph-layout-rag into one index

**What:** `graph-rag-contextual-rejected`, `graph-rag-rerank-retest-rejected` (now also covering
reranker fine-tuning), and `graph-rag-graphrag-rejected` are three separate memory files that all
restate a shared root cause — this corpus is BM25-dominant and resists dense/semantic/graph-shaped
techniques. Consolidate into a single index page with one shared "why" section and per-technique
specifics, rather than three-plus flat entries.

**Why:** Five-plus rejected-technique memory entries with overlapping rationale risk getting harder
to navigate than one index page would be. Surfaced by an outside-voice review during
`/plan-eng-review` of the cancellation writeup (2026-06-23).

**Pros:** One canonical place to read "why doesn't X work on this corpus," instead of needing to
read three+ files to notice they all say the same thing about retrieval shape.

**Cons:** Consolidation work itself, and flattening loses some of each entry's independent
searchability (a memory search for "contextual retrieval" currently surfaces exactly the right
file; a consolidated index would surface the whole cluster).

**Context:** Three entries exist today: `graph-rag-contextual-rejected.md`,
`graph-rag-rerank-retest-rejected.md`, `graph-rag-graphrag-rejected.md`. Not urgent at this count —
worth doing if a 4th-5th technique gets rejected on this corpus in the future.

**Depends on:** Nothing blocking — can be done anytime.
