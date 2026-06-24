# RCLL import pipeline — architecture assessment & validation report

**Date:** 2026-06-23 **Scope:** chief-architect assessment of the RCLL (Recursive Compound Layered Layout) Terraform import pipeline — are the data structures/algorithms sound, and is the _approach to each problem_ correct, evaluated across every way the pipeline can be configured. Companion document: [`rcll-layout-engine-spec.md`](./rcll-layout-engine-spec.md) (the forward-looking decision spec). This file is the **research-backed findings record**; every load-bearing claim is tagged with a code `file:line` or a literature source.

---

## 0. Canonical evaluation lens (pinned to real flag values)

The daily-driver view is **all-resources + compact + no-debanding + everything-on** (the heaviest configuration). **This is not a named preset** — verified against `terraformPipelineLayoutProfiles.ts:144–178`:

| Flag | `compact` profile | Canonical "everything-on" lens |
| --- | --- | --- |
| `swimlaneLaneRise` (M4) | `true` | `true` |
| `rankSeparate` (M8r) | `true` | `true` |
| `crossingMin` (M6c) | **`false`** | **`true` (individual override)** |
| `deBandLevel` | **`"subnet"`** | **`"none"` (individual override)** |
| `straighten` (M5) | `true` | `true` |
| `columnPacking` | `compact` | `compact` |
| `reorder` / `staircaseBandOverlap` | `true` / `true` | `true` / `true` |

So the canonical lens = **`compact`-profile flags + `crossingMin` forced ON + `deBandLevel` forced NONE.** Individual options override the profile (`terraformLayoutCore.ts:958,990`; URL params expose each flag). **Consequence:** `crossingMin`'s "−28 % crossings" is **opt-in** — it is OFF in every named profile, so it helps the canonical view only because the operator manually enables it, not because a preset does.

---

## 1. Methodology

Four independent evidence sources, cross-checked:

1. **As-built code** — read M1/M2/M3 stages, every optional pass, the toggle guards, the profiles, and the v2 hull-first engine; grepped for the presence/absence of named mechanisms; counted lines; traced wiring.
2. **Design-doc decision log** — `pipeline-rcll-layout-design.md` (2,036-line RFC), the `DI-*` reversals, the measured per-lever effects.
3. **Git history** — commit dates to date-stamp claims and catch staleness.
4. **Literature** — the local graph-drawing corpus (`graph-layout-rag`), queried stage-by-stage against the canonical compound-layered references.

Claims below carry one of: ✅ **confirmed** (ground-truth checked), ⚠️ **corrected** (the inherited claim was wrong/imprecise), or 🔬 **unmeasured** (a hypothesis, flagged as such).

---

## 2. Findings

### 2.1 Performance / scalability — solved at the layout layer ✅

The only real algorithmic defect was O(N²) prep (`resolveTerraformPlanNodeKey` doing 5 full `Object.keys`+regex scans per call, ~12k calls). **Fixed** (`140f85aac` + `nodesByType` index): the two dominant prep spans went ~7,900 ms → ~184 ms; placement itself is ~312 ms. Every core stage is near-linear; the only superlinear spots are the **opt-in, eval-budget-bounded** measure passes (`columnCompact` ≤256 trials, `crossingMin` ≤16) and v2 skyline pack (O(n²·d)) — none a scaling risk at these sizes.

🔬 **The remaining felt cost (~49 s of 57–60 s browser wall-clock) is _unattributed_.** The RCA (`terraform-pipeline-rcll-v2-allresources-rca.md`, Finding 4) isolated layout compute to ~0.5 s post-fix and explicitly did **not** attribute the rest — the _leading hypothesis_ is upstream parse/merge + downstream DOM/canvas materialization of ~3,886 elements, **not established**. This is the single most important open measurement; it governs whether "scalability" work belongs in layout at all (it likely does not).

### 2.2 The core primitive has converged; the host model is the open question ✅

- **Global leaf/depth ranking with hulls derived bottom-up is the correct primitive** (Sander 1996) and **is already in RCLL**: `computeGlobalSeparatedFloor` (`terraformPipelineRcllRankSeparate.ts:194`), wired into placement at `terraformPipelineRcllPlacement.ts:1705`, produced −42 % height / 0 backward edges on the canonical view. The earlier pivot memo's premise ("RCLL ranks each hull in an independent frame → backward edges") describes a _superseded_ round-3 state and is **stale**.
- **The genuinely questionable choice is the _host model_, not the primitive.** RCLL is **per-container-recursion-first** with global rank bolted on as one opt-in lever (`sizeAndArrange` post-order walk + per-role policy dispatch). v2 is **global-first by construction**. On the canonical view a single **cyclic provider** (the `0002⇄0003` bidirectional account pair) collapses every interior onto one `denseRank` axis, so the per-container levers have no room to act.

### 2.3 The maintainability debt is the toggle/config surface, not the algorithm ✅

`RcllOptions` has **12** fields (`terraformPipelineRcllTypes.ts`), **8** of which are optional layout passes. There are **4 toggle guards** (`terraformPipelineToggleGuards.ts`): R1 `rankSeparate-needs-rise` (:75), R2 `column-packing-conflict-compact-wins` (:83), R3 `ordering-conflict-crossing-min-wins` (:92), and a silent R4 (`deDensifyMaxCols` default dial, no suppression code). The core recursive placement is clean; the debt is the levers around it, several of which are measured-dead on the canonical view (see scorecard §4).

### 2.4 v2 is the cleaner embodiment but NOT at parity — and its "correctness" is a tradeoff ✅⚠️

v2 is 9× smaller and produces 0 backward edges without a gate. **But:**

- **It is empty of cyclic / crossing-min / rankSeparate handling** (`grep terraformPipelineV2*.ts` → 0 hits ✅).
- Its ancillary is a thin pseudo-cluster wrap (`terraformPipelineV2Pack.ts:422–443`) vs RCLL's 1,014-line recursive slack allocator (`terraformPipelineRcllAncillaryAllocator.ts`, line count ✅).
- ⚠️ **"0 backward edges by construction" is a _sidestep_, not a better solution.** v2 columns on **static topology depth** (provider→account→region), **not on dataflow edges** (`terraformPipelineV2Pack.ts:11,26`). It never ranks the cyclic provider because it never attempts the dataflow-rank RCLL attempts. Whether that is "better" depends on whether you want dataflow-direction encoded in X (RCLL) or topology-nesting in X (v2). Any bake-off must compare **what each axis encodes**, not just crossings.
- v2 _does_ run on the canonical fixture (`terraformPipelineLayoutV2.test.ts:143`).

### 2.5 Literature verdict — the recursion host is the documented anti-pattern ✅

The canon (Sander 1996, Forster 2002, ELK Layered, Brandes–Köpf, Jünger–Mutzel–Spisla) converges on **one** shape, and it is not RCLL's host:

- **Sander §4:** _"a compound graph is **not** recursively defined …"_ — he says this _because real edges cross nesting levels_ (exactly the cross-account `0002⇄0003` edges). His comparison section: _"Other layout methods are restricted to recursive layout where subgraphs are treated as large nodes. Edges pointing beyond the border of subgraphs are ignored during the crossing reduction. Thus they are not routed optimally."_ — this sentence _is_ RCLL's per-container barycenter no-op (M6, measured −3 crossings).
- **Forster §4.1:** crossing reduction on **base nodes globally**, keeping clusters contiguous — what M6 fails to do per-container.
- **What RCLL got right:** choosing the deterministic **layered/Sugiyama family** over force-directed / constraint solvers (IPSep-CoLa, VPSC, stress majorization) for single-pass, no-UI-at-import determinism (CON-8/9). The literature treats those solvers as non-deterministic/iterative — declining them was correct.

**Net:** the target is the standard compound-layered (ELK-style) pipeline. v2 is ~30 % of it (estimate); RCLL is ~90 % of it (estimate) wearing a per-container exoskeleton.

### 2.6 Per-stage literature audit — every placement swap is host-capped ✅

Queried the corpus stage-by-stage. The dominant pattern: a better algorithm _inside_ a per-container stage has no room to act on the cyclic-collapsed canonical view (the M5/M6 no-ops). These are not independent wins — they all collapse into the same global-frame rebuild. The audit mostly **confirms research already cited in the RFC** ([R10] Brandes–Köpf, [R11] Jünger–Mutzel–Spisla flow, [R12] size-aware, Onoue 2016 edge concentration, confluent drawings); genuinely net-new finds are narrow: **cyclic recurrent hierarchies (Bachmaier 2012), sifting, and min-width layering (Nikolov-Tarassov-Branke)**. Full per-stage table is in the [spec, §3](./rcll-layout-engine-spec.md).

---

## 3. Ground-truth validation (the "doubly-sure before a rewrite" pass)

Every load-bearing claim re-derived from code/git, not inherited summaries.

### Confirmed ✅

| # | Claim | Evidence |
| --- | --- | --- |
| C1 | global ranker exists + is wired | def `terraformPipelineRcllRankSeparate.ts:194`; call `…Placement.ts:1705` |
| C2 | v2 has no cyclic / crossing-min / rankSeparate / SCC | `grep terraformPipelineV2*.ts` → 0 hits |
| C3 | RCLL ancillary (1,014 ln) ≫ v2 ancillary (thin wrap) | `wc -l` = 1014; v2 = `…V2Pack.ts:422–443` |
| C4 | all-to-all leaf precedence is real (in code, not just docstring) | nested cross-product loop `…RankSeparate.ts:242–248` |
| C5 | 4 guards (R1–R3 named, R4 silent); 12 `RcllOptions` fields | `terraformPipelineToggleGuards.ts:75,83,92`; `…RcllTypes.ts` |

### Corrections ⚠️

- **X1 — readability is coordinate-assignment/density, not routing** (and the supporting audit is cross-engine — see X4). `pipeline-semantic-placement-audit.md:21`: _"a cluster's Y comes from lane stacking order, so ~85 % of arrows run diagonally. There is no crossing-reduction phase and no coordinate-assignment/straightening phase."_ The diagonals are **boxes at illegible Y**, and **85 % of edges are adjacent-column (short)** — not a routing problem. An edge-routing/bundling pass would redraw the same diagonals neatly over mis-placed boxes. (A previously-proposed "edge routing lane" was withdrawn on this basis.)
- **X2 — `swimlaneLaneRise` (M4) is load-bearing, not "−2 % marginal."** Guard **R1** (`…ToggleGuards.ts:75`) _suppresses `rankSeparate` entirely when M4 is off_, and the decision log (2026-06-20) states `rankSeparate` **solo** is "+28 % width / +45 % crossings — the −42 % win is only composed with M4." Any "no-op table" must state each row's measurement baseline or it misleads.
- **X3 — "border/dummy nodes kill the +28 % width" is conditional, not free.** The +28 % width is the _intentional_ cost of all-to-all precedence (C4), which forces disjoint column ranges so M4's lane rise can trade width back for height (net −42 %). Sander border/dummy nodes impose precedence only on **real** edges → they cut width **and dissolve the disjoint-range property M4 depends on**. The −42 % win must be **re-derived** under border-node semantics; this is the highest-blast-radius change in any rebuild.
- **X4 — the readability numbers ("~140 crossings / 12–17 % straight") are STALE _and cross-engine_; RCLL legibility is UNMEASURED.** (a) Committed 2026-06-14 (`610acd66b`); `straighten` shipped 2026-06-18 (`b91a4d77a`) and `crossingMin` (−28 %) shipped 2026-06-21 (`83821086a`) — both **after**. (b) The instrument `terraformPipelineSemanticAudit.test.ts` only has `compound` and `semantic` arms — **no `rcll` arm** — so the numbers describe a _different engine_. RCLL's own crossings come from `countPlacedCrossings`, whose tests use synthetic a/b/c/d fixtures. **"Is RCLL everything-on actually illegible?" is currently unknown.**
- **X5 — the per-stage audit mostly re-derives the RFC** (§2.6); it does not open new ground, and every placement-stage swap remains host-capped.

---

## 4. Adversarial self-audit (attacking the validation itself)

A pass that shit-tests the validation and every assumption under it.

- **SA-1 (keystone — the lens was never pinned; now it is).** The canonical "everything-on" view was _asserted_, never read. Ground truth (§0): `crossingMin` is OFF in all three profiles; `compact` forces `deBandLevel:"subnet"` (contradicts "no-deband"). The lens is realizable only via individual overrides. The analysis survives, but "crossingMin is load-bearing on the canonical view" is true _only because the operator enables it_.
- **SA-2 (a self-doubt that failed — the claim got stronger).** C4 was first "confirmed" from a docstring; re-checked against the emitting code (`…RankSeparate.ts:242–248`) it is a genuine `for a∈leaves(A) / for b∈leaves(B)` cross-product. The O(Σleaves²) premise is code-verified.
- **SA-3 (an internal inconsistency — fixed).** X1 used the compound/semantic audit to "refute" routing while X4 declared that same audit cross-engine-invalid for RCLL. Downgraded X1 from "refuted" to **"unjustified pending measurement"**: routing is the wrong lever _if_ RCLL has the diagonal-Y problem, and that existence is unmeasured.
- **SA-4 (a one-sided claim — corrected).** v2's "correct-by-construction" is a _tradeoff_ (topology-depth columns sidestep dataflow ranking), not a strict win — see §2.4.
- **SA-5 (facts that are actually hypotheses).** Flagged for honesty: "the felt cost is DOM" is unattributed (leading hypothesis, → measurement); "v2 ~30 %" and "B ~3–6 weeks" are estimates; "patch = category error" softened to **"very high cost / inverts the control structure"** since `rankSeparate` already threads a global pass _into_ the recursion (`:1705`) — proof a global spine _can_ coexist, so the objection is cost, not impossibility.

**Did the self-audit flip any conclusion? No.** The two most solid claims (C1 global-rank primitive; the Sander §4 host verdict) held under attack. The least solid — DOM hypothesis, RCLL readability existence, v2's encode-tradeoff, the cost/size estimates — are all **unmeasured**, which is exactly why the next steps (in the spec) are measurements, not a rewrite.

---

## 5. Scorecard — "is my approach to each problem correct?"

| Problem | Current approach | Verdict |
| --- | --- | --- |
| Algorithm _family_ | layered/Sugiyama, deterministic, single-pass | ✅ correct (over force-directed/constraint solvers, CON-8/9) |
| Rank ordering (the spine) | global leaf ranking (M8r) | ✅ correct (Sander), shipped (C1) |
| Perf / scalability | index + memoize + measure-first | ✅ exemplary; defect fixed |
| "All resources" packing | recursive slack allocator | ✅ sophisticated & load-bearing — keep regardless of host |
| **Host model** | per-container recursion, global rank bolted on | ❌ Sander §4 anti-pattern — root cause of the no-op levers + toggle sprawl |
| Inter-cluster / long edges | all-to-all leaf precedence (C4) | ❌ canon uses border/dummy nodes (O(E)); but the swap is conditional (X3) |
| Crossing reduction | per-container barycenter (M6) | ❌ canon (Forster) reduces on base nodes globally; M6 no-op |
| Cyclic provider | per-container SCC swimlane/staircase | △ correct, but only _needed because_ the host is per-container-first |
| Config / levers | one toggle per phase, dead ones retained | ❌ symptom of the host mismatch — prune to load-bearing |

---

## 6. Open / unmeasured questions (gate any rewrite)

| # | Question | Resolves | Cost |
| --- | --- | --- | --- |
| Q1 | Where does the browser ~49 s actually go? (parse/merge vs materialize vs react vs paint) | whether "scalable import" is a layout problem at all | small (instrument apply path + browser trace) |
| Q2 | Is RCLL everything-on _actually_ illegible? (true crossings / straight % with `crossingMin` ON) | whether any readability work is warranted | small (add `rcll` arm to the audit test) |
| Q3 | On the canonical view, does v2 beat RCLL on bounds/aspect/crossings, and how bad is its crude ancillary? | sizes any rebuild; validates global-first empirically | medium (bake-off) |

All three are **measurement-only**. The architectural decision (stay vs rebuild) is deliberately gated on them — see the [spec](./rcll-layout-engine-spec.md).

---

## References

- **Sander 1996**, _Layout of Compound Directed Graphs_ — §4 (not recursive), §5 (dummy nodes), comparison section. The canonical source.
- **Forster 2002**, _Applying Crossing Reduction Strategies to Layered Compound Graphs_ — §4.1 base-node-global reduction.
- **ELK Layered** — the phase pipeline as practiced.
- **Brandes–Köpf** [R10] + **Jünger–Mutzel–Spisla flow** [R11] — coordinate assignment (prescribed width = our prescribed height).
- **Bachmaier et al. 2012**, _Drawing Recurrent Hierarchies_ — cyclic level drawing.
- **Nikolov-Tarassov-Branke 2005**, _Minimum-width graph layering with dummy nodes_.
- **Dwyer/IPSep-CoLa/VPSC** — the constraint-solver family correctly declined (determinism).
- Internal: `pipeline-rcll-layout-design.md`, `terraform-pipeline-rcll-v2-allresources-rca.md`, `pipeline-semantic-placement-audit.md`.
