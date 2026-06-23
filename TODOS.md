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
