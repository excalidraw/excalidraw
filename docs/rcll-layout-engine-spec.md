# RCLL layout engine — decision spec: stay (A) vs rebuild non-recursive (B)

**Date:** 2026-06-23 **Status:** decision document, not a commitment to build. Companion: [`rcll-architecture-assessment-report.md`](./rcll-architecture-assessment-report.md) (the findings + validation behind this spec). Every claim here is either ground-truth-checked in the report or explicitly flagged as an owed measurement.

This spec captures the **full decision-making context** for the layout engine's future: the options, the sources, the algorithms, the tradeoffs, the pros/cons, the alternatives, and the measurements that must precede any commitment.

---

## 1. What is decided vs. open

|  | State |
| --- | --- |
| **Decided** | (1) The perf defect is fixed; layout is not the felt-cost bottleneck. (2) The global-rank primitive is correct (Sander) and already shipped (`computeGlobalSeparatedFloor`, `…RcllPlacement.ts:1705`). (3) The recursion _host_ is the Sander §4 anti-pattern. (4) "Patch RCLL into non-recursive via incremental swaps" is the wrong path (worst-of-both — see §5). (5) A post-placement edge-routing/bundling lane is **not** the readability fix (the problem is coordinate-assignment/density). |
| **Open — gated on data** | The **A vs B** host decision, gated on Q1 (DOM attribution) + Q2 (RCLL readability) + Q3 (v2-vs-RCLL bake-off). See the report §6. |

**Recommendation: A now, B as a characterized-for-later spec (this document).** There is no driving metric for B today — the engine passes its gates and the felt cost lives in the DOM ceiling (hypothesis, Q1). Do the cheap measurements first; choose B deliberately **when** a metric demands it, at which point this spec is the build, not a research project.

---

## 2. The two real options (full context)

"Patch RCLL to non-recursive" is **not** a third option — see §5.

|  | **A — Stay on RCLL** | **B — Build the non-recursive ELK-Layered engine (grow v2)** |
| --- | --- | --- |
| **Premise** | engine passes its gates; layout is "done enough" | layout will keep being extended (readability, routing, ports, presets) |
| **Near-term work** | none on layout; spend on the DOM ceiling (Q1) + config hygiene | promote v2 → ELK-Layered parity; port RCLL's hardened pieces |
| **Risk** | none (no layout change) | medium — but a **known architecture** (ELK is the reference impl) |
| **Cost** | ~0 (layout) | ~3–6 weeks _(estimate, not measured)_, behind the existing `pipelineLayoutVariant` flag |
| **Reuses** | all of RCLL as-is | v2 seed (~30 %, estimate) + RCLL ancillary allocator (1,014 ln ✅) + gate battery + export |
| **Throws away** | — | RCLL's per-container recursion + ~12 toggles (the part Sander §4 condemns) |
| **Pros** | zero risk; preserves the hardened ancillary + gates; no churn | correct-by-construction; deletes the toggle sprawl; one global frame; matches the canon |
| **Cons** | keeps the recursion exoskeleton + dead levers; readability stays host-capped | real engineering cost; phase 3 (border/dummy) is high blast radius (X3); determinism must be re-proven per phase |
| **Literature fit** | — | exactly the documented pipeline; recursion explicitly avoided (Sander §4) |

### 2.1 Sources behind the host verdict (re-verified in `graph-layout-rag`)

- **Sander 1996** — §4 "a compound graph is **not** recursively defined"; §5 dummy nodes; comparison section names recursive-per-subgraph as the inferior method. Load-bearing, in-corpus, top-hit.
- **Forster 2002** — §4.1 base-node-global crossing reduction respecting hierarchy.
- **ELK Layered** — the 5-phase pipeline + intermediate-processor slots = the build target.
- **Brandes–Köpf** [R10] + **Jünger–Mutzel–Spisla flow** [R11] — coordinate assignment.
- **Declined (correctly):** Dwyer/IPSep-CoLa/VPSC constraint solvers — non-deterministic/iterative; violate CON-8/9.

---

## 3. B build-spec — per phase (algorithm · source · alternatives · tradeoff)

Grow v2 (already global-columns + skyline-pack + derived hulls, ~30 % of target) into ELK-Layered. Each phase runs **once, globally** — no recursion. Behind the flag, gated.

```
import → [P1 cycle] → [P2 layer-assign base nodes, ONE frame]
       → [P3 insert BORDER nodes (R_min/R_max per cluster) + DUMMY nodes (long edges)]
       → [P4 compound crossing reduction on BASE nodes, hierarchy-contiguous]
       → [P5 coordinate assignment w/ cluster constraints + prescribed height]
       → [P6 route edges] → derive cluster rects from placed base nodes → export
```

| Phase | Recommended algorithm | Source | Alternatives considered | Tradeoff / pros / cons |
| --- | --- | --- | --- | --- |
| **P1 Cycle handling** | back-edge reversal (greedy FAS) **or** cyclic level drawing | Eades-Lin-Smyth; Berger-Shor O(V+E); **Bachmaier 2012** (cyclic ⇒ removal _vacuous_) | RCLL's per-container swimlane/staircase (bespoke special-case) | cyclic-level is the textbook answer to `0002⇄0003` (shorter edges, fewer crossings) but a different drawing paradigm; FAS is simpler and keeps the standard frame. **Replaces** the swimlane hack. |
| **P2 Layer assignment** | keep v2 longest-path; optional **min-width** | longest-path (simple, fast); **Nikolov-Tarassov-Branke** (NP-hard; fast node-size-aware heuristics); network-simplex (Gansner/dot); Coffman-Graham | min-width vs longest-path vs network-simplex | longest-path front-loads wide top layers; min-width fixes aspect if Q2 shows a width problem; network-simplex balances but is heavier. **Pro** of staying longest-path: v2 already has it. |
| **P3 Border + dummy nodes** | nesting-graph border nodes (R_min/R_max) + dummy nodes for long/hierarchy-crossing edges | **Sander §4/§5** | **all-to-all leaf precedence (RCLL's rankSeparate ✅)** | **[X3 — the conditional swap]** border nodes impose precedence on _real_ edges only → O(E) not O(Σleaves²), cutting the +28 % width — **but** they dissolve the disjoint-column-range property M4's −42 % win is built on. **Con:** the win must be **re-derived**; highest blast radius (touches layering, crossing reduction, coordinate assignment, the band/swimlane/ancillary machinery, and the CON-12 gate). Own milestone, full gate battery. |
| **P4 Crossing reduction** | base-node global, hierarchy-contiguous; **sifting** for quality | **Forster §4.1**; sifting / global-k-level (both beat barycenter); median | RCLL per-container barycenter (M6, the documented no-op) | the single biggest v2 gap (v2 = model order only). **Pro:** fixes the cross-cluster crossings RCLL can't. **Con:** can be costlier than per-container — carry an eval budget (M6c-style). |
| **P5 Coordinate assignment** | Brandes–Köpf; **flow w/ prescribed height** for aspect; **size-aware** | [R10]/[R11]; **Rüegg/Schulze** (node-size-aware — RCLL boxes are heterogeneous) | RCLL M5 straighten (built, density-capped no-op ✅) | this + a de-density pass is the **real readability lever** (X1), effective **only** at a global frame with Y-room. **Pro:** principled width control at the source (kills the +28 % cause). |
| **P6 Edge routing** | orthogonal/polyline post-pass; bundling/confluent for fan-outs | Raykov; edge bundling; Onoue 2016 edge concentration; confluent layered | RCLL's existing in-placement arrow routing (`…Placement.ts:12` — routing **exists**, just simple) | **NOT the readability fix (X1)** — cosmetic over correctly-placed boxes. **Lowest priority.** |

### 3.1 Where readability actually lives (and why it folds into B)

The de-densify + coordinate-assignment work (the genuine legibility lever) is **host-capped**: in RCLL the cyclic provider collapses interiors onto one dense-rank axis, so fan-out-pinning relax is a measured v2 no-op and the straightener is density-starved (`b91a4d77a` shipped it; it measured a no-op). It becomes effective **only** when coordinate assignment runs once over a global frame with Y-room — i.e. **inside B (P5 + a de-density pass)**. It is a B deliverable, not a standalone host-independent lane. _(Gated on Q2: if RCLL everything-on is already legible with `crossingMin` on, this work is unnecessary.)_

---

## 4. What ports from RCLL into B · risks · gates

**Ports verbatim (the hardened pieces — keep regardless of host):**

- the 1,014-line ancillary slack allocator (no canon replacement);
- the CON-12 iron-rule / backward-edge / collision / determinism gate battery;
- `diagnosePipelineScene` + `countPlacedCrossings`;
- the export / frame-parenting;
- `computeGlobalSeparatedFloor` — becomes the **spine**, not a lever.

**Hard precheck before B is even comparable** (else "v2 not viable on this config"): v2 must produce a valid, collision-free, non-degraded scene on **all-resources + the cyclic provider**. If it cannot, B's seed needs P1 cycle handling before anything else.

**Risks:**

1. P3 border/dummy nodes cascade through the band/swimlane/ancillary machinery (X3) — highest blast radius, own milestone, full gate battery.
2. Determinism must hold across all new phases (sifting, FAS, flow) — each needs a stable tiebreak like the existing ones.
3. The ancillary allocator assumes real leaf boxes — it must learn dummy/border vertices.

**Gates (unchanged; all must stay green per phase):** 0 collisions, 0 backward edges, region/account band purity, TFD edge-order, determinism (2× identical run), `.snap` discipline.

---

## 5. Why "patch RCLL into non-recursive" is the wrong path (not a third option)

The recursion **is** the architecture: RCLL's core is `sizeAndArrange`, a post-order per-container walk with per-role policy dispatch (forced / packed / mixed / swimlane / staircase) + per-container Y-banding + ancillary + de-band. A flat global layer-assignment + coordinate-assignment phase **replaces the entire recursion and its five policies** — leaving only RCLL's export + gates + ancillary shell. So "patching" converges to "rewrite while dragging the recursive corpse and its 12 toggles" — worst-of-both. **Caveat (honest):** `rankSeparate` already threads a _global_ pass into the recursion (`:1705`), proving a global spine _can_ coexist — so the objection is **very high cost + control-structure inversion**, not logical impossibility. It remains the option to avoid.

---

## 6. Rejected alternatives (with reasons)

| Alternative | Rejected because |
| --- | --- |
| Rip-and-replace to v2 as-is | v2 is ~30 % of the target; loses the hardened ancillary (1,014 ln) + gates + cyclic/crossing-min (C2/C3). |
| Keep adding RCLL toggles | toggles are symptoms of the host mismatch (Sander §4); ~4 are measured-dead. |
| Patch RCLL incrementally to non-recursive | §5 — control structure inversion; worst-of-both. |
| Standalone edge routing/bundling lane | X1 — readability is coordinate-assignment/density, not routing; routing is cosmetic over mis-placed boxes; the real lever is host-capped → folds into B (P5). |
| Constraint solvers (IPSep-CoLa/VPSC) | non-deterministic/iterative; violate CON-8/9 (single-pass, no-UI-at-import, deterministic). |

---

## 7. The gating measurements (precede any B commitment)

These are **measurement-only** (no engine/layout change) and settle the open questions before any rewrite is justified. Detail in the report §6.

| # | Measurement | Settles | Method |
| --- | --- | --- | --- |
| Q1 | attribute the browser ~49 s | is "scalable import" a layout problem at all? (likely no) | expose `terraformImportProfilerSummary()` on `window` (dev-flag-gated) + apply-path spans; chrome-devtools-mcp trace on the canonical view; 3-run median |
| Q2 | true RCLL everything-on crossings / straight % / median ΔY (with `crossingMin` ON) | is there a readability defect at all? | add an `rcll` arm to `terraformPipelineSemanticAudit.test.ts` |
| Q3 | v2 vs RCLL-everything-on on all-resources (bounds/aspect/crossings/ancillary) | sizes B; validates global-first empirically | engine-agnostic metrics + a hard precheck that v2 produces a valid scene on the cyclic provider |

**Decision rule:** if Q1 shows the ~49 s is DOM/parse (hypothesis), **A is confirmed** and B stays the spec'd-for-later option. If Q2 shows RCLL is already legible, readability work is dropped. If Q3 shows v2's global construction already wins on the canonical view _and_ its ancillary gap is small, B gains an empirical driver. Only then is B a build.

---

## References

See [`rcll-architecture-assessment-report.md` §References](./rcll-architecture-assessment-report.md#references). Internal anchors: `pipeline-rcll-layout-design.md` (RFC + decision log), `terraform-pipeline-rcll-v2-allresources-rca.md` (RCA), `pipeline-semantic-placement-audit.md` (readability metrics — note: compound/semantic engine, not RCLL).
