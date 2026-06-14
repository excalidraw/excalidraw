# Pipeline semantic placement — audit report

Deliverable for the research mission in [pipeline-semantic-placement-agent-handoff.md](./pipeline-semantic-placement-agent-handoff.md). Evidence- and literature-grounded audit of how the Terraform **pipeline** view places resources, and a phased design for improving **dataflow readability**, **topology coherence**, and **relationship salience**. Recommendations R1–R5 are now implemented behind the opt-in **`pipelineSemanticPlacement`** toggle — see [Implementation status](#implementation-status) at the end.

- **Canonical study config:** `staging-extended-localstack-v2`, Full + Compound + Packed + pull-left + All resources.
- **Metrics instrument:** `packages/excalidraw/components/terraformPipelineSemanticAudit.test.ts` (run `VITEST_TERRAFORM_VERBOSE=1 yarn vitest run …terraformPipelineSemanticAudit.test.ts`).
- **Literature:** local `graph-layout-rag` corpus (`gemini-2-structure-v1`) + web, deep-read papers cited inline.

---

## 1. Executive summary

### Top 3 things that already work

1. **Hulls never literally overlap.** Across every config, region–region, account–account, non-ancestor, and frame-title-vs-cluster rectangle collisions are **0**. The X-disjoint skyline share (`packSiblings`) + per-level `PIPELINE_FRAME_PAD` inflation is sound — the founding "hulls are derived from placement" principle holds geometrically.
2. **Packing is effective compaction.** Packed + pull-left cuts scene height ~**60%** (18 522 → 7 520 px compact) and, as a side effect, roughly **halves TFD arrow crossings** (249 → ~140) by seating receiver lanes beside their sources.
3. **Compound group-drag coherence is real.** LCA arrow parenting plus 21 aggregated sibling-frame connectors mean dragging an account/region frame moves its resources and in-group arrows together.

### Top 3 failures (on the canonical config)

1. **Dataflow is not legible without tracing (the priority gap).** 145 declared arrows, **~137–249 crossings**, only **12–17 % near-straight**, **median vertical deviation 350–1 220 px**. There is **no crossing-reduction phase and no coordinate-assignment/straightening phase** — a cluster's Y comes from lane stacking order, so ~85 % of arrows run diagonally.
2. **Packing sacrifices topology band purity.** Packed layouts put **6–7 region pairs and 1 account pair** in shared vertical bands (X-disjoint but Y-overlapping). Stacked avoids this only by being **2.5× taller**. The role-aware forced bands in `REGION_SUBNET_VERTICAL_BANDS_PLAN.md` are **specced but unimplemented** — `packSiblings` ignores `PackNode.role`.
3. **The "most aggressive" canonical config is the least readable for dataflow.** Full + ancillary make the scene the **tallest (25 387 px)** and give it **worse** arrow straightness than compact+packed (median 931 vs 353 px). Detail=Full and Resources=All inflate Y and dilute the dataflow spine.

### One-line architecture conclusion

The pipeline implements layering (columns) and a coordinate/packing pass, but **omits the ordering and coordinate-assignment phases that the graph-drawing literature considers mandatory for a compound layered graph.** That omission is where every dataflow-readability failure lives.

---

## 2. Configuration matrix (real metrics, v2)

All from `terraformPipelineSemanticAudit.test.ts`. Crossings use a first→last-point chord per arrow (consistent proxy across configs; elbow bends not traced).

| Config | W × H (px) | Elems | Cols | TFD arrows | **Crossings** | **Near-straight** | **Median ΔY** | Region band-share | Account band-share | Rect collisions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| defaults (classic+compact+stacked) | 8 038 × 18 522 | 1 333 | 16 | 145 | **249** | 14 % | 1 221 | 0 | 0 | 0 |
| compound+compact+stacked | 8 038 × 18 522 | 1 333 | 16 | 145 | 249 | 14 % | 1 221 | 0 | 0 | 0 |
| compound+compact+packed+pullLeft | 12 466 × **7 520** | 1 333 | 23 | 145 | 142 | **17 %** | **353** | 6 | 1 | 0 |
| **canonical** (compound+full+packed+pullLeft+ancillary) | 15 255 × **25 387** | 7 994 | 24 | 145 | **137** | 12 % | 931 | 7 | 1 | 0 |

**What each toggle changes:**

- **Compound vs Classic:** identical geometry/metrics (adds 21 sibling connectors + LCA parenting only). Confirms compound is a coherence post-pass, not a placement change.
- **Stacked vs Packed:** packed trades height (−60 %) for width (+55 %), halves crossings, improves straightness (1 221 → 353 median) — _but_ introduces 6–7 region band-shares. Stacked keeps bands pure trivially (every lane its own band).
- **Compact vs Full:** Full explodes element count (1 333 → 7 994) and, with ancillary, makes the scene tallest and _worsens_ straightness (taller clusters spread Y). Full is a richness/scale trade, not a readability win.
- **Ancillary on/off:** adds unconnected strips at hull bottoms; widens/heightens the scene; does not touch TFD column/cluster counts.

---

## 3. Literature synthesis

The pipeline is, in the literature's exact terms, a **globally-layered compound graph** (Forster §2; Sander). The corpus maps cleanly onto its phases.

| Thread | Source(s) | Maps to | Takeaway for the pipeline |
| --- | --- | --- | --- |
| Column / rank assignment | **Gansner et al., TSE93** (network simplex); **Rüegg, KCSS 2018** (size-aware MinWidth/StretchWidth, PromoteNodes) | `computeDepths`; pull-left | Replace unit longest-path with weighted `min Σ ω(e)(d(t)−d(s))` s.t. `d(t)−d(s) ≥ δ`. `ω`/`δ` are semantic dials (tighten the org spine, align fan-out). `balance()` moves slack nodes to the _least-crowded_ column — a better objective than pull-left's "leftmost." Size-aware: layer on real pixel heights, not units. |
| Crossing reduction in compound graphs | **Sander 1996**; **Forster GD2002** (_Crossings in Clustered Level Graphs_) | (missing) lane order; `packSiblings` | R1 (cluster members contiguous on a layer) + R2 (clusters keep relative order across layers) are **the conditions under which hulls are drawable rectangles**. Forster Lemmas 1–2: every crossing is owned by a unique hierarchy node and crossings are independent → minimize **locally per topology node** (barycenter of cross-column neighbors), sum to global. **T1, T2, T4 are one problem.** |
| Coordinate assignment / straightening | **Brandes & Köpf, GD2001**; **Rüegg et al. 2015** (_Size- and Port-Aware_) | (missing) Y coordinate | BK aligns each node to its **median** neighbor → blocks drawn straight. For you the cross-axis is **Y**, and it's **constrained** (a cluster can't leave its band). Port/size-aware: align on the **binding point**, use **local δ**, make balancing optional (pick narrowest of 4). |
| Constrained unification | **Dwyer, Marriott, Stuckey** (VPSC / _Fast Node Overlap Removal_); **Dwyer, Koren, Marriott** (IPSep-CoLa, TVCG 2006); **Dwyer, Marriott, Wybrow** (_Topology-Preserving Constrained Layout_, GD2008) | Phases 3 + 4 together | Whole vertical axis = one **QPSC**: `min Σ wᵢ(yᵢ−desᵢ)²` s.t. separation constraints. Bands = hard separations; hull drawability = cluster-containment constraints (Sander's legal-rank, reborn on Y); straightening = `desᵢ`; mental-map = one-sided `(z)+` penalty so cross-band arrows don't distort. **Use the deterministic VPSC projection once on Y** — not the full iterative force loop (your pipeline must be deterministic/single-pass). |
| Region packing / ancillary | **Domrös, _Model Order_ KCSS 2025** (rectpacking); polyomino packing; treemap | `buildAncillaryStrips`; packed grid | Your packed grid + strips _are_ the "region packing problem": order-preserving, reading-direction, whitespace-elimination. ELK ships it; declaration order = your `firstSequence`. |
| Salience | Pupyrev (edge bundling); Edge-Path Bundling; Interactive LOD; mental-map empirical | `terraformRelationshipFocus.ts` | Multi-hop focus + degree-of-interest falloff; weight aggregated connectors. |

---

## 4. Findings (audit checklist, with evidence)

### TFD / dataflow hierarchy

- **Does the org→OU→account spine read before the fan-out?** Partially. The spine exists in columns (depths from `computeDepths`) but is not visually distinguishable — its arrows are not straightened or weighted, so it's lost among 145 mostly-diagonal arrows. **No ω weighting** to make the spine a crisp ladder.
- **Are deep-hop resources discoverable without tracing?** No. Median arrow ΔY is 350–1 220 px; only 12–17 % near-straight. Lake/Kinesis/EKS/regional/audit chains read as diagonals.
- **Does pull-left create salience confusion?** It improves straightness (median 1 221 → 353) but is purely geometric (leftmost-feasible, never-grow-bounds); it has no notion of "semantically earliest," so a node can still sit in a column that reads earlier/later than its role.
- **Do fan-out targets share a column appropriately?** Inconsistently — packing can scatter same-source fan-out across columns; no within-column ordering keeps branches grouped.

### Topology hierarchy

- **Are the four accounts visually separable?** In stacked, yes (bands pure). In packed, mostly — but **1 account pair and 6–7 region pairs share vertical bands**, eroding "which account am I in." No role-aware forced banding (`REGION_SUBNET_VERTICAL_BANDS_PLAN.md` unimplemented).
- **Do hull frames align with clusters / create false boundaries?** Hulls are exact bboxes (0 rectangle collisions), so no _false_ boundaries — but band-sharing means a region hull can span a tall Y-range with a sibling region nested in its vertical extent, which reads as ambiguous ownership even without rect overlap.
- **Full-mode satellites — reinforce or clutter?** Clutter, on this metric: Full raises elements 1 333 → 7 994 and worsens dataflow straightness; the dataflow story degrades as satellite richness rises.

### Ancillary / all-resources

- Strips land at hull bottoms, provably disjoint from cluster frames (existing lane-debug assertion). They add height/width and dilute arrow salience by adding unconnected cards. Grouping is by topology scope only (no type/module/tag sub-grouping).

### Coherence at interaction time

- **Compound drag:** works (LCA parenting + 21 sibling connectors).
- **Hover focus:** single-hop only (`getTerraformRelationshipFocus` lights edges _incident_ to the hovered node + direct neighbors). The multi-hop org→account→trunk→API→datastore path the mission names is **not** surfaced.
- **Expand (compact):** grows in place, can overlap siblings (known, accepted).

---

## 5. Recommendations (prioritized, tagged)

Priority follows the stated focus: **dataflow readability (T3/T4)** first. Every item preserves the hard invariants (TFD required; `d(A)<d(B)` for `A→B`; truthful topology; compound arrows parented to LCA; determinism). All are opt-in toggles (default-off), per project convention.

### R1 — Add a nesting-aware **ordering phase** `[layout]` — _highest impact, fixes T1+T2+T4-order together_

Insert a phase between layering and coordinates that orders the **children at each topology node** (root→provider→account→region→…→lane) by the **barycenter of their cross-column TFD neighbors**, with **`firstSequence` (model order) as the deterministic tiebreak** (Forster Lemmas 1–2; Sander `O(G)`). Replace the weak orderings at `terraformPipelineLayoutShared.ts:673` (lexicographic `laneKey`) and `terraformPipelineLayoutPacked.ts:391` (`minDepth`-first). This enforces R1 (contiguity) + R2 (consistent order) → eliminates band-share (target: region/ account band-share → 0) **and** reduces crossings, in one mechanism.

- _Risk:_ must remain deterministic (barycenter only when it strictly reduces a measured crossing count, else model order). Height may rise (accept, per the bands plan).

### R2 — **Separate ordering from coordinates**, then a constrained **Y coordinate pass** `[layout]` — _core T4-straightening_

Today `packSiblings` decides relative order _and_ absolute Y in one skyline pass. Split into: (a) R1's order, then (b) a **single deterministic 1-D VPSC projection on Y** — `min Σ wᵢ(yᵢ−desᵢ)²` subject to band-separation + cluster-containment + non-overlap constraints, where `desᵢ` = the Y that straightens cluster i's TFD arrow (weight the spine heavier). One-sided penalty so cross-band arrows stay diagonal without distorting the rest. (Brandes–Köpf target + Dwyer/Marriott VPSC.) Targets: median ΔY 350 → <100 px; near-straight 17 % → >50 %.

- _Risk:_ deepest change; X stays the fixed TFD grid (1-D problem only — avoids the slow 2-D iteration). Use the exact active-set VPSC (deterministic), not the iterative stress loop. Diagonal scaling is a later perf lever, not needed at v2 scale.

### R3 — **Semantic column assignment** `[layout]`

Replace unit longest-path `computeDepths` with **weighted network simplex** (`ω` tightens the org spine + aligns fan-out; `δ` forces specific gaps) plus **`balance()`** (slack nodes → least-crowded column) and **size-aware** layering (real pixel heights). (Gansner TSE93; Rüegg KCSS 2018.) Caveat (Rüegg §3.1.3): tune toward _semantic priority_, not minimum size.

- _Risk:_ touches the column math all variants read; keep the verify-or-abort `d(A)<d(B)` guard; toggle-gated.

### R4 — **Multi-hop / degree-of-interest hover focus** `[runtime]` — _cheap, high-value_

Extend `getTerraformRelationshipFocus` from single-hop to a **bounded BFS over declared edges** with hop-distance falloff; optionally highlight a full path on click. Lowest risk, no invariant impact.

### R5 — **Weighted sibling-frame connectors** `[layout]` — _small salience win_

`appendCompoundTopologyFrameEdgeSkeletons` dedupes to smallest sequence; carry an edge **count/weight** → stroke width, so heavy account→account relationships read as heavier. Metadata + stroke function only.

### R6 — **Reconsider canonical defaults for readability** `[preset]/[docs]`

The metrics show Full + ancillary _hurt_ dataflow legibility. Recommend **compact + packed + pull-left** as the readability-optimal pipeline default, with Full/ancillary positioned as drill-down modes, not the headline view.

---

## 6. Open questions

1. **Dummy nodes for multi-column edges?** BK's straightening of column-skipping edges (e.g. `regional_dynamo_global → regional_aurora_east_2`) needs dummy-node chains (Sander Phase 2), which the pipeline omits. Worth the element-count cost? (Decides how far R2 can straighten.)
2. **Crossing metric fidelity.** Current count is a chord proxy; elbow routing may differ. Need a polyline-aware count before trusting absolute targets.
3. **Forced bands vs. height budget.** R1 will raise height; is there an acceptable ceiling, or is band purity unconditionally preferred (per the plan)?
4. **`ω`/`δ` authoring.** Should edge weights be inferred (spine = org/account binds) or authored in `.tfd`? Affects whether R3 is `[layout]` or also `[tfd]`.
5. **Ancillary grouping.** Group unconnected resources by type/module/tag inside the strip (region-packing with order) vs. topology scope only?

---

## Appendix — phased reference architecture

```
LAYERING      computeDepths → weighted network simplex + balance() + size-aware   [Gansner; Rüegg]   T3
   ↓          (honest tight columns; slack to least-crowded column)
ORDERING      per-topology-node child ordering: barycenter, model-order tiebreak   [Sander O(G); Forster]  T1/T2/T4-order
   ↓          (R1 contiguity + R2 consistent order ⇒ hulls drawable; fewer crossings)
COORDINATE    single 1-D VPSC projection on Y:                                     [Brandes–Köpf; Dwyer/Marriott]  T4-straighten
              min Σ wᵢ(yᵢ−desᵢ)²  s.t. bands + containment + non-overlap
              (straighten spine; bands & hulls guaranteed; deterministic, single pass)
SALIENCE      multi-hop DOI hover focus + weighted connectors                      [bundling/DOI]  T5
```

X stays the fixed global TFD grid throughout — the founding principle is untouched; only the Y axis becomes principled instead of incidental.

---

## Implementation status

All behavior is gated behind the opt-in **`pipelineSemanticPlacement`** toggle (UI: Pipeline settings → **Placement: Semantic**; demo URL `&semanticPlace=1`; default **off**, so existing imports are byte-identical). Acceptance gate (`terraformPipelineCollisionDiagnostics.ts` + `terraformPipelineSemanticAudit.test.ts`): **zero** collisions, region/account band-share, and TFD edge-order violations.

| Rec | Status | Notes |
| --- | --- | --- |
| **R1** forced bands | **Done** | Role-aware `packSiblings` (`terraformPipelineLayoutPacked.ts`): forced vertical stacks for root→provider→account and VPC→subnet-zone, ordered by model order (`firstSequence`). v2: region band-share **6–7→0**, account **1→0**, collisions **0**. Height grows (compact 7.5k→12.3k px, full 25k→44k px). |
| **R2** straightening | **Done (limited)** | `straightenCompactLanes`: compact lanes shift toward predecessor Y within the parent band, never overlapping. On v2 the effect is near-zero — forced bands leave no intra-band slack and cross-band edges must stay diagonal. Benefits denser intra-region scenes. |
| **R3** column balance | **Implemented, NOT enabled** | `computeBalanceShifts` (Gansner `balance()`) reduces column congestion/height but **increases crossings** on v2, so it is not wired into the toggle. Kept as a tested height-vs-crossings knob. |
| **R4** multi-hop focus | **Done** | `terraformRelationshipFocus.ts`: bounded BFS (`TERRAFORM_FOCUS_MAX_HOPS = 3`) with degree-of-interest dimming. Reveal stays 1-hop (keeps the collapsed overview stable); deeper hops dim via falloff. |
| **R5** weighted connectors | **Done** | Aggregated sibling-frame connectors carry an edge `weight`; stroke width scales with it. |
| **R6** docs | **Done** | This section + the pipeline import guide. |

### Key finding (the tension)

R1 (your hard "no overlaps / no broken hierarchies" requirement) and R2/R3 (dataflow straightening / compaction) are **fundamentally in tension** — exactly the separation-constraints-vs-objective tradeoff the VPSC literature describes. Forced distinct bands pin every region/account to its own Y range, so on a sparse, single-cluster-per-region preset like v2 there is little to straighten, and cross-band edges correctly stay diagonal. The hierarchy constraint wins by design; dataflow-readability gains from R2/R3 are real only in denser intra-region cases.

### Recommended config

For readability, prefer **compact + packed + pull-left + semantic placement** (distinct bands, bounded height ~12.3k px). **Full + ancillary + semantic** is correct but very tall (~44k px); treat it as a drill-down mode. Capping Full-mode height without reintroducing overlaps is a documented follow-up.

### Open follow-ups

- Cap Full-mode semantic height (e.g. column-balance only where it does not raise crossings, or a height budget that preserves bands).
- Polyline-aware crossing count (current metric uses straight chords).
- `.tfd`-authored edge weights for R3/connector weighting.
