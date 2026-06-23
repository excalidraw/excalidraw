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

### TODO-3: ~~True O(K×N) batch for `prep.satelliteBundles` — requires plugin-level type indexing~~ — RESOLVED (2026-06-23)

**Resolution:** nodesByType index shipped and measured (T-1 consolidation + T0 infra + T1 IAM/ECS + T2 ALB/SG/S3/SQS + T3 EKS/APIGW/TGW/CloudWatch/Route). `prep.satelliteBundles` dropped from ~1,364ms to **~174ms** (−87%, median of 3 runs). Commits: T-1 `c7f3c4da7`, T0 `c301cc8f5`, T1 `a89ad68b8`, T2 `a30013f0f`, T3 `70ebb3cc9`. `pipeline.rcll.stage.placement` (~312ms) is now the dominant pipeline prep/RCLL span. See 2026-06-23 perf-log row for full details. Untouched (by design): `terraformTopologyDatastoreLinks.ts` (module-scope filter), `terraformTopologyKmsLinks.ts` (companions mode — see TODO-4), `terraformTopologyLambdaPermissionLinks.ts` (reverseRef mode), `terraformTopologyRouteLinks.ts` (plan-changes-based, no nodes scans).

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
