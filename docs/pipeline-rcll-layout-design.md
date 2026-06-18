# RFC: Recursive Compound Layered Layout (RCLL) for Terraform Pipeline View

| Field | Value |
| --- | --- |
| **Status** | Draft RFC — open for peer + agent review |
| **Version** | 0.5 |
| **Date** | 2026-06-16 |
| **Author** | Layout design working session (Claude + Tushar Sariya) |
| **Reviewers** | _(pending — peer + agent)_ |
| **Supersedes** | The `Stacked / Packed / Packed+pull-left / Semantic` placement-toggle stack (proposed) |
| **Scope** | Placement algorithm for **Pipeline view** only (Semantic and Module views unchanged) |
| **Implementation** | **In progress — M0a/M0b/M1/M2/M3a (+ 2 hardening passes)/M3b shipped** behind `pipelineLayoutVariant:"rcll"`. This document is the source of truth; it is kept in lockstep with the code (see Document discipline). |

## Document discipline (NORMATIVE)

This RFC is not a one-time proposal — it is the **living, authoritative description of the
as-built code**. The following are hard rules (RFC-2119 MUST/MUST NOT), on the same footing
as the [hard constraints (CON-\*)](#4-requirements-catalogue):

- **DOC-1 — Faithful correspondence.** The RFC **MUST** describe the RCLL pipeline code with **no
  ambiguity**. Every normative statement here **MUST** match the code as shipped. If prose and code
  disagree, that is a defect in exactly one of them and **MUST** be reconciled; a *deliberate,
  not-yet-closed* gap is recorded in [§34.2](#342-implemented-vs-specified-delta-as-built-m3a-hardening)
  (the implemented-vs-specified delta) and nowhere else — silent drift is forbidden.
- **DOC-2 — Append on every change.** A change to the RCLL pipeline code **MUST**, in the **same
  change-set**, update this RFC: a **change-log** row (the narrative), a **[§34.1](#341-implementation-decision-log-di--per-milestone-as-built) DI-\*** row per
  settled decision, the **[§34.3](#343-commit-map-what-each-commit-implemented--decided--amended) commit map** (decision ↔ commit; the hash is backfilled in the
  immediately-following docs commit), and any new **[§34.4](#344-decision-dependency-graph-blast-radius) dependency edges**. A code change that
  leaves this doc untouched is **incomplete** unless it is a pure no-op (refactor with identical
  behaviour AND identical decisions).
- **DOC-3 — Supersede, never delete.** A reversed or replaced decision **MUST** be marked
  `superseded` (naming the superseding ID), **MUST NOT** be removed. The supersession lineage is the
  audit trail ([§34.4](#344-decision-dependency-graph-blast-radius) draws it).
- **DOC-4 — Findings vs choices.** A decision premised on a **measurement** (e.g. a Step-0 probe
  result) **MUST** record that premise. If the measurement later changes, every decision downstream of
  it in [§34.4](#344-decision-dependency-graph-blast-radius) **MUST** be re-evaluated before relying on it.
- **DOC-5 — Decisions are auditable.** Every settled decision is traceable end-to-end: change-log →
  DI-\* (rationale + revisitability) → commit map (hash) → dependency graph (blast radius). A reviewer
  **MUST** be able to answer "why is the code this way, what did it replace, and what breaks if we
  change it" from this document alone.

## Abstract

Pipeline view renders Terraform declared-dataflow (`.tfd`) graphs as Excalidraw diagrams. The current engine produces diagrams that are **far too tall** and **hard to read as dataflow** because it performs graph _layering_ (columns) and a vertical _packing_ pass but omits the **ordering** and **coordinate-assignment** phases that the graph-drawing literature treats as mandatory for a compound layered graph. This RFC specifies **Recursive Compound Layered Layout (RCLL)**: a single algorithm that runs the classic **Sugiyama hierarchical pipeline** (_layer → order → center → compact_) **recursively inside every topology hull**, governed by an explicit **priority lattice** that makes hard structure (TFD order, hull nesting, fan-out columns) and human readability (hub centering) **senior** to height/width compaction. It reads left-to-right, centers hubs over their fan-outs, keeps fan-outs column-aligned, pushes _free_ nodes right to reclaim vertical space, and packs left so the diagram does not sprawl horizontally. The design is grounded in primary literature (Sugiyama, Gansner, Brandes–Köpf, Sander, Doğrusöz, Rüegg, Jünger–Mutzel–Spisla, Dwyer–Marriott, Domrös, and others), and every constraint, requirement, preference, flexibility, decision, and rejected alternative is recorded here so the design can be evolved without losing context.

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 0.1 | 2026-06-16 | Initial RFC consolidating nine clarifying decisions and the literature survey. |
| 0.2 | 2026-06-16 | Added §22 (modular "Lego" pipeline architecture) and §23 (human-factors readability principles, engine practice, optional extras EXT-1…EXT-12, references R21–R30, harvest candidates). |
| 0.3 | 2026-06-16 | Added §24 (implementation order & build sequence — milestones M0–M12, each shippable behind the flag, with a decision gate + acceptance criteria; dependency graph; minimum-viable-readable cut). |
| 0.4 | 2026-06-16 | Robustness pass: added §25 assumptions/preconditions, §26 edge cases & degenerate inputs, §27 failure modes & fallback ladder, §28 configuration & module API surface, §29 observability & debugging, §30 determinism spec (normative), §31 interactions with existing editor features, §32 backward compatibility & migration, §33 risk register, §34 consolidated decision log, §35 test fixture matrix. Surfaced DEC-7 (huge fan-out) and DEC-8 (SCC cycle handling). |
| 0.5 | 2026-06-16 | Visual pass: inline Mermaid diagrams in §5/§7/§22/§24/§27; added **§36 Appendix C — Visual glossary** (structural Mermaid, geometric ASCII before/after, and a decision card with a figure for every DEC-1…8, D1…12, EXT-1…12, and tiers T1…7). Repaired §1/§13/§26 table rendering. |
| — | 2026-06-18 | **RCLL ancillary ("All resources") — investigated, feature DEFERRED, toggle made honest.** User report: in the RCLL view, switching Resources → "All resources" does nothing (the unconnected resources never appear). Confirmed root cause (NOT a regression): the `includeAncillary` flag threads end-to-end but the RCLL model is dataflow-only — a **documented M3a limitation** (`terraformPipelineLayoutRcll.ts:176`, since `c25f0b2a1`); reproduced (ancillary ON==OFF, 1333 els). Three architectures were designed + measured (campaign discipline): **(1) column-leaf model injection** — REJECTED by code analysis: a strip as a `role:"primaryCluster"` leaf reflows the dataflow columns (a wide strip widens its column → `columnOffsetsFromWidths`), lands beside column-1+ not below the scope (`placePackedColumns`), and pollutes model metrics (`primaryClusterCount` + the `MAX_SAFE_INTEGER` sentinel). **(2) export-phase placement** — IMPLEMENTED + MEASURED on v2, then REJECTED: strips drew with **zero model pollution** (`primaryClusterCount` 123/123) and no column reflow, but **90 collisions (compact) / 86 (full)** — because RCLL positions accounts/regions/VPCs in the model phase and the export phase (`applyCompoundHierarchicalLayout`) only re-stacks **providers** (v2 has one), so a strip grows a region hull into the next region with nothing re-stacking regions. **(3) model-phase reserved band** (the correct design) — a per-container bottom band placed in the placement engine like the `mixed`-VPC policy (`placeForcedBands` then a disjoint-Y region below), so the container **footprint** reserves the space (no collision), placed below the columns (no reflow), typed with a distinct `ancillaryBand` role (no pollution). Codex flagged that (3) is a real placement-engine milestone (role-blindness across `collectClusterLeaves` + the cyclic `arrangeByHullMatrix` engine; inject-before-`runRcllPipeline`; determinism re-sort; a mandatory band-width cap since the container footprint width still feeds the parent's `columnWidths`; the empty-`normalKids` case). **Decision: DEFER the feature** (a scoped future milestone, design + Step-0 evidence recorded here) and **make the toggle honest now** — under RCLL the "All resources" option is **disabled** (greyed, with a "not in this layout / planned" note) and "Dataflow only" reads active, so the control reflects reality instead of silently no-op'ing. UI-only change (`TerraformImportPipelineSettings.tsx` `option()` gains a `disabled` arm gated on `!showVariant`; SCSS `:disabled`; help entry `resources.allRcll`); no engine/model change. Tests: dialog asserts "All resources" disabled + "Dataflow only" active + import keeps `pipelineIncludeAncillary:false` under RCLL. Eng-review + 2 Codex rounds drove the three-architecture investigation. DI-ANC-1..3; §34.2 deferred-delta row. |
| — | 2026-06-18 | **M4 — swimlane interior lane-rise (DEC-1 extended; CON-12-safe), behind a front-end A/B toggle.** M4's original framing ("global top-spine alignment") had **no v2 leverage** (v2 has one provider, and M3b already staircases its accounts), so it was reframed twice, each gated by measurement: **(reframe 1)** "route every container through the hull-placement matrix" — a Step-0 probe proved it **byte-identical to M3b on v2** (the M3a forced/packed/mixed policies already equal the matrix: both use longest-path columns, and the width-aware staircase makes the DEC-1 rise degenerate to per-column stacking on acyclic containers), so it was **reverted** (no-op, adds blast radius); **(reframe 2, shipped)** the one place the matrix does NOT reach on v2 is a swimlane's interior (`arrangeSubtreeOnAxis` lays nested lanes as a pure Y-stack). **`swimlaneLaneRise`** extends the **DEC-1 Y-rise into swimlane interiors**: each nested lane's frame is tightened to its content shared-column range while **leaf X is preserved** — so X-disjoint lanes RISE to share Y rows, but cross-member edges keep the shared `denseRank(LB)` axis and read forward (**CON-12-safe by construction**). **v2 result (Compact + Full): height −2.1% / −2.0%; collision 0, containment 0, siblingOverlap 0, iron rule (both halves) 0, deterministic.** The win is capped because almost every lane contains a column-0 source (the "everything starts at column 0" structure), so few lanes are X-disjoint enough to rise. Shipped behind the **front-end A/B toggle** "Swimlanes · Stacked / Risen" (dialog + `swimlaneRise` URL param); default OFF (== M3b), so blast radius is zero until flipped. `rcllMilestone` → `"M4"` when active. DI-M4-1..6; **DEC-10** (independence gap — parked); the edge-length **reorder** that was scoped here is **deferred to M6** (it is structurally Sugiyama's ordering phase and couples to the rise). The "global cross-provider spine ruler" is deferred (§34.2) until a multi-provider preset exists. Tests: swimlane lane-rise unit suite (`terraformPipelineRcllPlacement.test.ts`, 30) + v2 integration (rise ON shorter, all gates 0, M4 milestone) + dialog toggle + URL round-trip. Eng-review + 2 Codex rounds; Codex caught the swimlane-bypass + the no-op (both folded). |
| — | 2026-06-18 | **M3b — hull-aware cyclic placement: 2-way → swimlane, 1-way → staircase + DEC-1 Y-rise.** M3b's original framing ("turn on the X-disjoint forced-band Y-rise") was killed by a **Step 0 measurement**: on `staging-extended-localstack-v2` the whole `provider` is ONE cyclic container, so its 4 accounts all dissolve onto a single shared column-0 axis (no forced site reached, no X-disjoint lane) — the literal DEC-1 lever is a v2 no-op (height 16,165 compact / 29,405 full). **User reframing (the real fix):** place hulls by **edge directionality**, and never let a hull cycle force resource columns. A cyclic container's `D_H` is decomposed into its **strongly-connected components**: a **multi-hull SCC** (a genuine mutual 2-way cycle) becomes ONE **swimlane** (shared `denseRank(LB)` axis, members as Y-lanes — flatten *required* so cross-member resource edges read forward); the **condensation** (one-way edges between SCC groups) is a DAG placed as a **staircase** (greater X, width-aware `columnOffsetsFromWidths`, CON-6) with a **DEC-1 Y-rise** (`placeRiseStack` — X-disjoint groups share rows). Singleton SCCs recurse via `sizeAndArrange` (full policy + nested cycles). This **refines DEC-8(C)**: the swimlane axis is scoped **per SCC group**, not the whole container (corrects M3a-h2's global dissolve). New `arrangeCyclicContainer`/`arrangeSwimlaneGroup`/`placeRiseStack`; `stronglyConnectedComponents` **extracted to shared** (reused by layering + the gate). **The iron-rule gate is RE-BASED** (`backwardEdgeGate`): excusal now keys off genuine **cluster-graph `D`** SCCs, NOT "the LCA container is cyclic" — after the redesign most edges have the cyclic provider as LCA, so the old LCA-keyed excusal would go blind. `D` acyclic on v2 ⇒ 0 excused ⇒ the hard gate covers every edge. `forcedBandViolations` → **`siblingOverlapViolations`** (true 2D overlap among ANY container's children, policy-agnostic — the legitimate X-disjoint Y-rise no longer false-positives). **v2 result (Compact + Full): height 16,165 → 14,285 (−12%) / 29,405 → 27,674 (−6%); collision 0, containment 0, siblingOverlap 0, iron rule (both halves, re-based) 0, deterministic.** Mirror-width (mutually-dependent hulls grow X to mirror) parked as an optional spec addition; DEC-3 region toggle deferred. DI-M3b-1..6. Tests: rewritten swimlane suite + new staircase/rise + re-based gate (`terraformPipelineRcllPlacement.test.ts`, 25) + v2 integration. |
| — | 2026-06-17 | **M0b gate decision (DEC-6) — measurement harness complete.** Chose the **polyline-aware crossing counter** (de-dupe per arrow pair; 2-point ⇒ old chord count); extended ΔY/near-straight to the **polyline vertical extent** so elbow jogs read as deviating. Added `fanoutColumnRate`/`hubCenteringRate`/`aspect` + companion counts `fanoutSetCount`/`hubCount` (rate 0 on empty denominator, never a vacuous 1.0). Dials: **ε = 36px** (full `PIPELINE_CLUSTER_GAP_Y`), fan-out column tolerance **75px** (`PIPELINE_COLUMN_GAP`/2). Hub-centering measures **both directions** (fan-out + convergence, per §13). Baseline (`staging-extended-localstack-v2`, Compact): fanoutColumnRate 0.76, **hubCenteringRate 0.04** — the centering gap M5 closes. (Full mode reads 0/0: compound full-mode cluster frames carry no `terraformPrimaryAddress`; companion counts make that observable.) All in `terraformPipelineCollisionDiagnostics.ts`. |
| — | 2026-06-17 | **M1 — prep + compound tree & lattice (Stage 0); DEC-2 settled.** New `terraformPipelineRcllModel.ts` (`buildRcllModel`) builds the `CompoundNode` tree + `Lattice` (`LB`/`UB`/`slack`, fan-out/fan-in, per-container `D_H`, `cyclicContainers`) from the shared prep; **no geometry change** (still delegates to compound, geometry ≡ compound verified). **DEC-2:** cross-hull fan-out evaluated at the **LCA** — realized by up-projecting each collapsed edge to its LCA container via `lcaTopologyPath`. Key decisions: leaf nodes keyed by **`cluster.id`** (topology path excludes the resource, so same-subnet siblings would collide and drop their `D_H` edge); declared box edges merged into `D_H` by `(from,to)` without double-counting weight; `UB` clamped `≥ LB`; import **unguarded** (degenerate-input no-throw tests are the control). Compound builder takes optional `prep` so the skeleton build runs once (no ~2× regression). **v2 finding:** `D_H` has **6 cyclic containers** even though the cluster graph `D` is acyclic — up-projection of a DAG is not a DAG (Sander/Forster). M1 flags them; the localized fallback (CON-2/DEC-8) **will fire on v2 at M3**, not just in theory. Model resolves fully in **both** Compact and Full (123 clusters / 37 fan-out sets / 99 hull edges), closing M0b's Full-mode 0/0 gap at the model level. `rcllMilestone:"M1"` + scalar `rcllModel` meta block. Tests: `terraformPipelineRcllModel.test.ts` (23) + extended `terraformPipelineRcll.test.ts`. |
| — | 2026-06-17 | **M3a-hardening-2 — extended iron rule (no SAME-column edge) + swimlanes for spurious hull cycles (DEC-8(C)).** User report: in `staging-extended-localstack-v2` a VPC's public/private/intra subnet zones rendered **in one column** though their resources depend on each other. Root cause = **the previous hardening's own fix**: DI-M3a-12 cured *backward* edges by SCC-condensing each spurious hull cycle to **one shared column** — which made the sibling hulls read **same-column**. The cluster graph `D` is acyclic (verified); the 6 cyclic containers are **spurious** (an acyclic `D` up-projects to a cyclic `D_H` — already recorded at M1). Fix (user's design, validated against the RFC — it pulls back to the **Sander [R6]** compound model the RFC already cites): stop atomizing a cyclic container into one column; **dissolve it onto a shared cluster column axis** (`arrangeLaneSubtree`: `column = denseRank(LB)`, so a TFD edge always crosses a column) with its sub-hulls as **Y-lanes** spanning column ranges — a subnet is one contiguous frame **over multiple columns**, and `A→B→A` reads as forward steps across lanes. Extended **CON-12** with a second half (*no TFD edge shares a column*), scoped **CON-6** to spine hulls, added **DEC-8(C)** (supersedes DEC-8(B)/DI-M3a-12), §8 swimlane policy, §11 lane boundary. `backwardEdgeGate` now keys off the box **left edge** (not `centerX`, which is width-ambiguous) and returns `acyclic/cyclicSameColumnEdges`; `policyForContainer` is role-only (cyclic routed to lanes upstream). **v2 result (Compact + Full): `acyclicBackwardEdges = acyclicSameColumnEdges = 0`, collision still 0, deterministic; 0 back-edges left to style** (the prior 11/22 were an artifact of DEC-8(B), not real cycles). EXT-12 styling retained as the defensive path for a *genuine* `D` cycle. DI-M3a-16/17. Tests: new swimlane unit suite (`terraformPipelineRcllPlacement.test.ts`, 22) + extended v2 integration. |
| — | 2026-06-17 | **M3a-hardening — the iron rule (CON-12) + cyclic DEC-8(B) + spec delta.** Checkpoint review found the backward-edge metric was **doubly-defined** and the "M4 drives it down" plan was unsound. Empirical classification of v2's 35 compact backward edges: **100% have a cyclic LCA; 0 acyclic.** Proof: the width-aware staircase (`columnOffsetsFromWidths`) already places column k+1 fully right of column k's right edge, so for an **acyclic** LCA `col(A)<col(B)` ⇒ B's whole box (and every resource in it) is right of A's — forward by construction. Made it a **hard constraint CON-12** (no edge renders backward except within a cyclic container) and a **model-level gate** (`backwardEdgeGate` on placed boxes: `acyclicBackwardEdges` MUST be 0; `cyclicBackwardEdges` excused + counted), which works in **Compact AND Full** (boxes exist regardless of frame tagging — curing the rendered metric's full-mode blindness). **Cyclic = DEC-8(B) SCC condensation** (replaces M2's sequential-column strip, which spread cycle members across X and caused ~half the backward reads): `columnsForContainer` now condenses each cyclic container's SCCs, giving cycle members one shared column (M3a packed stacks them in Y at one X) while the container's acyclic members keep forward columns. **v2 result: acyclicBackwardEdges = 0 (Compact + Full); backward edges 35 → 11 (compact) / 22 (full), all genuine intra-SCC cycle wrap-edges (the irreducible floor; drawn as back-edges via EXT-12, deferred).** Also surfaced: dataflow arrows are `isDeleted` in the scene (diagnostics counts them; callers that pre-filter `!isDeleted` read a false 0). DI-M3a-11..15; new §34.2 implemented-vs-specified delta. |
| — | 2026-06-17 | **M3a — first geometry: placement (Stage 1d/2); collision gate met.** New `terraformPipelineRcllPlacement.ts` (`placementStage`, pure, no UI) turns M2's `localColumn` into a global `box` per node: per-container local `columnX` (shared `columnOffsetsFromWidths` kernel, also routes `computeGlobalColumnX`), **forced bands** (root passthrough / provider+account forced / region+subnetZone packed / vpc mixed), **packed column-stack** (un-centered Sugiyama Y — centering is M5, row-share is M7), cyclic containers via M2's sequential columns (RFC §26/DEC-8(B) shared-band stack **deferred**), each container footprint **reserves its own frame-title** so the four collision classes hold by construction. Export rewired: branches on `runRcllPipeline().ran.includes("placement")` → `buildSceneFromBoxedTree` (reuses `emitTopologyContextFrames` / `applyCompoundHierarchicalLayout` / edge+parenting/convert verbatim) else compound fallback (§27). **Provider Y owned solely by the reanchor** (placement never bands providers). **Retires the "geometry ≡ compound" invariant.** **v2 result (Compact + Full): collision gate = 0, containment = 0, forced bands disjoint = 0, deterministic, geometry ≠ compound**; compact RCLL is collision-free where compound had 2 collisions. `semanticEdgeViolations` is **observed not gated** (35 compact: cross-container edges read backward under local columns — the M4 top-spine drives it down). New `pipeline_cycle_container` warning. `rcllMilestone:"M3a"`; gate metrics under `rcllStageMeta.placement`. Tests: `terraformPipelineRcllPlacement.test.ts` (16) + `columnOffsetsFromWidths`/`computeGlobalColumnX` regression + extended `terraformPipelineRcll.test.ts` (§27 fallback, cycle warning). |
| — | 2026-06-17 | **M2 — layering (Stage 1a); gate "fan-out shared column = max LB" met.** First real stage registered in `RCLL_STAGES`: `terraformPipelineRcllLayering.ts` (`layeringStage`) writes `CompoundNode.localColumn` per container from `D_H[H]` (M1's per-container child DAG): longest-path floors (T1/CON-1) + hull staircase (T3/CON-6) + **fan-out column pinning** (T4 — raise each fan-out set's targets to the set's max column, then forward-relax to restore CON-1). **Model-only** decision: no geometry change (geometry ≡ compound verified); M3 turns columns into pixels. **Cyclic containers** (the 6 on v2) get sequential columns `0,1,2…` and are **excused** from the CON-1/CON-6 gate (longest-path undefined on a loop; smarter handling deferred to M3). **T1 > T4:** a fan-out target internally preceded by another keeps its later column (precedence senior to co-columning). DRY: extracted a shared `longestPath(nodeKeys, edges, rankOf) → {column, hasCycle, unresolved}` into `terraformPipelineLayoutShared.ts`; `computeDepths` routes through it (byte-identical, regression-tested), each caller keeps its own cyclic fallback. Builder rewired to consume `runRcllPipeline().tree` (closes the latent "builder drops the pipeline tree" gap M3+ would inherit). **v2 result (Compact + Full): model fan-out-column rate = 1.0 over 37 sets, CON-1/CON-6 violations = 0**, geometry ≡ compound, deterministic. `rcllMilestone:"M2"`; layering gate metrics under `rcllStageMeta.layering`. Tests: `terraformPipelineRcllLayering.test.ts` (16) + `longestPath`/`computeDepths` regression in `terraformPipelineLayoutPacked.test.ts` + extended `terraformPipelineRcll.test.ts`. |

---

## Table of contents

1. [Glossary & notation](#1-glossary--notation)
2. [Motivation](#2-motivation)
3. [Goals and non-goals](#3-goals-and-non-goals)
4. [Requirements catalogue](#4-requirements-catalogue)
5. [The priority lattice](#5-the-priority-lattice)
6. [Inputs & data model](#6-inputs--data-model)
7. [Algorithm specification](#7-algorithm-specification)
8. [Per-level placement policy](#8-per-level-placement-policy)
9. [Coordinate assignment (centering)](#9-coordinate-assignment-centering)
10. [Compaction (push-right & pack-left)](#10-compaction-push-right--pack-left)
11. [Hybrid column model](#11-hybrid-column-model)
12. [Edge routing & compound frame parenting](#12-edge-routing--compound-frame-parenting)
13. [Invariants & acceptance gates](#13-invariants--acceptance-gates)
14. [Open design decisions](#14-open-design-decisions)
15. [Alternatives considered (whole-approach)](#15-alternatives-considered-whole-approach)
16. [Complexity, performance & determinism budget](#16-complexity-performance--determinism-budget)
17. [Verification & metrics](#17-verification--metrics)
18. [Migration, rollout & toggle consolidation](#18-migration-rollout--toggle-consolidation)
19. [References](#19-references)
20. [Appendix A — worked example: the v2 org spine](#20-appendix-a--worked-example-the-v2-org-spine)
21. [Appendix B — implementation file map](#21-appendix-b--implementation-file-map)
22. [Modular ("Lego") pipeline architecture](#22-modular-lego-pipeline-architecture)
23. [Human-factors readability — principles, engine practice & optional extras](#23-human-factors-readability--principles-engine-practice--optional-extras)
24. [Implementation order & build sequence (milestones)](#24-implementation-order--build-sequence-milestones)
25. [Assumptions & preconditions](#25-assumptions--preconditions)
26. [Edge cases & degenerate inputs](#26-edge-cases--degenerate-inputs)
27. [Failure modes & graceful degradation](#27-failure-modes--graceful-degradation)
28. [Configuration & module API surface](#28-configuration--module-api-surface)
29. [Observability & debugging](#29-observability--debugging)
30. [Determinism specification (normative)](#30-determinism-specification-normative)
31. [Interactions with existing editor features](#31-interactions-with-existing-editor-features)
32. [Backward compatibility & migration](#32-backward-compatibility--migration)
33. [Risk register](#33-risk-register)
34. [Consolidated decision log](#34-consolidated-decision-log)
35. [Test fixture matrix](#35-test-fixture-matrix)
36. [Appendix C — Visual glossary](#36-appendix-c--visual-glossary)

---

## 1. Glossary & notation

Precise definitions used throughout. Where a term already exists in code, the symbol is given.

| Term | Definition |
| --- | --- |
| **TFD** | "Terraform dataflow" — declared `A -> B` edges parsed from `.tfd` files, resolved to plan node keys. The semantic dataflow the diagram exists to show. Stored under `DECLARED_DATAFLOW_ORDERED_KEY`. |
| **Cluster** (`PipelineCluster`) | A primary resource node after _satellite collapse_ (e.g. an ALB plus its listeners/target groups collapses to one cluster). The atomic placeable leaf. Carries `id`, `primaryAddress`, `firstSequence`, `depth`, `placement`, `build` (skeleton + width/height). |
| **Collapsed edge** (`CollapsedPipelineEdge`) | A TFD edge after its endpoints are mapped to their owning clusters; self-loops dropped. |
| **TFD DAG** `D` | The directed graph over clusters formed by collapsed edges. Assumed acyclic (cycles trigger fallback, [CON-2](#4-requirements-catalogue)). |
| **Topology / hull hierarchy** | The nesting `root → provider → account → region → vpc → subnetZone → cluster`, from `buildPlacementMap` / `topologyAddressPlacementMap`. Truthful; never invented ([CON-7](#4-requirements-catalogue)). |
| **Hull** (a.k.a. context frame, container) | An Excalidraw frame drawn around a topology group. A **derived** rectangle = bounding box of its laid-out children + padding. Roles: `root`, `provider`, `account`, `region`, `vpc`, `subnetZone`, `primaryCluster`. |
| **Lane** (legacy) | The current engine's unit of vertical stacking: one unique `laneKey = provider\0account\0region\0vpc\0subnetSignature`. RCLL replaces lane-stacking with recursive packing; the term is retained only for comparison. |
| **Band** | A vertical (Y) interval reserved for one sibling under a _forced_ policy. "Forced bands" ⇒ sibling hulls occupy disjoint Y intervals (subject to the staircase exception, [DEC-1](#14-open-design-decisions)). |
| **Column / layer** | A discrete TFD hop index along **X**. `columnX[d]` maps a column index to an X pixel offset. Our layering axis is **horizontal**; our cross-axis is **vertical (Y)** — the transpose of the usual graph-drawing convention (note this when reading cited papers, whose "horizontal coordinate" = our **Y**). |
| **Column floor** `LB(v)` | The minimum legal column of cluster `v` = longest-path distance from a TFD source. Enforces [CON-1](#4-requirements-catalogue). |
| **Slack** | `slack(v) = UB(v) − LB(v)`, where `UB(v)` is the rightmost column `v` may occupy without forcing any successor past its own floor. A node with `slack > 0` _may_ be pushed right. |
| **Fan-out set** | `out(u) = {v : u→v}`. When it has ≥ 2 members, the targets form a fan-out set subject to [T4](#5-the-priority-lattice) (shared column) and `u` is a **hub** subject to [T5](#5-the-priority-lattice) (centered over them). |
| **Fan-in set** | `in(w) = {u : u→w}`. When it has ≥ 2 members, `w` is centered over its sources ([T5](#5-the-priority-lattice)); sources are **not** forced to share a column ([decided](#4-requirements-catalogue), `PREF`/`FLEX-4`). |
| **Pinned vs free** | A node/hull is **pinned** if it belongs to any fan-out set, or if moving it would break a [T4](#5-the-priority-lattice)/[T5](#5-the-priority-lattice) relation. Otherwise **free**. Only free nodes are push-right candidates ([T6](#5-the-priority-lattice)); pack-left ([T7](#5-the-priority-lattice)) moves free nodes individually and fan-out groups as rigid units. |
| **Hull→hull edge** | A TFD dependency between two sibling hulls. Either _declared_ (e.g. `organization_root -> workload_account`) or _up-projected_ (a cluster→cluster edge whose endpoints sit in two different child subtrees of a container). Drives [T3](#5-the-priority-lattice). |
| **Staircase** | The visual result of [T3](#5-the-priority-lattice): a dependent hull placed down-and-right of the hull it depends on. |
| **LCA** | Lowest common ancestor in the topology tree. A cross-hull edge or fan-out set is evaluated at the LCA container where its endpoints first become siblings. |
| **Centering / balance** | Placing a node at the **median** cross-axis position of its connected neighbors (Brandes–Köpf). "Balanced" variant averages candidate alignments. |
| **VPSC** | Variable Placement with Separation Constraints — a deterministic 1-D quadratic projection that moves points minimally to satisfy ordered separation constraints (Dwyer–Marriott). Used once on Y to enforce bands + non-overlap + clamp centering. |
| **Aspect target** | The desired width:height ratio that defines "horizontal but not excessive" ([FLEX-3](#4-requirements-catalogue), [DEC-4](#14-open-design-decisions)). |

Spacing constants (existing; tunable, [FLEX-8](#4-requirements-catalogue)): `PIPELINE_MARGIN=50`, `PIPELINE_FRAME_PAD=28`, `PIPELINE_COLUMN_GAP=150`, `PIPELINE_CLUSTER_GAP_Y=36`, `PIPELINE_LANE_GAP_Y=96`, `PIPELINE_FRAME_TITLE_HEIGHT = FRAME_STYLE.nameFontSize × FRAME_STYLE.nameLineHeight + nameOffsetY`.

---

## 2. Motivation

### 2.1 What's wrong today (measured)

From `docs/pipeline-semantic-placement-audit.md` and the lane-debug tests, canonical preset `staging-extended-localstack-v2`:

| Config | W × H (px) | Cols | TFD arrows | Crossings | Near-straight | Median ΔY | Region band-share |
| --- | --- | --- | --- | --- | --- | --- | --- |
| defaults (classic+compact+stacked) | 8,038 × **18,522** | 16 | 145 | 249 | 14 % | 1,221 | 0 |
| compound+compact+packed+pullLeft | 12,466 × **7,520** | 23 | 145 | 142 | 17 % | 353 | 6 |
| canonical (compound+full+packed+pullLeft+ancillary) | 15,255 × **25,387** | 24 | 145 | 137 | 12 % | 931 | 7 |

Three structural problems:

1. **Too tall.** Every `account × region × vpc × subnet` becomes its own vertically stacked lane. Height is dominated by lane count, not by content.
2. **Not legible as dataflow.** Only 12–17 % of arrows are near-straight; median vertical deviation is 350–1,221 px. There is no crossing-reduction phase and no coordinate-assignment phase, so a node's Y is an accident of pack order. Hubs are **not** centered over their fan-outs.
3. **Confusing controls.** `Stacked / Packed / Packed+pull-left / Semantic` are four code paths on a single conceptual axis (how aggressively to convert vertical stacking into readable horizontal flow), each with subtly different cache and invariant behavior.

### 2.2 Why it matters

The diagram's purpose is to let a human **read the dataflow**. Humans read **left to right**, expect a **parent centered over the things it fans out to** (not aligned to the first child), expect **siblings of a fan-out to line up in a column**, and tolerate some extra height to get that alignment. They are frustrated by excessive scrolling in either axis. The current engine optimizes geometry (height, then width) but not _reading_. RCLL reframes the problem as **readability-first hierarchical layout with compaction subordinate to readability**.

### 2.3 Why a redesign rather than a patch

The audit's own conclusion: the missing pieces are the **ordering** and **coordinate-assignment** phases — i.e. half of the Sugiyama framework. Bolting them onto the current two-pass packer (which is itself two greedy passes fighting each other, §[3 of the design plan]) is more fragile than running the standard framework recursively. The user has authorized a full rewrite of the pipeline import layout.

---

## 3. Goals and non-goals

### Goals

- **G1.** Read left-to-right; TFD order is always visually honored.
- **G2.** Hubs centered over fan-outs; fan-out targets column-aligned.
- **G3.** Reduce vertical height by pushing _free_ nodes/hulls right (using TFD slack), then pack left to avoid excessive width — "horizontal but not excessive."
- **G4.** Preserve a clean, truthful hull hierarchy (nested, non-overlapping; forced bands where configured).
- **G5.** Replace four placement toggles with one algorithm plus a small set of meaningful dials.
- **G6.** Deterministic, single-pass, runs inline at import (no iterative solver, no UI dependency in layout core).
- **G7.** Keep Compound group-drag (drag a hull → its resources and in-group arrows move).

### Non-goals

- **N1.** Changing `.tfd` syntax or the topology placement map.
- **N2.** Embedding a full external layout engine (ELK) at runtime (we borrow its algorithms, not its binary).
- **N3.** Touching Semantic or Module views.
- **N4.** Edge bundling / orthogonal routing beyond what's needed for legibility (future work).
- **N5.** Zoom/scale-based detail hiding (explicitly rejected — see [§15](#15-alternatives-considered-whole-approach)).

---

## 4. Requirements catalogue

Tagging: **CON** = hard constraint (never violated); **REQ** = functional requirement; **PREF** = soft preference (optimized, may yield to higher tiers); **FLEX** = flexibility/tunable. Each item: statement · rationale · source · enforcement. "Source" cites a user decision, a paper ([§19](#19-references)), or the audit.

### Hard constraints (CON)

| ID | Statement | Rationale | Source | Enforced by |
| --- | --- | --- | --- | --- |
| **CON-1** | For every collapsed TFD edge `u→v`, `column(u) < column(v)`; fan-out targets from one source **may** share a column. | TFD precedence is the semantic spine of the diagram. | User; existing invariant; Sugiyama [R1] | Layering ([§7.2a](#7-algorithm-specification)); verified per-container and globally. |
| **CON-2** | A cycle in `D` (or in any container's hull-edge DAG) triggers a **localized** fallback (flatten that subtree to model-order stacking) — not a global flatten. | Correctness without nuking the whole scene (current code aborts globally). | User; §3.3 of design plan | `computeDepths` cycle flag, per-subtree. |
| **CON-3** | Hull frames are properly nested; every child lies inside its parent's content box. | Truthful containment; group-drag. | Existing; Sander [R6] | Hull = derived bbox + pad; VPSC containment ([§9](#9-coordinate-assignment-centering)). |
| **CON-4** | No two **non-ancestor** hull frames overlap (rectangles or title areas). | Clean hierarchy reading. | User; REGION_SUBNET plan | Final-scene categorized collision diagnostic = 0 ([§13](#13-invariants--acceptance-gates)). |
| **CON-5** | At levels whose policy is _forced_, sibling hulls occupy **distinct vertical bands** (subject to the [DEC-1](#14-open-design-decisions) staircase exception). | Ownership clarity ("which account am I in"). | User (forced bands) | Forced-stack placement ([§8](#8-per-level-placement-policy)). |
| **CON-6** | A one-way hull→hull TFD edge `A→B` ⇒ `A` strictly left of `B`, **width-aware**: `B.left ≥ A.right + gap` (not merely a lower column index). The `columnOffsetsFromWidths` kernel places column k+1 at `columnX[k] + maxWidth[k] + gap`, so a higher column is fully right of every box in a lower column — this is what makes local per-container columns ([§11](#11-hybrid-column-model)) globally-monotonic along every edge ([CON-12](#4-requirements-catalogue)). **Scope: the SPINE hulls** (provider/account/region) — the atomically-positioned containers. It does **NOT** govern a subnet zone's hull→hull edge: those hull edges can be **spurious** (an acyclic `D` up-projects to a cyclic `D_H`, [§26](#26-edge-cases--degenerate-inputs)), so a subnet zone is NOT positioned as one atomic column — it is dissolved into a **swimlane** ([DEC-8(C)](#14-open-design-decisions)) whose interior clusters carry the real L→R order. | The org spine must read L→R at the hull level; the width-aware form is what guarantees no backward edge. | User | Hull staircase layering ([§7.2a](#7-algorithm-specification), [§11](#11-hybrid-column-model)); `columnOffsetsFromWidths`. |
| **CON-7** | Topology (account/region/vpc/subnet) comes from the placement map; never fabricated. | Diagram must reflect reality. | Existing | `buildPlacementMap`. |
| **CON-8** | Layout is **deterministic**: identical inputs ⇒ byte-identical output across runs. | Stable diffs, caching, reproducibility. | Existing | Stable sort keys `(firstSequence, topology key, id)`; tie-broken everywhere. |
| **CON-9** | Layout runs **single-pass on the main thread**, with **no iterative force loop**, and `terraformLayoutCore` imports **no UI**. | Import latency; dependency-cruiser boundary. | Existing; `yarn lint:arch` | Greedy phases + one-shot VPSC projection only. |
| **CON-10** | Pipeline import requires ≥1 resolved TFD edge, else HTTP-style 400. | Pipeline is defined by TFD. | Existing | Prep guard. |
| **CON-11** | The algorithm works in both **Compact** (primary card only) and **Full** (satellites inline) detail modes. | Content toggle is orthogonal to placement. | Existing | Size-driven packing (hull size varies; algorithm unchanged). |
| **CON-12** | **The iron rule — no backward edge AND no same-column edge.** For every collapsed TFD edge `u→v`, `v`'s box reads a **full column to the right** of `u`'s (measured on the **box left edge** `x`, the column indicator — `centerX` is ambiguous because cards in one column have different widths): `x(v) ≥ x(u) + ε` with `ε = gap/2`. Two halves: (a) **no backward** — `v` never left of `u`; (b) **no same column** — `u` and `v` never share a column (`|x(v) − x(u)| < ε`). The **only** exception is a **genuine `D` cycle** (CON-2), where no L→R order exists and the wrap-edge is drawn as an explicit back-edge ([EXT-12](#23-human-factors-readability--principles-engine-practice--optional-extras)). A **spurious** hull cycle (the up-projection of an acyclic `D`, [§26](#26-edge-cases--degenerate-inputs)) is **not** an exception — it is dissolved into a swimlane ([DEC-8(C)](#14-open-design-decisions)) so its edges read strictly forward. Implied by [CON-1](#4-requirements-catalogue) + the **width-aware** staircase ([CON-6](#4-requirements-catalogue)) + the shared lane axis. | User (hard rule); `D` is acyclic, so a valid L→R order always exists at the cluster level. | User | `backwardEdgeGate` on placed boxes ([§13](#13-invariants--acceptance-gates)): `acyclicBackwardEdges = 0` **and** `acyclicSameColumnEdges = 0` (Compact **and** Full); `cyclic*` counted + excused (= 0 on v2: no genuine `D` cycle). |

### Functional requirements (REQ)

| ID | Statement | Source |
| --- | --- | --- |
| **REQ-1** | Layout is a **recursive pass over the compound tree**: each container lays out its children, is sized, then is treated as one box by its parent. | Doğrusöz [R8]; Sander [R6]; ELK recursive [R9] |
| **REQ-2** | **Layering** assigns each cluster a column ≥ `LB(v)` (longest-path floor), honoring CON-1/CON-6. | Sugiyama [R1]; Gansner [R2] |
| **REQ-3** | **Fan-out targets share a column** (the deepest required among them) — applies to clusters **and** hulls (recursively, at the LCA). | User; Sugiyama aesthetic |
| **REQ-4** | **Free nodes with slack are pushed right** to share rows, reducing height. Pinned (fan-out) members are never pushed. | User; Gansner `balance()` [R2]; MinWidth [R3] |
| **REQ-5** | An **ordering phase** sequences nodes within each column to reduce crossings (barycenter, deterministic tiebreak). | Forster [R7]; Sugiyama [R1] |
| **REQ-6** | A **coordinate-assignment phase** centers every node on the median Y of its connected neighbors (both directions), clamped to its band. | Brandes–Köpf [R10]; Rüegg size-aware [R12] |
| **REQ-7** | **Hybrid columns:** the `root→provider→account` spine is aligned on one global grid; columns inside each hull are local. | User |
| **REQ-8** | A **pack-left** width pass pulls free nodes and whole fan-out groups left (groups as rigid units), adjusting Y, toward the aspect target; it never opens a new row. | User; Domrös [R13] |
| **REQ-9** | Build, per container, a **hull-edge DAG** by up-projecting cross-subtree TFD edges and adding declared hull→hull edges. | User; this RFC |
| **REQ-10** | Emit TFD arrows and hull→hull connectors; **parent each arrow to its LCA topology frame** so group-drag moves it. | Existing Compound; Excalidraw frame model |
| **REQ-11** | Instrument **readability metrics** (fan-out column rate, hub-centering rate, median ΔY, near-straight %, aspect) and the categorized collision diagnostic. | Audit; this RFC |

### Soft preferences (PREF) — optimized within higher tiers

| ID | Statement | Source |
| --- | --- | --- |
| **PREF-1** | Center hubs over fan-outs (T5). Strong, but yields to band clamp + non-overlap (CON-3/4/5). | User; Brandes–Köpf [R10] |
| **PREF-2** | Minimize edge crossings. | Sugiyama [R1]; Forster [R7] |
| **PREF-3** | Maximize near-straight edges (minimize ΔY). | Brandes–Köpf [R10]; Jünger–Mutzel–Spisla [R11] |
| **PREF-4** | Keep aspect ratio near the target (not excessively wide or tall). | Rüegg [R4]; Jabrayilov et al. [R5] |
| **PREF-5** | Minimize height (within readability). | User; Gansner [R2] |
| **PREF-6** | Minimize width (within readability + height). | User; Domrös [R13] |
| **PREF-7** | Stability / mental-map preservation across re-imports and on expand. | Dwyer–Marriott–Wybrow [R14] |

### Flexibilities (FLEX) — tunables exposed for reviewers / future change

| ID | Knob | Default | Notes |
| --- | --- | --- | --- |
| **FLEX-1** | Per-level placement policy (forced vs packed) | forced at provider/account/region/vpc; packed at subnetZone interior & region-direct resources | [§8](#8-per-level-placement-policy) |
| **FLEX-2** | Forced-band staircase Y-overlap | **on (recommended)** | [DEC-1](#14-open-design-decisions) |
| **FLEX-3** | Aspect target (ratio / viewport / height-first) | height-first then pack-left | [DEC-4](#14-open-design-decisions) |
| **FLEX-4** | Fan-in handling | center target, **do not** force source column | chosen; symmetric column-forcing available |
| **FLEX-5** | Centering tolerance ε | TBD ([DEC-6](#14-open-design-decisions)) | for metrics + acceptance |
| **FLEX-6** | Dummy nodes for long edges | off (v1) | [DEC-5](#14-open-design-decisions) |
| **FLEX-7** | Cross-hull fan-out evaluation | at LCA container | [DEC-2](#14-open-design-decisions) |
| **FLEX-8** | Spacing constants (`PIPELINE_*`) | as today | tune for density |
| **FLEX-9** | `.tfd`-authored edge weights (spine emphasis) | none | [DEC-4](#14-open-design-decisions) |

---

## 5. The priority lattice

The lattice is the central design device. **Higher tiers are satisfied first and are never violated by lower tiers; each lower tier optimizes only within the freedom the tiers above leave.** This converts a "delicate balance of many rules" into a deterministic resolution order.

| Tier | Rule | Kind | Maps to |
| --- | --- | --- | --- |
| **T1** | TFD precedence (`u→v ⇒ col(u) < col(v)`; fan-out may share a column) | Hard | CON-1 |
| **T2** | Hull nesting + forced bands where configured | Hard | CON-3, CON-4, CON-5 |
| **T3** | Hull→hull dependency staircase (`A→B ⇒ A` left of `B`) | Hard | CON-6 |
| **T4** | Fan-out shared column (resources **and** hulls) | Readability-hard | REQ-3 |
| **T5** | Centering / balance (median; both directions; hub over fan-out, convergence over sources) | Readability (senior to compaction; yields to T2 clamp) | REQ-6, PREF-1/2/3 |
| **T6** | Height compaction — push **free** nodes right to share rows | Optimize within T1–T5 | REQ-4, PREF-5 |
| **T7** | Width compaction (pack-left) — pull free nodes & whole fan-out groups left, adjust Y, toward aspect | Optimize within T1–T6 | REQ-8, PREF-4/6 |

```mermaid
flowchart TD
  T1["T1 · TFD precedence — hard"] --> T2["T2 · Hull nesting / forced bands — hard"]
  T2 --> T3["T3 · Hull→hull staircase — hard"]
  T3 --> T4["T4 · Fan-out shared column — readability-hard"]
  T4 --> T5["T5 · Centering / balance — readability"]
  T5 --> T6["T6 · Height compaction: push free right — optimize"]
  T6 --> T7["T7 · Width compaction: pack-left — optimize"]
```

_Read top→down as "senior to": a lower tier may use only the freedom the tiers above leave, and may never violate a higher one._

**Free vs pinned (the operative rule for T6/T7):** a node/hull is _pinned_ iff it is a member of some fan-out target set (T4) or moving it would break a T4/T5 relation; else _free_. T6 moves only free nodes. T7 moves free nodes individually and **fan-out groups as rigid units** (translating a group preserves its shared column and its hub's centering offset).

**Conflict-resolution examples (each user statement → tier interaction):**

- "Fan-out should stay in the same column _even though we are taller than we need to be_" → **T4 > T6**.
- "Center A on C, not inline with B" → **T5** (median, not first-child alignment).
- "Move free resources/hulls right to reduce vertical height" → **T6**, free only.
- "Post-pass, pack left and adjust Y so we are not excessively wide" → **T7**.
- "Apply fan-out + centering recursively to hulls" → T3/T4/T5 evaluated at the **LCA** at every level.
- "If one hull depends on another (one-way edge), place it deeper" → **T3** (hard).

---

## 6. Inputs & data model

### 6.1 Inputs (unchanged from today)

- `plan.json` (+ optional state) → resource nodes, types, attributes.
- `.tfd` → `bind` aliases + `A -> B` declared edges → `nodes[DECLARED_DATAFLOW_ORDERED_KEY]`.
- `graph.dot` → carried in bundles; not used for hop order.
- Topology placement via `buildPlacementMap` / `topologyAddressPlacementMap`.

### 6.2 Core types

```ts
type TopologyRole =
  | "root"
  | "provider"
  | "account"
  | "region"
  | "vpc"
  | "subnetZone"
  | "primaryCluster";

type PipelineCluster = {
  id: string;
  primaryAddress: string;
  firstSequence: number; // min TFD declaration order touching this cluster (tiebreak)
  depthFloor: number; // LB(v): longest-path column floor (CON-1)
  placement: PipelinePlacement; // topology path
  build: { skeleton; width; height; clusterFrameId };
};

type CompoundNode = {
  // a node in the compound tree T
  key: string;
  role: TopologyRole;
  level: number;
  minDescendantSequence: number; // min firstSequence over descendants (forced-stack ordering)
  cluster?: PipelineCluster; // set iff role === "primaryCluster"
  children: CompoundNode[];
  // filled during layout:
  box?: { x: number; y: number; width: number; height: number }; // local then global
  localColumn?: number;
};

type HullEdge = { from: string; to: string; weight: number; declared: boolean };
```

### 6.3 Derived structures (new)

- **Per-container hull-edge DAG** `D_H` (REQ-9):
  - _Up-projection:_ for each collapsed edge `u→v`, find the LCA container `H`; let `Cu`, `Cv` be the child subtrees of `H` containing `u`, `v`. If `Cu ≠ Cv`, add `Cu→Cv` to `D_H` (accumulate weight = count of underlying edges).
  - _Declared:_ add any `.tfd` edge already expressed between container addresses (the org spine) at the level where both endpoints are children of the same container.
  - `D_H` must be acyclic; a cycle triggers CON-2 localized fallback for `H`.
- **Fan-out / fan-in sets:** `out(u)`, `in(w)` over `D` (clusters) and over each `D_H` (hulls).
- **Slack:** `LB` from longest-path on `D`; `UB(v) = min over successors s of (col(s) − 1)`, with `UB = maxColumn` for sinks. `slack(v) = UB(v) − LB(v)`.

---

## 7. Algorithm specification

RCLL is one recursive procedure over the compound tree `T`. Each container runs four Sugiyama phases locally (layer → order → center → compact-Y via policy), is sized, and bubbles up. Two global passes follow (top-spine alignment, pack-left), then finalize. For each phase below: **Purpose · I/O · Options considered (papers) · Chosen · Why · How · Determinism · Complexity.**

```mermaid
flowchart LR
  P0["Phase 0 · Prep"] --> P1["Phase 1 · recursive per container (post-order)"]
  P1 --> P2["Phase 2 · top-spine align"]
  P2 --> P3["Phase 3 · pack-left"]
  P3 --> P4["Phase 4 · finalize + arrows"]
  subgraph inner["Phase 1 inner, per container"]
    direction LR
    a["1a layer (T1/T3/T4)"] --> b["1b push-right (T6)"] --> c["1c order (crossings)"] --> d["1d center (T5)"] --> e["1e size hull"]
  end
  P1 -.-> inner
```

### 7.1 Phase 0 — Prep (reuse + extend)

**Purpose.** Build placeable clusters, the TFD DAG, slack, the compound tree, fan-out sets, and the per-container hull-edge DAGs.

**I/O.** In: plan + `.tfd` + placement map. Out: `{ clusters, D, LB/UB/slack, tree T, fanout sets, D_H per container }`.

**How.** Reuse `preparePipelineLayout` (satellite collapse, edge collapse, skeleton build, `computeDepths` for `LB`). **Add:** `UB`/`slack` computation; compound-tree construction with explicit `root`/`primaryCluster` roles (per REGION_SUBNET `PackedTreeNode`); fan-out/fan-in sets; hull-edge up-projection (REQ-9). Cycle handling per CON-2 (localized).

**Determinism.** All maps iterated in `(firstSequence, key)` order. **Complexity.** `O(V + E)` for DAG/longest-path; `O(E · depth(T))` for up-projection (LCA via precomputed paths).

### 7.2 Phase 1 — Recursive container layout (post-order)

Visit `T` bottom-up. For container `H` with children `C₁…Cₖ` (each already sized with `box`):

#### (a) Layering — assign each child a **local column** (T1, T3, T4)

**Purpose.** Horizontal positions honoring TFD, the hull staircase, and fan-out column sharing.

**Options considered.**

- _Longest-path (ALAP/ASAP)._ Simple, `O(V+E)`; gives tight floors but no balancing. (Sugiyama [R1].)
- _Coffman–Graham width-bounded._ Bounds layer width; classic for "not too wide." ([R16].)
- _Network simplex (dot)._ Minimizes weighted total edge length; supports edge weights/min-lengths; enables `balance()`. ([R2].)
- _MinWidth / node promotion._ Explicit width control + dummy-node reduction. ([R3].)

**Chosen.** **Longest-path floors `LB` (T1/CON-1)** + **hull staircase from `D_H` (T3/CON-6)** + **fan-out pinning (T4):** every fan-out set's targets get a shared column = `max LB` over the set. Network-simplex/`balance()` is folded into Phase 1(b) as the slack-distribution mechanism rather than the base layering (keeps the base deterministic and edge-weight-free unless [FLEX-9](#4-requirements-catalogue) is set).

**Why.** Floors are the minimal structure that satisfies CON-1; the staircase satisfies CON-6; fan-out pinning is REQ-3. Deferring balancing to a separate, clearly-scoped step keeps the base layering trivially deterministic and lets T6 own all height optimization.

**How.** Longest-path on `D` restricted to `H`'s children for local columns; longest-path on `D_H` for the staircase order; union the two column constraints; for each `out(u)` with `≥2` targets in `H`, set all targets to `max LB`. Record `localColumn` per child.

**Determinism.** Longest-path is order-independent; ties broken by `firstSequence`. **Complexity.** `O(kH + EH)` per container.

#### (b) Free-node push-right — height compaction in X (T6)

**Purpose.** Use slack to let free children land in columns where they can **share a row** with others (fewer rows ⇒ less height), without disturbing pinned fan-out members.

**Options considered.**

- _Gansner `balance()`._ Move a node with slack to the **least-crowded** column among its feasible range. ([R2].)
- _MinWidth promotion._ Promote nodes to reduce the widest layer / dummy count. ([R3].)
- _Current group-uniform depth shift._ Coarse, moves whole units; overshoots (rejected, §3.2/§3.1).

**Chosen.** **`balance()`-style per-node slack distribution**, restricted to _free_ nodes, with the objective "minimize resulting row count of `H`" (estimated by the packing in (d)).

**Why.** Per-node (not per-group) granularity (fixes §3.2); single placement (no overshoot/undo, fixes §3.1); directly serves PREF-5 while respecting T1–T5.

**How.** For each free child in ascending `LB`, evaluate candidate columns in `[LB, UB]`; pick the one minimizing the incremental row count of the container's packing (d). This is a local, greedy, deterministic choice; pinned members are skipped.

**Determinism.** Candidate scan in fixed order; ties → smallest column then `firstSequence`. **Complexity.** `O(kH · slackMax)` candidate evaluations, each an incremental skyline test.

#### (c) Ordering — within-column sequence (PREF-2)

**Purpose.** Reduce crossings by sequencing nodes within each column (and ordering forced bands).

**Options considered.**

- _Barycenter / median heuristic._ Standard, fast, effective. ([R1].)
- _Sifting._ Better quality, slower. (Crossing literature.)
- _Forster compound crossing reduction._ Each crossing owned by a unique hierarchy node ⇒ minimize locally per container, sum globally. ([R7].)

**Chosen.** **Per-container barycenter** of cross-column neighbors, applied **only when it strictly reduces a measured crossing count**, else **model order** (`firstSequence`).

**Why.** Forster proves locality (this is the right scope); the "only if it reduces a measured count, else model order" rule keeps it deterministic and prevents the instability that disabled `balance()` in the current code (§3.5).

**How.** Compute barycenters from already-placed neighbor Y (available bottom-up); count crossings with a polyline-aware counter ([DEC-6](#14-open-design-decisions)); accept the reorder iff strictly fewer.

**Determinism.** Strict-improvement gate + stable tiebreak. **Complexity.** `O(kH log kH)` per column.

#### (d) Coordinate assignment in Y — centering + policy (T5, T2)

This is the phase the current engine lacks. Two sub-cases by the container's policy ([§8](#8-per-level-placement-policy)):

- **Forced-band children** → distinct bands, stacked top→down in `(D_H topological order, minDescendantSequence, key)`. A dependency staircase that makes two forced siblings X-disjoint **may** let the deeper one rise into the predecessor's Y-range ([DEC-1](#14-open-design-decisions)).
- **Packed children** → **center** each on the median Y of its connected neighbors (Brandes–Köpf, two-sided, size-aware), then **clamp** to `H`'s band and remove overlaps with a **single deterministic VPSC projection**.

Full detail in [§9](#9-coordinate-assignment-centering).

#### (e) Size the hull

`H.box = boundingBox(children) + PIPELINE_FRAME_PAD (+ title height)`. `H` now behaves as one box for its parent (Doğrusöz cart-on-cart [R8]; Sander [R6]).

### 7.3 Phase 2 — Top-spine global alignment (REQ-7)

**Purpose.** Make `root→provider→account` hops read as aligned columns across the whole diagram while keeping sub-hull columns local.

**Chosen / How.** After recursion, recompute a single global `columnX[]` for the spine levels from the org hull-edge DAG (longest-path on declared hull edges), translate each account subtree to its global spine column, preserve intra-account local columns. See [§11](#11-hybrid-column-model).

**Determinism/Complexity.** Longest-path on a small DAG; `O(#accounts)`.

### 7.4 Phase 3 — Pack-left width compaction (T7, REQ-8)

Detailed in [§10.2](#10-compaction-push-right--pack-left). Pull free nodes and whole fan-out groups left, adjust Y, toward the aspect target; never opens a row; never violates T1–T5.

### 7.5 Phase 4 — Finalize & compound semantics (reuse)

Translate local→global per subtree (`applyCompoundHierarchicalLayout`, normalization-only); emit hull frames as derived bboxes; append TFD arrows + hull→hull connectors; parent each arrow to its LCA frame; `convertToExcalidrawElements`; mirror labels, icons, visibility, z-order. See [§12](#12-edge-routing--compound-frame-parenting).

### 7.6 Reference pseudocode

```text
RCLL(H):
  for c in H.children: RCLL(c)                          # bottom-up sizing (7.2e gives H boxes)
  D_H   = upproject(H) ∪ declared_hull_edges(H)         # 6.3 / REQ-9
  cols  = longestPath(D restricted to H) ⋈ longestPath(D_H)   # 7.2a  T1+T3
  pin_fanout_columns(cols, fanoutSets(H))               # 7.2a  T4
  for c in freeChildren(H) by ascending LB:             # 7.2b  T6
      c.localColumn = argmin_{col in [LB,UB]} rowCount(pack(H | c@col))
  orderWithinColumns(H)                                 # 7.2c  PREF-2 (strict-improve gate)
  if policy(H.role) == FORCED:                          # 7.2d  T2
      placeForcedBands(H)        # staircase Y-overlap per DEC-1
  else:                                                 # 7.2d  T5
      centerY_median(H.children) ; clampToBand(H) ; vpscProject(H)
  H.box = bbox(H.children) + pad                        # 7.2e

# after the recursion returns to root:
alignTopSpineGlobal(root..account)                      # Phase 2  REQ-7
packLeft(aspectTarget)                                  # Phase 3  T7 (groups as units)
finalizeAndParentArrows()                               # Phase 4  REQ-10
```

---

## 8. Per-level placement policy

Each topology level has a **policy** selecting how its _children_ are placed in Y. Policy is chosen by the **parent role** (REGION_SUBNET plan convention), and each level is independently toggleable ([FLEX-1](#4-requirements-catalogue)).

| Parent role | Children placed | **Default policy** | Notes |
| --- | --- | --- | --- |
| `root` | providers | **forced band** | usually 1 provider |
| `provider` | accounts | **forced band** | org spine; staircase by hull edges (CON-6) |
| `account` | regions | **forced band** | dominant height driver on sparse graphs ([DEC-3](#14-open-design-decisions)) |
| `region` | VPCs + region-direct resources | **packed** (row-share) | center + VPSC |
| `vpc` | subnet zones + VPC-direct resources | **forced band** (subnet zones) + packed (direct resources) — **OR `swimlane`** when the VPC's `D_H` is cyclic (DEC-8(C)) | same-VPC subnets distinct Y bands; when cyclic, the bands become lanes over a **shared cluster column axis** so cross-subnet dataflow reads L→R |
| `subnetZone` | primary clusters | **packed** (row-share); a cyclic-VPC subnet is a **Y-lane** spanning its clusters' column range | center + VPSC |

**Forced policy semantics.** Children get disjoint vertical bands, ordered by `(topological order on D_H, minDescendantSequence, key)`; band advance uses the **title-aware** collision hull (`topologyFrameCollisionHull`). X position follows the staircase (CON-6). Y-overlap between X-disjoint staircase siblings is governed by [DEC-1](#14-open-design-decisions).

**Packed policy semantics.** Children are row-packed (push-right [§10.1](#10-compaction-push-right--pack-left) already chose columns) and centered ([§9](#9-coordinate-assignment-centering)); two children share a Y band only when their pad-inflated X spans are disjoint with clearance.

**Swimlane / staircase policy semantics (cyclic container, [DEC-8(C)](#14-open-design-decisions) refined, M3b).** When a container's hull graph `D_H` is **cyclic**, the forced/packed split is replaced by an **SCC decomposition** of the container's children (`arrangeCyclicContainer`):

- A **multi-hull SCC** — sibling hulls that are mutually dependent (a genuine 2-way cycle) — becomes one **swimlane**: its descendant clusters share **one** column axis (column = dense rank of their `LB` floor, so a TFD edge always crosses a column — CON-1/CON-12), and each member hull is a **Y-lane**. A subnet is therefore one contiguous frame **over multiple columns**, and cross-member dataflow `A→B→A` reads as forward column steps across vertically-separated lanes. Flattening the members onto the shared axis is **required** — only there do cross-member resource edges read forward. This is the **Sander [R6]** compound model.
- The **condensation** of the SCC groups (the one-way edges between them) is a DAG, laid out as a **staircase**: a dependent group gets a greater X (width-aware `columnOffsetsFromWidths`, CON-6) and its Y **rises** ([DEC-1](#14-open-design-decisions), `staircaseBandOverlap` default true) to share rows with X-disjoint groups — the height lever.
- A **singleton** SCC (no mutual cycle) recurses through the normal forced/packed policy (and re-enters this branch if it is itself cyclic), so the refinement is fully recursive — the axis is scoped **per SCC group**, never the whole container (this corrects M3a-h2's global dissolve, which put every account on one column-0 axis). The cluster graph `D` is acyclic, so hull cycles never force resource columns; the iron-rule gate excuses only genuine `D`-SCC edges ([§13](#13-invariants--acceptance-gates)).

**Why this default split.** Forced bands at provider/account/region/vpc give the clean ownership reading the user asked for; packed interiors (region resources, subnets, clusters) are where most height can be reclaimed without harming hierarchy reading. The split is the user's explicit "forced + packed" decision. [DEC-3](#14-open-design-decisions) flags that **region** is the highest-leverage level to _consider_ flipping to packed on tall/sparse graphs.

### 8.1 RCLL ancillary ("All resources") — reserved band (DEFERRED)

> **Status: DEFERRED, design + measurements recorded** (2026-06-18; DI-ANC-1..3, [§34.2](#342-implemented-vs-specified-delta-as-built-m3a-hardening)). RCLL draws the **dataflow only**; the unconnected ("Unconnected") resources that the compound/classic views render are omitted. The toggle is **disabled under RCLL** so it does not silently no-op (DI-ANC-1). This subsection is the build recipe for whoever lifts the limitation — including the two cheaper designs already **measured and rejected**, so they are not re-attempted.

**The target.** When "All resources" is on, render the unconnected resources as per-scope **"Unconnected" strips** scoped to their region/VPC — the existing `buildAncillaryStrips` / `layoutAncillaryStrip` / `ancillaryStripAsPseudoCluster` / `countAncillaryCards` primitives (in `terraformPipelineLayoutAncillary.ts` / `terraformPipelineLayoutShared.ts`) produce the strip skeleton + dims; only *placement into the RCLL geometry* is new.

**Dead ends (do not re-attempt — both measured/analysed on `staging-extended-localstack-v2`):**

1. **Column-leaf model injection** — inject each strip as a `role:"primaryCluster"` leaf into `buildRcllModel`. Rejected by code analysis: a strip is then a placement **column member**, so a wide strip widens its column (`columnWidths` → `columnOffsetsFromWidths`) and **reflows the dataflow**; it lands at the **bottom of column 0, beside** the downstream columns (not below the scope, `placePackedColumns`); and it **pollutes model metrics** — every leaf with `cluster` is counted as a `primaryCluster` (`summarizeRcllModel`), and `firstSequence: MAX_SAFE_INTEGER` leaks a sentinel into ordering.
2. **Export-phase placement** — keep strips out of the model; after `emitLeaves` places the dataflow, drop each strip below its scope's content in `buildSceneFromBoxedTree`, feed strip pseudo-clusters to `buildCompoundFramesFromLayoutBoxes` only. **Implemented and measured: zero model pollution, no column reflow, but 90 collisions (Compact) / 86 (Full).** Root cause: RCLL positions accounts/regions/VPCs in the **model phase**; the export phase (`applyCompoundHierarchicalLayout`) only re-stacks **providers** (v2 has one), so a strip grows a region hull into the next region and nothing re-stacks regions. The collisions were all among **connected** frames (`frame-title-primary-cluster`, `non-ancestor-topology-frame`, `region-region`), i.e. the unreserved-space failure.

**The correct design — model-phase reserved bottom band.** Add a new `RcllTopologyRole` value `"ancillaryBand"`. A band node is a leaf carrying the strip pseudo-cluster on `cluster`. Attach it under its container in the tree (region/VPC container key `==` `regionScopeKey`/`vpcScopeKey`); synthesize the container chain for an ancillary-only scope (mirror `buildCompoundTree`). In `sizeAndArrange`, split `ancillaryKids` from `normalKids`, run `columnWidths` + the policy over `normalKids` only, then place each band **full-width below the `normalKids` bbox in a disjoint Y region** — exactly the `mixed`-VPC pattern (`placeForcedBands` then `placePackedColumns` below). The container **footprint** (children bbox + pad) then spans the band, so the parent's stacking **reserves the space** → no collision; the band is not a column → no reflow; the role is distinct → `primaryClusterCount` stays clean.

**The interaction points a build MUST handle** (Codex, 2026-06-18) — these are why it is a real placement-engine milestone, not a "compose helpers" change:

- **Role-blindness.** Several placement paths treat *any* leaf with `cluster` as a dataflow leaf — `collectClusterLeaves` and the whole cyclic `arrangeByHullMatrix` engine (`denseClusterColumns`/`laneMinColumn`/`layoutLanesOnAxis`). A band inside a **cyclic** container would join an SCC group and participate in `colWidth`/`riseStackY`. Either exclude `ancillaryBand` everywhere a leaf-with-`cluster` is collected, or (smaller surface) **skip ancillary inside cyclic containers** as a documented sub-limitation.
- **Injection timing.** Inject band nodes **before `runRcllPipeline`** — layering and placement each `cloneNode` the tree (`cloneNode` already copies `role`+`cluster` generically). Inject after, and placement never reserves the space.
- **Determinism.** Re-run the bottom-up `finalizeTreeOrder` (or insert in canonical `(minDescendantSequence, key)` position) after injection.
- **Mandatory band-width cap.** The container footprint width still feeds the **parent's** `columnWidths`, so a band wider than its scope's dataflow widens the container and shifts siblings. Cap the band's `wrapWidth` to the scope's dataflow content width — then dataflow X is preserved and only **Y grows** (a band makes a container taller; downstream siblings shift down). "Strips appear" and "dataflow pixel-identical" cannot both hold; the accepted bar is **Y-growth + X-preserved**.
- **Empty `normalKids`.** For an ancillary-only container, place the band at `areaY` (not `bbox.maxY + gap`).

**Gate (when built):** collision 0 (Compact + Full, rendered `diagnostics.collisionCount` + `placementMeta`); `rcllModel.primaryClusterCount` identical ON vs OFF; dataflow column X unchanged; frame-parent chains correct (each card frame → strip "Unconnected" frame → region/VPC hull frame); determinism ×2; OFF byte-identical to the dataflow-only baseline.

---

## 9. Coordinate assignment (centering)

The heart of readability (T5; REQ-6; PREF-1/2/3). Our cross-axis is **Y** (transpose of the cited papers' "horizontal coordinate").

### 9.1 Goal

Place each node so it is **centered on the median Y of its connected neighbors**, in **both directions** (a hub centered over its fan-out targets; a convergence node centered over its sources), **clamped** to its hull band, with **no overlaps**.

### 9.2 Options considered

| Option | Source | Trade-off |
| --- | --- | --- |
| **Brandes–Köpf** median alignment (4 passes: up/down × left/right, then balance = average) | [R10] | Linear, deterministic, centers parents over children naturally; the standard. |
| **Size- & port-aware BK** | [R12] | Extends BK to real node sizes and ports (our cards/hulls have real sizes) — needed for correctness. |
| **Network-simplex x-coord (dot)** | [R2] | Higher quality straightening, heavier; not needed at our scale and less obviously deterministic. |
| **Flow formulation with prescribed width** | [R11] | Directly trades straightness vs cross-axis extent under a budget — the principled aspect knob (their width = our height). |
| **Priority method (classic Sugiyama)** | [R1] | Simple iterative; lower quality than BK. |

### 9.3 Chosen

**Brandes–Köpf, two-sided, size-aware** ([R10]+[R12]) for the desired Y, then **clamp + de-overlap via one deterministic VPSC projection** ([R14]/VPSC). The aspect/straightness trade ([R11]) informs the weight used when centering competes with height (T5 vs T6) but is applied as a static weight, not an iterative solve (CON-9).

### 9.4 Why

BK is linear-time, deterministic, and _by construction_ centers a node on its median neighbor — exactly "A centered on C, not inline with B." Size-aware is mandatory because our nodes are real rectangles. VPSC is the deterministic, single-shot way to enforce band separation (CON-5), containment (CON-3), and non-overlap (CON-4) after centering — no force loop (CON-9).

### 9.5 How

1. **Desired Y** `des(v)` = median Y of `v`'s placed neighbors (both directions). For a hub with an even-sized fan-out, median = midpoint of the two central targets (true centering).
2. **Cross-hull fan-out** ([DEC-2](#14-open-design-decisions)): when a fan-out set spans multiple forced bands (e.g. org root → three account hulls), evaluate the hub's `des` at the **LCA container** using the child-hull centers, then clamp to the hub's own band.
3. **Clamp** `des(v)` into `H`'s content band.
4. **VPSC projection** on the container's children: minimize `Σ wᵥ (yᵥ − des(v))²` subject to ordered separation constraints (band separation for forced policy; non-overlap with `PIPELINE_CLUSTER_GAP_Y` for packed). Weight `wᵥ` higher on the spine ([FLEX-9](#4-requirements-catalogue)).
5. **ε acceptance:** a hub is "centered" if `|y(hub) − des(hub)| ≤ ε` ([FLEX-5](#4-requirements-catalogue), [DEC-6](#14-open-design-decisions)); reported by the readability metric (REQ-11).

### 9.6 Determinism & complexity

BK is `O(V+E)`; the VPSC active-set projection is deterministic and near-linear in practice on the small per-container constraint sets. No randomness.

---

## 10. Compaction (push-right & pack-left)

Compaction is **subordinate** to T1–T5. Two distinct, single-purpose passes (replacing the current two-passes-that-fight design, §3.1).

### 10.1 Push-right (T6, height) — Phase 1(b)

Already specified in [§7.2b](#7-algorithm-specification). Key properties: per-node (not per-group); free nodes only; chooses each node's final column once (no overshoot); objective = minimize container row count. This is `balance()` ([R2]) restricted to free nodes with a packing-aware objective.

### 10.2 Pack-left (T7, width) — Phase 3

**Purpose.** After everything is placed, the diagram may be wider than necessary. Pull things left to approach the aspect target without re-introducing height.

**Options considered.**

- _Current separate pull-left pass._ Leftmost-feasible per cluster; geometric only; runs after a group-uniform push that overshoots (rejected as a pair, §3.1).
- _Order-preserving rectpacking (Domrös)._ Reading-direction, whitespace-elimination, model-order preserving. ([R13].)
- _Left-edge / FFDH level packing._ The concrete primitive. ([R15], [R16].)

**Chosen.** A single **order-preserving left-pack** ([R13]) that moves **free nodes individually** and **fan-out groups as rigid units** (a group translates with its shared column and centering intact), **never opening a new row**, toward the aspect target.

**Why.** "Never opens a row" guarantees it cannot fight T6 (height) — the two compaction passes are now orthogonal, not adversarial. Moving fan-out groups as units preserves T4/T5 (the user's explicit "move whole fan-out group as a unit" decision). Domrös gives the order-preserving guarantee that keeps the result readable.

**How.** Sweep columns left→right; for each free node / group, decrease its column to the minimum `≥ LB` that keeps it in its current row(s) without overlap and respects T1–T5; recompute `columnX`; stop when the aspect target is met or no move helps.

**Determinism & complexity.** Fixed sweep order; `O(V)` moves each with an `O(row)` overlap check.

---

## 11. Hybrid column model

**Decision (REQ-7):** _align the top spine globally; keep columns local below._

- **Global (spine):** `root → provider → account`. A single `columnX[]` is computed from the **declared org hull-edges** (`organization_root -> OUs -> accounts`) by longest-path; each account hull is translated so its left edge sits at its global spine column. Effect: account hops line up across the whole diagram (the org spine reads as a clean L→R staircase).
- **Local (interior):** inside each account, regions/VPCs/subnets/resources use the **local columns** computed during recursion (Phase 1a/b). A resource at "local hop 3" in account A need not share an X with "local hop 3" in account B.
- **Lane / staircase axis (cyclic interior, [DEC-8(C)](#14-open-design-decisions) refined, M3b):** when an interior container's `D_H` is **cyclic**, the container is SCC-decomposed (§8). Each **multi-hull SCC** gets ONE shared, container-local column axis (its members read L→R across that axis); the **condensation** staircases the SCC groups, each group keeping its own local axis. So the local-column boundary moves up to the **SCC group**, not the whole container — narrower than a single global axis (only mutually-cyclic hulls share). Still **local** (group-scoped), not global — REQ-7's hybrid model holds; the §3.4 width cost is bounded by the per-group distinct `LB` depths plus the staircase steps.

**Why not fully global (current design).** A single diagram-wide grid forces a deep narrow hull to reserve a full-width column everywhere, wasting space and capping packing (§3.4).

**Why not fully local.** Then the org spine would not read as aligned hops — losing the single most important top-level reading cue.

**Cross-account edges.** A resource→resource edge across accounts is drawn as a connector parented to the LCA (provider/root); the _account-level_ dependency (if any) is what drives the spine staircase (CON-6), not the individual resource edge.

**Swimlane interior lane-rise (M4, `swimlaneLaneRise`, DI-M4-3).** Inside a swimlane the members share one `denseRank(LB)` axis; their nested sub-hulls are **lanes**. By default (M3b) the lanes pure-Y-stack. With `swimlaneLaneRise` ON, each lane's frame is **tightened to its content shared-column range** (its descendant leaves' `[minCol, maxCol]`) — the lane's interior is counter-shifted so **every leaf keeps its absolute shared-column X** — and X-disjoint lanes then **rise to share Y rows** (the DEC-1 rise, applied to lanes). Because leaf X is preserved, the shared axis (hence CON-12 cross-member forwardness) is untouched; only Y compacts. The gain is bounded by how many lanes are X-disjoint — a lane containing a column-0 source spans from column 0 and cannot rise (the "everything starts at column 0" structure). Front-end A/B toggle "Swimlanes · Stacked / Risen", default OFF (== M3b). The global cross-provider ruler (above) stays deferred (§34.2).

---

## 12. Edge routing & compound frame parenting

- **TFD arrows:** one per collapsed edge, routed from source cluster box to target cluster box (center or binding point). Carry `relationship` with collapsed endpoints + original pre-collapse source/target/sequence (as today).
- **Hull→hull connectors:** for an edge whose endpoints diverge as siblings under their LCA, emit one aggregated connector between the two **hull frames**, stroke width scaled by aggregated **weight** (REQ-10; audit R5). Deduped per `(parentFrame, sourceFrame, targetFrame)`.
- **Frame parenting (group-drag, REQ-10/G7):** append each arrow id to the `children` of its **LCA topology frame** before `convertToExcalidrawElements`, so `getFrameDescendants` moves arrows with the frame. Cross-provider edges (empty LCA path) stay at scene root.
- **Centering for hubs uses binding points** where available ([R12] port-aware), so the arrow leaves the hub centered.

---

## 13. Invariants & acceptance gates

All must hold for every preset, in **Compact and Full**, on repeated runs. Each maps to a CON/REQ and a test.

| Gate | Assertion | Maps to |
| --- | --- | --- |
| **TFD order** | `col(u) < col(v)` for every collapsed edge (per-container and global). | CON-1 |
| **Hull staircase** | `col(A) < col(B)` for every hull→hull edge `A→B`; account order matches org `.tfd`. | CON-6 |
| **Containment** | Every child rectangle ⊆ parent content box. | CON-3 |
| **No overlap** | Final-scene categorized collision count = 0: `region-region`, `same-vpc-subnet-subnet`, `frame-title-primary-cluster`, `non-ancestor-topology-frame` (ancestor containment excluded). | CON-4 |
| **No sibling overlap** | At EVERY container, no two children **2D-overlap** (X∧Y): `siblingOverlapViolations = 0`. Policy-agnostic — covers forced bands, packed columns, swimlane lanes, AND risen SCC groups. The DEC-1 Y-rise is legal because risen groups stay X-disjoint (an X-disjoint Y-overlap is NOT a violation). | CON-4/CON-5 |
| **Fan-out columns** | Every fan-out set's targets share a column. | REQ-3/T4 |
| **Centering** | hub within ε of its fan-out median; convergence node within ε of its sources' median (post-clamp). | REQ-6/T5 |
| **Iron rule (no backward AND no same-column edge)** | `acyclicBackwardEdges = 0` **and** `acyclicSameColumnEdges = 0` (Compact **and** Full) — measured on placed **boxes** (`backwardEdgeGate`, on the box **left edge**). Excusal is **RE-BASED off the cluster graph `D`** (M3b, DI-M3b-3): `cyclic*` counts an edge only if its two clusters share a strongly-connected component of `D` (a genuine resource cycle) — NOT because their LCA *container* is cyclic (which would go blind once a whole provider is one cyclic container). `cyclic*` drawn via EXT-12; both **0 on v2** (`D` acyclic). | CON-12 |
| **Determinism** | Two builds byte-identical. | CON-8 |
| **Acyclic guard** | Cluster graph `D` cycles localized + excused (CON-2, gate keys off `D`-SCC). A per-container **`D_H` cycle is decomposed into SCCs** (DEC-8(C) refined, M3b): mutual 2-way SCC → swimlane, one-way condensation → staircase, so the interior reads strictly L→R. | CON-1/2 |

**On `semanticEdgeViolations` (two distinct notions — disambiguated).** The §13 *iron-rule* gate above is the normative one. The **rendered** `semanticEdgeViolations` metric in `terraformPipelineCollisionDiagnostics.ts` counts non-aggregated TFD arrows whose **target frame center-X reads left of the source** — a *backward-reading* count, NOT the CON-1/2 acyclic guard. It is **observed, not gated**, because it (a) goes blind in Full (primary-cluster frames carry no `terraformPrimaryAddress` ⇒ `frameByAddress` empty), and (b) in Compact double-counts the excused cyclic wrap-edges. The box-level `backwardEdgeGate` is authoritative; the rendered metric is a cross-check. ⚠️ The diagnostics counts arrows **regardless of `isDeleted`** (dataflow arrows are flagged `isDeleted` for visibility); a caller that pre-filters `!isDeleted` before `diagnosePipelineScene` reads a **false 0**.

Diagnostic instrument: port the REGION_SUBNET plan's `FinalSceneCollision` classifier + the audit's `terraformPipelineCollisionDiagnostics.ts`/`terraformPipelineSemanticAudit.test.ts`.

---

## 14. Open design decisions

Each: question · options · recommendation · reversal cost.

### DEC-1 — Forced-band Y-overlap on a staircase (largest height lever)

When a hull→hull dependency makes two forced siblings X-disjoint (the deeper one pushed right past the predecessor), may the deeper one rise to **overlap the predecessor's Y-range**?

- **(A) No** — bands never overlap in Y (literal "each its own band"). Tallest; simplest.
- **(B) Yes, on dependency only (recommended)** — a deeper, X-disjoint, dependent sibling may rise. Without this, hull-level push-right buys _no_ height (it only adds width), contradicting the height lever (T6/G3).
- **Reversal cost:** low — a single predicate in `placeForcedBands`.
- **Status: IMPLEMENTED at the HULL level (M3b, DI-M3b-6), default on (`staircaseBandOverlap`).** Step 0 showed v2's forced-band sites are all absorbed into one provider swimlane, so the lever was rebuilt where it actually bites: inside `arrangeCyclicContainer`, the X-disjoint **SCC groups** of the condensation staircase rise to share rows (`placeRiseStack`). `false` ⇒ sequential stack (taller). v2: −12% / −6% height, collision 0.

### DEC-2 — Cross-hull fan-out clamping

A hub whose fan-out targets live in different forced bands (e.g. `organization_root → workload / ingestion / security`) cannot be centered inside one band.

- **Recommended:** evaluate T4/T5 at the **LCA container**; center the hub on the child-hulls' median; clamp to the hub's own band.
- **Reversal cost:** low — affects only `des()` computation for cross-band hubs.

### DEC-3 — Default region policy (density tension)

On sparse presets, forced-band stacking of near-empty regions dominates height; RCLL's interior packing cannot touch it.

- **Options:** region **forced** (cleanest ownership, tallest) vs region **packed** (shorter, regions may share Y bands when X-disjoint).
- **Recommended:** keep **forced** as default but treat region as the first knob to flip ([FLEX-1](#4-requirements-catalogue)) on tall graphs; pair with [DEC-1](#14-open-design-decisions)(B).
- **Reversal cost:** trivial — it is a per-level toggle.
- **Status: DEFERRED (post-M3b).** On v2 the regions sit inside swimlane/staircase cyclic containers, not forced bands, so the region toggle has no v2 leverage yet. The `levelPolicy` wiring is deferred until a preset shows a reachable forced region level.

### DEC-9 — Mirror-width for a 2-way hull pair (optional, parked)

When two hulls share a genuine **2-way** edge, instead of stacking them as Y-lanes on a shared axis, they could **grow their X width to mirror each other** (symmetric, so the bidirectional flow reads as a reflection). Optional, **not built** (M3b parks it). Trigger only if a 2-way swimlane reads less clearly than a mirror on real data; local to the swimlane-group placement. Reversal cost: low.

### DEC-10 — Independence gap between co-column hulls (optional, parked)

When two **independent** sibling hulls (no edge between them) share a column under the decision matrix, an extra blank row could be inserted between them to **visually signal "no dependency"** (vs a coupled swimlane, which packs tight). Optional, **not built** (M4 parks it — independents pack tight for now). Trigger only if users misread independent co-column hulls as related; local to the lane/group placement. Reversal cost: low (a per-pair gap predicate). Companion to the M4 swimlane lane-rise (DI-M4-3/DI-M4-6).

### DEC-4 — Aspect target & authority

What is "horizontal but not excessive"?

- **Options:** fixed ratio (~16:9); viewport-fit; **height-first then pack-left** (the literal user phrasing).
- **Recommended:** **height-first then pack-left** for v1 (matches the user's words), with a Jünger–Mutzel–Spisla-style width budget ([R11]) available as a later knob ([FLEX-3](#4-requirements-catalogue)).
- **Reversal cost:** medium — changes the T7 stopping criterion and possibly the centering weight.

### DEC-5 — Dummy nodes for column-skipping edges

BK straightens long edges best with dummy-node chains (element-count cost).

- **Recommended:** **off in v1** ([FLEX-6](#4-requirements-catalogue)); revisit if straightness targets aren't met.
- **Reversal cost:** medium — adds a dummy-insertion step + element bookkeeping.

### DEC-6 — Centering ε and crossing metric fidelity

- **Recommended:** choose ε (e.g. ≤ ½ `PIPELINE_CLUSTER_GAP_Y`) and a **polyline-aware** crossing counter before trusting absolute readability numbers (current metric is a straight chord).
- **Reversal cost:** low — metric/threshold only.

### DEC-7 — Huge fan-out handling (surfaced by §26)

A single source fanning out to many targets (e.g. `1 → 200`) makes the shared fan-out column (T4) extremely tall.

- **Options:** (A) keep one tall column (faithful, may need scrolling); (B) **wrap** the fan-out into a multi-column grid block within the hop (compact, but breaks the "one clean column" reading); (C) wrap only past a threshold `N`.
- **Recommended:** (C) one column until `|out(u)| > N` (e.g. 24), then grid-wrap inside the hop band; expose `N` as a tunable.
- **Reversal cost:** low — local to the fan-out placement module.

### DEC-8 — Cycle handling within a strongly-connected component (surfaced by §27)

CON-2 says cycles fall back **locally**, but not _how_ the SCC's internal order is drawn.

- **First, classify the cycle.** A `D_H` cycle is almost always **spurious**: the cluster graph `D` is acyclic (Terraform forbids resource cycles), but up-projecting `D`'s edges to coarse hulls can make two sibling hulls mutually depend (e.g. a NAT `public→private` + a reverse SG `private→public`). A **genuine** `D` cycle (a real resource SCC) is the rare case. v2 has **6 cyclic containers, all spurious; 0 genuine.**
- **Options:** (A) **break the cycle** with a minimum feedback-arc-set heuristic and draw one edge as a visible back-edge; (B) collapse the SCC and **model-order stack** its members in a shared column band (one shared `localColumn`), marking a `pipeline_cycle` warning; **(C) for a SPURIOUS cycle, promote the interior to a shared cluster column axis** ("swimlane"): the container's descendant clusters are columned by their global `LB` floor and its sibling hulls become **Y-lanes** spanning column ranges, so every (acyclic, cluster-level) edge reads strictly L→R.
- **Status: (C) IMPLEMENTED + REFINED per-SCC (M3b, DI-M3b-1); (B) SUPERSEDED; (A) reserved for a genuine `D` cycle.** M3a-h2 dissolved the *whole* cyclic container onto one shared axis (`arrangeLaneSubtree`). **M3b decomposes the container's `D_H` into SCCs** (`arrangeCyclicContainer`): a **multi-hull SCC** (mutual 2-way cycle) → one swimlane on a shared `denseRank(LB)` axis (flatten required for CON-12); the **one-way condensation** → a staircase (greater X) + DEC-1 Y-rise. The axis is scoped **per SCC group**, not the whole container — so genuinely-independent sub-hulls separate in X and the Y-stack collapses (v2: −12%/−6%). The iron-rule gate is re-based off cluster-graph `D` SCCs (DI-M3b-3) so it stays honest when most edges sit under a cyclic container. **Why (B) was wrong here:** collapsing the spurious SCC to one column made the sibling hulls read **same-column** (the user's extended iron rule, CON-12, forbids two TFD-related resources sharing a column) — it cured backward edges by introducing same-column edges. (C) dissolves the spurious cycle instead of accepting it. **v2 result: `acyclicBackwardEdges = acyclicSameColumnEdges = 0`, both modes; 0 wrap-edges remain to style** (the previous 11/22 backward reads are gone — they were an artifact of (B), not real cycles). For a **genuine** `D` cycle, lane mode still runs (cluster `LB` falls back to `firstSequence`), any residual wrap-edge surfaces as an excused `cyclic*` count and is styled via EXT-12; (A) feedback-arc-set is the path to a single designated back-edge if desired. The M2 SCC condensation (DI-M3a-12) is retained as the deterministic per-container layering contract but **no longer drives placement**.
- **Reversal cost:** medium — changes the placement of the affected subtree (behind the `pipelineLayoutVariant` flag).

---

## 15. Alternatives considered (whole-approach)

Each with its literature, so the design can pivot.

| Alternative | Description | Papers | Why not chosen |
| --- | --- | --- | --- |
| **Merge current push/pull sweeps** | Keep the two-pass packer but unify sweeps. | (internal) | Still global-grid-bound (§3.4), group-uniform (§3.2), no ordering/centering — doesn't reach the readability goal. |
| **Full constraint solver (stress / IPSep-CoLa)** | Treat the whole scene as one constrained optimization, iterate to convergence. | IPSep-CoLa [R17]; stress majorization | Non-deterministic / slow at v2 scale; violates CON-8/CON-9. We borrow only the **one-shot VPSC projection** ([R14]) as a finisher. |
| **Top-down scaling compound** | Fix parent sizes, scale children to fit; hide detail by zoom. | Kasperowski–von Hanxleden [R9]; ELK `topdownLayout` | Hides detail via scale; we need full-detail static (N5). Cited as recursion precedent only. |
| **Network-simplex reassignment alone** | Re-rank with dot's network simplex + balance, keep current packer. | Gansner [R2] | A _component_ of RCLL (Phase 1a/b), not a whole solution — no nesting recursion, no centering, no fan-out columns. |
| **Treemap / squarified packing** | Pack hulls as a treemap for area efficiency. | treemap literature | Destroys L→R dataflow reading; topology becomes area, not flow. |
| **Pure tidy-tree (Reingold–Tilford/Walker)** | Treat as a tree, contour-pack. | [R18][r19][R20] | The graph is a DAG, not a tree; but its **contour-merge + parent-centering** ideas are reused inside packed containers. |
| **Bounded-span upward-planar** | Bound edge span to compact. | Span literature | Requires edge reversal/relaxations incompatible with hard TFD order. |
| **RCLL (chosen)** | Recursive compound Sugiyama + priority lattice + hybrid columns. | [R1][r2][R6][r7][R8][r10][R11][r12][R13][r14] | Matches the user's mental model exactly; deterministic; localizes failure; per-node + per-hull granularity; one algorithm + a few dials. |

---

## 16. Complexity, performance & determinism budget

- **Complexity.** Phase 0 `O(V+E)`. Phase 1 per container `O(kH log kH + EH + kH·slack)`; summed over the tree `≈ O((V+E) log V)` for realistic slack. Phase 2 `O(#accounts)`. Phase 3 `O(V·row)`. No super-linear blowups; comparable to the current packer.
- **Performance.** Pipeline layout runs on the main thread (CON-9). On v2 (~145 edges, ~hundreds of clusters) the constant factors are small; the VPSC projection runs on tiny per-container constraint sets. Target: no worse than today's packed path (which already does multiple relaxation sweeps).
- **Determinism (CON-8).** Every ordering uses `(firstSequence, topology key, id)`; barycenter reorder is gated on strict improvement; VPSC active-set is deterministic. No RNG, no time-dependent state.
- **Caching.** Like packed/semantic today, RCLL output should **skip** (or extend the key of) the KV layout cache until the cache key includes the new dials ([FLEX-1..9](#4-requirements-catalogue)).

---

## 17. Verification & metrics

Extend the existing harness (no browser for core checks).

**New readability metrics (REQ-11):**

- Fan-out column rate (target ~100 %).
- Hub-centering rate within ε (target high; pick ε per [DEC-6](#14-open-design-decisions)).
- Median edge ΔY (target ↓ from 350–1,221 px).
- Near-straight % (target ↑ from 12–17 %).
- Aspect ratio W:H vs target.

**Geometry / correctness:**

- `terraformPipelineLaneDebug.test.ts` (`VITEST_TERRAFORM_VERBOSE=1`): before/after height/width on v2 vs baselines (stacked ~18.5k px; packed ~7.5k px).
- Final-scene categorized collision diagnostic = 0, `semanticEdgeViolations = []` (Compact **and** Full).
- Order invariants: `col(u)<col(v)` for clusters and hull edges; org staircase matches `.tfd`; fan-out column equality.

**Determinism:** build twice; compare geometry byte-for-byte.

**Kernel unit tests:** push-right shares a row only when X-disjoint; free vs pinned classification; pack-left never opens a row and moves fan-out groups as units; centering within ε; cycle → localized fallback.

**Manual:** `yarn seed:terraform-presets && yarn start`; import v2; verify L→R spine staircase, hubs centered over fan-outs, fan-outs column-aligned, drag a hull moves contents + arrows.

Commands:

```bash
VITEST_TERRAFORM_VERBOSE=1 yarn vitest run \
  packages/excalidraw/components/terraformPipelineLaneDebug.test.ts -t "staging-extended-localstack-v2"
yarn vitest run packages/excalidraw/components/terraformPipelineLayout.test.ts
yarn vitest run packages/excalidraw/components/terraformPipelineLayoutCompound.test.ts
yarn vitest run packages/excalidraw/components/terraformPipelineLayoutPacked.test.ts   # replaced/retired
```

---

## 18. Migration, rollout & toggle consolidation

- **Build behind a flag** (e.g. `pipelineLayoutVariant: "rcll"`), keeping the existing builders until RCLL passes the gates on all presets.
- **Consolidation target:** RCLL supersedes `Stacked / Packed / Packed+pull-left / Semantic`. The surviving dials become: **per-level forced/packed policy** ([FLEX-1](#4-requirements-catalogue)), **aspect target** ([FLEX-3](#4-requirements-catalogue)), and the [DEC-1](#14-open-design-decisions) staircase toggle. `Compact/Full` (detail) and `Dataflow-only/All` (which resources) remain orthogonal **content** toggles. `Classic/Compound` collapses: RCLL always produces compound frame parenting (group-drag) — "Classic" (arrows at root) becomes unnecessary.
- **Cache:** extend the KV layout cache key with the RCLL dials, or skip cache for RCLL until then.
- **Docs:** update `terraform-pipeline-import-agent-guide.md` and `terraform-pipeline-compound-import-guide.md` to describe RCLL and retire the four-toggle matrix.

---

## 19. References

Corpus IDs are local `graph-layout-rag` `doc_id`s (deep-read via the skill: resolve `localPath` from `data/manifest.json`, then extract). Public links/DOIs given where known. Tier/role annotations show where each is used (or why an alternative is listed).

**Core framework**

- **[R1] Sugiyama, Tagawa, Toda — _Methods for Visual Understanding of Hierarchical System Structures_**, IEEE SMC 1981. doi:10.1109/TSMC.1981.4308636. — The four-phase framework (layer/order/coordinate) RCLL runs recursively. _(T1, PREF-2/3)_
- **[R2] Gansner, Koutsofios, North, Vo — _A Technique for Drawing Directed Graphs_ (dot)**, IEEE TSE 1993. doi:10.1109/32.221135 · https://graphviz.org/documentation/TSE93.pdf · corpus `gansner-tse93`. — Network-simplex ranks; `balance()` slack distribution. _(T1, T6)_
- **[R3] Nikolov, Tarassov, Branke — minimum-width layering / node promotion** (and Kiel _Minimum-Width Layerings_ revisit). corpus `kiel-minimum-width-layering`, `openalex-10-21941-bii-1701`. — Width control + dummy-node reduction at layering. _(T6, alternative for 7.2a)_
- **[R4] Rüegg — _Sugiyama Layouts for Prescribed Drawing Areas_**, KCSS 2018/1 (dissertation). corpus `forward-10-21941-kcss-2018-1`. — Fitting layered drawings to a prescribed area / aspect. _(PREF-4, DEC-4)_
- **[R5] Jabrayilov, Mallach, Mutzel, Rüegg, von Hanxleden — _Compact Layered Drawings of General Directed Graphs_**, GD 2016, LNCS 9801. doi:10.1007/978-3-319-50106-2*17 · arXiv:1609.01755 · corpus `forward-10-48550-arxiv-1609-01755`. — Bounding one axis to fix aspect (they reverse arcs; we use slack + recursion since TFD is hard). *(PREF-4/5)\_

**Compound / recursive**

- **[R6] Sander — _Layout of Compound Directed Graphs_**, Tech. Report A/03/96, Univ. des Saarlandes, 1996. corpus `sander-compound-directed-graphs`. — Clusters span the contiguous level range of their children; hulls derived. _(T2, REQ-1)_
- **[R7] Forster — _Applying Crossing Reduction Strategies to Layered Compound Graphs_**, GD 2002, LNCS 2528. doi:10.1007/3-540-36151-0*26 (see also Forster, \_Crossings in Clustered Level Graphs*, dissertation 2005). — Crossing ownership per hierarchy node ⇒ minimize locally per container. _(PREF-2, 7.2c)_
- **[R8] Doğrusöz, Giral, Çetintaş, Çivril, Demir — _A Compound Graph Layout Algorithm for Biological Pathways_ (CoSE)**, GD 2004, LNCS 3383. doi:10.1007/978-3-540-31843-9*45 · corpus `s2-10-1007-978-3-540-31843-9-45`. — Recursive "cart-on-cart" nested layout. *(REQ-1)\_
- **[R9] Kasperowski, von Hanxleden — _Top-Down Drawings of Compound Graphs_**, 2023. arXiv:2312.07319 · corpus `openalex-10-48550-arxiv-2312-07319`. Plus ELK `topdownLayout` / `hierarchyHandling=INCLUDE_CHILDREN` / `aspectRatio` — https://eclipse.dev/elk/reference. — Recursive compound precedent; **rejected scaling** (N5). _(alternative, §15)_

**Coordinate assignment / centering**

- **[R10] Brandes, Köpf — _Fast and Simple Horizontal Coordinate Assignment_**, GD 2001, LNCS 2265. doi:10.1007/3-540-45848-4*3 · corpus `brandes-koepf-horizontal-coordinate-assignment`. Erratum: arXiv:2008.01252 · corpus `forward-10-48550-arxiv-2008-01252`. — Median alignment → centers hub over fan-out; our axis is Y. *(T5, REQ-6)\_
- **[R11] Jünger, Mutzel, Spisla — _A Flow Formulation for Horizontal Coordinate Assignment with Prescribed Width_**, GD 2018, LNCS 11282. doi:10.1007/978-3-030-04414-5*13 · corpus `forward-10-1007-978-3-030-04414-5-13`, `jgaa-2417`. — Straightness vs cross-axis extent under a budget (their width = our height). *(PREF-3/4, T5-vs-T6/T7, DEC-4)\_
- **[R12] Rüegg, Schulze, Carstens, von Hanxleden — _Size- and Port-Aware Horizontal Node Coordinate Assignment_**, GD 2015, LNCS 9411. doi:10.1007/978-3-319-27261-0*12 · corpus `doi-10-1007-978-3-319-27261-0-12`. — BK with real node sizes + ports. *(T5, REQ-6, §12)\_

**Constraints / packing**

- **[R13] Domrös — _Model Order_ (rectpacking in ELK)**, KCSS 2025/3. doi:10.21941/kcss/2025/3 · corpus `openalex-10-21941-kcss-2025-3`. — Order-preserving rectangle packing, reading-direction, whitespace elimination. _(T7, REQ-8, §10.2)_
- **[R14] Dwyer, Marriott, Stuckey — _Fast Node Overlap Removal_ (VPSC)**, GD 2005, LNCS 3843. doi:10.1007/11618058*15. And \*\*Dwyer, Marriott, Wybrow — \_Topology-Preserving Constrained Graph Layout*\*_, GD 2008, LNCS 5417. doi:10.1007/978-3-642-00219-9_22 · corpus `doi-10-1007-978-3-642-00219-9-22`. — Deterministic 1-D separation/containment projection used once on Y. _(T2 enforce, §9.5)\*
- **[R15] Freivalds, Doğrusöz, Kikusts — _Disconnected Graph Layout and the Polyomino Packing Approach_**, GD 2001, LNCS 2265. doi:10.1007/3-540-45848-4*30 · corpus `doi-10-1007-3-540-45848-4-30`. — FFDH level packing primitive. *(§10)\_
- **[R16] Coffman, Graham — _Optimal Scheduling for Two-Processor Systems_**, Acta Informatica 1972. doi:10.1007/BF00288685. (Width-bounded layering = transposed scheduling; see also Healy & Nikolov, _Hierarchical Drawing Algorithms_, Handbook of Graph Drawing & Visualization, CRC 2013, corpus `handbook-hierarchical`.) _(7.2a/b alternative)_
- **[R17] Dwyer, Koren, Marriott — _IPSep-CoLa: An Incremental Procedure for Separation Constraint Layout of Graphs_**, IEEE TVCG 2006. doi:10.1109/TVCG.2006.156. _(alternative, §15)_

**Tree packing (reused inside packed containers)**

- **[R18] Reingold, Tilford — _Tidier Drawings of Trees_**, IEEE TSE 1981. doi:10.1109/TSE.1981.234519 · corpus `doi-10-1109-tse-1981-234519`. _(parent-centering aesthetic)_
- **[R19] Buchheim, Jünger, Leipert — _Improving Walker's Algorithm to Run in Linear Time_**, GD 2002. doi:10.1007/3-540-36151-0*32 · corpus `doi-10-1007-3-540-36151-0-32`. *(contour merge)\_
- **[R20] van der Ploeg — _Drawing Non-Layered Tidy Trees in Linear Time_**, SPE 2013. doi:10.1002/spe.2213 · corpus `doi-10-1002-spe-2213`. — Variable node sizes; the analog for packing variable-size hulls. _(§10, REQ-1)_

---

## 20. Appendix A — worked example: the v2 org spine

`pipeline.tfd` declares (abbreviated):

```text
organization_root -> workloads_ou, data_platform_ou, security_ou      # fan-out (hub)
workloads_ou      -> workload_account
data_platform_ou  -> ingestion_account
security_ou       -> security_account
workload_account  -> ecs_producer, queue_consumer, ecs_alb            # fan-out inside account
ingestion_account -> ingest_fifo_queue, kinesis_*, eks_cluster, ...
security_account  -> cloudtrail_org, config_recorder, audit_bucket, ops_topic
```

RCLL behavior:

1. **Hull-edge up-projection** (REQ-9) at `root`/`provider`: `organization_root` fans out to three **account hulls** → `D_root` has `org → {workload, ingestion, security}` (hull→hull, declared).
2. **T4 at root:** the three account hulls **share a column** (one→many). **T3/CON-6:** each is right of `organization_root`'s column. **Phase 2** aligns these on the global spine grid (REQ-7).
3. **T5 / DEC-2:** `organization_root` is **centered** on the median Y of the three account hulls (centered on `ingestion`, the middle one — _not_ aligned to `workload`).
4. **Forced bands (CON-5):** the three accounts occupy distinct Y bands; with [DEC-1](#14-open-design-decisions)(B), because they're X-disjoint from the org root they may rise beside it, shortening the spine.
5. **Inside each account (recursion):** e.g. `workload_account → {ecs_producer, queue_consumer, ecs_alb}` is a fan-out → those three share a **local** column and `workload_account`'s entry is centered on them; the long `api1..api16` cascade lays out as L→R hops; **free** resources (e.g. `ops_topic`, forced deep by a single late edge) are **pushed right** only if free, then **packed left** as a group/individual to trim width.

Result: a left-to-right org staircase, hubs centered over fan-outs, fan-outs column-aligned, accounts in clean bands, height reclaimed where slack exists, width trimmed by pack-left.

---

## 21. Appendix B — implementation file map

Rewrite-friendly (per the user). Likely touched:

| File | Change |
| --- | --- |
| `terraformPipelineLayoutShared.ts` | Prep extensions: `UB`/`slack`, compound tree with `root`/`primaryCluster` roles, fan-out sets, hull-edge up-projection; layering (7.2a). |
| `terraformPipelineLayoutPacked.ts` | **Retired/replaced** by the RCLL kernel (push-right 7.2b, pack-left §10.2). |
| `terraformPipelineTopologyFrames.ts` | Hull-edge DAG helpers; role additions; derived hull boxes. |
| **new** `terraformPipelineCoordinateAssignment.ts` | Brandes–Köpf size-aware centering + VPSC projection (§9). |
| `terraformPipelineLayoutCompoundHierarchy.ts` | Stays normalization-only (local→global translate, metadata stamp). |
| `terraformPipelineLayoutFinalize.ts` | Arrows + hull→hull connectors + LCA frame parenting (§12). |
| `terraformLayoutCore.ts` | Route `pipelineLayoutVariant: "rcll"`; thread the new dials. |
| `terraformPipelineCollisionDiagnostics.ts` / audit test | Final-scene categorized collision gate (§13) + readability metrics (REQ-11). |
| `TerraformImportDialog.tsx` / session / URL params | Consolidated dials (§18). |

---

## 22. Modular ("Lego") pipeline architecture

RCLL is deliberately built as a sequence of **stages**, each implemented by a swappable **module**. The goal is that pieces — the layering strategy, the router, the compaction passes, the visual encoding — can be replaced or adjusted independently ("like Lego") without breaking correctness or one another.

```mermaid
flowchart LR
  S0["0 Prep"] --> S1a["1a Layer"] --> S1b["1b Push-right"] --> S1c["1c Order"] --> S1d["1d Center"] --> S1dp["1d+ Straighten"] --> S2["2 Spine"] --> S3["3 Pack-left"] --> S4["4 Route"] --> SR["R Encode"]
  SX["X Cross-cutting · determinism · no-back-edge · collision + faithfulness gates"] -. guards every stage .-> S0
```

_Each stage is a pluggable module; the priority lattice (§5) is the interface contract every module must honor (§22.1)._

### 22.1 The module contract — the priority lattice _is_ the interface

The thing that makes the pieces composable is the **priority lattice (§5)**. It is not just a conflict-resolution device; it is the **contract every module must honor**:

- **Input:** the partially-laid-out compound tree + lattice state (column floors `LB`/`UB`/slack, fan-out/fan-in sets, per-container hull-edge DAGs, current boxes).
- **Output:** an updated tree that **still satisfies every tier at or above the module's own tier**, and is **deterministic** (CON-8).
- **Rule:** a module may optimize only tiers at or below its own; it must **never violate a higher tier**. (E.g. a compaction module — tier T6/T7 — may move free nodes but must not break a fan-out column (T4) or a forced band (T2).)

Because the contract is the lattice, **any** module that preserves T1–T5 can be dropped in. This is why every item in §23 can be expressed as a pluggable module (or an additional pass) rather than a rewrite.

### 22.2 Stage / strategy registry

| Stage | Default module | Swappable alternatives | Tiers it may touch |
| --- | --- | --- | --- |
| **0 Prep** | satellite + edge collapse; compound tree; floors `LB`; slack `UB`; fan-out sets; hull-edge up-projection | _(fixed)_ | builds T1/T3/T4 inputs |
| **1a Layering** | longest-path floors + hull staircase + fan-out pinning | network-simplex (Gansner [R2]); Coffman–Graham [R16]; MinWidth / node promotion [R3] | T1, T3, T4 |
| **1b Height compaction** | `balance()` push-right of _free_ nodes | off; MinWidth promotion [R3] | T6 (within T1–T5) |
| **1c Ordering** | barycenter w/ strict-improvement gate | sifting; off | PREF-2 (crossings) |
| **1d Coordinate (Y)** | forced-band placement OR Brandes–Köpf size-aware centering + VPSC clamp [R10][r12][R14] | priority method [R1]; network-simplex x-coord [R2] | T5 (clamped by T2) |
| **1d+ Path straightening** | off | spine-scoped whole-path straightening (± dummy nodes) [R10] | PREF-3 (within T5) |
| **2 Spine alignment** | hybrid (global top spine, local below) | fully global; fully local | T3 / REQ-7 |
| **3 Width compaction** | order-preserving pack-left, fan-out groups as units [R13] | off; aspect-targeted [R4][r11] | T7 |
| **4 Routing** | straight arrows + LCA frame parenting | orthogonal + ports [R29]; edge-path bundling [R27] | rendering (no tier) |
| **R Encoding (render)** | current styling | hull tinting + spine color + legend; salience / focus+context; grid-snap | rendering (no tier) |
| **X Cross-cutting** | determinism, no-back-edge, collision gate | mental-map preservation [R26]; faithfulness metric [R28]; aspect/viewport target [R4][r11] | guards T1–T5 |

> Implementation note: model each stage as a function `(tree, lattice, options) → tree` with the contract above; register strategies in a small table keyed by `options`. The new dials in §18 select modules; defaults reproduce the recommended RCLL behavior.

---

## 23. Human-factors readability — principles, engine practice & optional extras

This section catalogues readability enhancements. Most are **optional extras** (pluggable modules per §22). Each carries **Pros / Cons / Fit / Default / Rec** so reviewers can include, defer, or drop it. The corpus already contains nearly all the underlying research (IDs below).

### 23.1 Principles ranked by evidence

| Rank | Principle | Evidence (corpus `doc_id`) | RCLL action |
| --- | --- | --- | --- |
| 1 | **Minimize edge crossings** — by far the strongest comprehension factor. | Purchase `doi-10-1007-bfb0021827`, `doi-10-1016-s0953-5438-00-00032-1`, `s2-10-1007-3-540-44541-2-2` | EXT-1 (Stage 1c primary objective). |
| 2 | **Support path-tracing** — people read along geodesic paths; smooth, monotone paths read faster. | Huang/Eades/Hong `doi-10-1109-pacificvis-2009-4906848`, `doi-10-1057-ivs-2009-10` | EXT-2 (whole-path straightening). |
| 3 | **Few bends + one consistent direction.** | Purchase (bends); layered core [R1] | EXT-12; routing (Stage 4). |
| 4 | **Symmetry / alignment / equal spacing** — weaker but positive; isomorphic substructures identical. | Purchase; Ware `doi-10-1057-palgrave-ivs-9500013` | EXT-7. |
| 5 | **Preserve the mental map** across expand / re-import. | Archambault & Purchase `openalex-10-1007-978-3-642-36763-2-42`, `openalex-10-1007-978-3-540-70904-6-19` | EXT-9. |
| 6 | **Faithfulness** — geometry must not imply false relationships. | `crossref-10-1007-978-3-642-36763-2-55`, `arxiv-2208-14095v1`, `s2-10-1109-pacificvis60374-2024-00029` | EXT-10. |
| 7 | **Manage clutter via level-of-detail** — overcrowding is the #1 practitioner complaint. | LOD `openalex-10-1109-tvcg-2012-238`; fisheye `graphviz-fisheye`; overview+detail `doi-10-1109-tvcg-2008-130` | EXT-8. |

### 23.2 How the engines organize for readability

| Engine | Mechanisms worth borrowing |
| --- | --- |
| **Graphviz / dot** | Network-simplex ranks; crossing min by **median + transpose**; **spline** routing; `rankdir=LR`; `weight`/`constraint`/`group`/`samerank`; `nodesep`/`ranksep`; `subgraph cluster_*`. |
| **ELK Layered** | Brandes–Köpf placement; orthogonal/polyline/spline `edgeRouting`; **port constraints/sides** (dataflow ports); `hierarchyHandling=INCLUDE_CHILDREN`; **`considerModelOrder`** (stability); `aspectRatio`; rich `spacing`. (`elk-eclipse-layout-kernel-arxiv`, `elk-dagre-engine-docs`.) |
| **Mermaid (dagre / ELK)** | dagre = simple layered default; ELK for complex graphs; `direction LR`; subgraph containers. |
| **D2 / TALA** | **TALA is purpose-built for software-architecture readability**: container-aware, near-orthogonal, grid-like, keeps related things together; D2 `grid` layouts. (Product — see harvest.) |
| **Structurizr / C4** | **Level-of-abstraction discipline** (Context→Container→Component); auto-layout + manual nudges; **auto-generated legend**. (Simon Brown.) |
| **Ilograph** | Interactive **perspectives** + hierarchy navigation (LOD / overview+detail). |
| **Cloudcraft / Hava** | Auto-group by **account/region/VPC/subnet**; explicit boundary containers; consistent vendor icons. |
| **draw.io / vendor guides** | Containers/swimlanes for boundaries; **color = environment** paired with pattern; compact legend (solid=sync, dashed=async). |

### 23.3 Optional extras catalogue

Each maps to a stage/module in §22.2.

**Edge & path (Stages 1c / 1d+ / 4)**

- **EXT-1 — Crossing-reduction as a first-class objective.** Promote crossing minimization from a strict-improvement tiebreak to a primary objective (allow modest extra height/width to cut crossings).
  - _Pros:_ Crossings are empirically the #1 readability factor (Purchase) — biggest legibility win per unit effort.
  - _Cons:_ Can fight compaction (crossing-free layouts are sometimes larger); needs a **polyline-aware** crossing counter (today's straight-chord metric mis-counts elbow arrows); adds compute.
  - _Fit:_ Stage 1c (ordering). _Default:_ **on**. _Rec:_ **yes** — highest ROI.
- **EXT-2 — Whole-path straightening (geodesic continuity).** Straighten an entire TFD chain (org→account→trunk→api→datastore) into one smooth, monotone line, not edge-by-edge.
  - _Pros:_ People trace _paths_, not edges (Huang/Eades/Hong); a straight spine is far easier to follow.
  - _Cons:_ Straightening column-skipping edges needs **dummy nodes** (extra elements/bookkeeping); straightening one path can bend others (must choose which paths win — the spine).
  - _Fit:_ Stage 1d+. _Default:_ **off** (spine-scoped opt-in). _Rec:_ **yes, scoped** to spine/critical paths; dummy nodes are a separate decision (DEC-5).
- **EXT-3 — Orthogonal routing + ordered ports.** Right-angle routing leaving source-right, entering target-left, with ports ordered to avoid near-node crossings.
  - _Pros:_ Reads like a **pipeline/circuit** — the exact mental model here; this _is_ a dataflow diagram; ELK and D2/TALA default to it; aligns with the column structure. Ports = Excalidraw binding points.
  - _Cons:_ Adds **bends** (Purchase: bends hurt, less than crossings); routing + port assignment is real engineering (channel/track assignment); can look busy if overused.
  - _Fit:_ Stage 4 (routing). _Default:_ **toggle** (orthogonal vs smooth). _Rec:_ **strong yes** for this domain — the pipeline metaphor is the point.
- **EXT-4 — Edge-Path bundling.** Bundle near-parallel cross-hull / fan-out edge families along actual graph paths (low-ambiguity variant).
  - _Pros:_ Cuts clutter on dense graphs (the #1 complaint); the "Edge-Path" variant stays unambiguous.
  - _Cons:_ **Any** bundling trades individual-edge traceability for cleanliness; adds routing complexity; can clash visually with EXT-3.
  - _Fit:_ Stage 4, aggregated cross-hull connectors only (keep within-hull fan-outs crisp). _Default:_ **off**. _Rec:_ **optional / later** — only if density hurts; ambiguity risk.

**Encoding & salience (Stage R — rendering, no placement risk)**

- **EXT-5 — Nested hull tinting + spine color + auto-legend.** Tint hull backgrounds by role/account, color the spine, auto-generate a legend.
  - _Pros:_ Gestalt "common region" makes nesting readable at a glance; color is the fastest "which account" channel; legend removes guesswork. Pure rendering — no placement risk.
  - _Cons:_ Must be accessibility-safe (pair color with outline/pattern; don't rely on hue alone); too many tints become noise; legend takes canvas space.
  - _Fit:_ Stage R. _Default:_ **on**. _Rec:_ **yes** — cheap, big perceived-quality gain.
- **EXT-6 — Salience (focus + context).** Heavier strokes on the spine/critical path, dim the periphery, highlight a full path on hover.
  - _Pros:_ Directs the eye to the story; complements EXT-2; builds on existing weighted connectors (R5)
    - multi-hop hover (R4).
  - _Cons:_ Needs spine/importance detection; interactive highlighting is runtime work, not layout.
  - _Fit:_ Stage R + runtime. _Default:_ **partial** (extend existing). _Rec:_ **yes, incremental**.
- **EXT-7 — Symmetry / grid-snap / uniform fan-outs.** Snap to a grid, equalize within-column gaps, draw repeated structures (api1..16) identically.
  - _Pros:_ Tidy, professional, predictable; symmetry is a (weaker) validated aesthetic; uniform combs read as "same kind of thing."
  - _Cons:_ Grid-snap can waste space or fight tight packing; lowest legibility payoff here.
  - _Fit:_ Stage R / post-coordinate finishing pass. _Default:_ **off**. _Rec:_ **low priority** polish.
- **EXT-8 — Progressive disclosure / level-of-detail.** Make "collapsed overview, expand on demand" the explicit core model (Compact default + click-to-expand + degree-of-interest hover).
  - _Pros:_ The single most effective clutter remedy (C4; cloud best-practice "don't draw a dozen boxes"); largely already built (Compact + expand + R4 hover).
  - _Cons:_ Mostly a stance/doc commitment, not new math; expand-overlap still needs EXT-9.
  - _Fit:_ Product/UX + EXT-9. _Default:_ **on** (Compact default). _Rec:_ **yes** — formalize what exists.

**Stability & correctness (Stage X — cross-cutting)**

- **EXT-9 — Mental-map-preserving expand + stable re-import.** On expand, push neighbors _minimally_ (constrained) instead of overlapping; on re-import reuse prior positions (`terraformCompoundLocal` is already written but unused).
  - _Pros:_ Preserving positions measurably aids orientation (Archambault/Purchase); fixes today's "expand overlaps siblings" wart; makes re-imports diff-friendly.
  - _Cons:_ Constrained neighbor-pushing is real work (topology-preserving move); re-import anchoring has edge cases when the graph changed shape.
  - _Fit:_ expand path + finalize (reuses the VPSC projection). _Default:_ **on**. _Rec:_ **yes** — fixes a known defect.
- **EXT-10 — Faithfulness guardrail.** A metric/check ensuring geometry never implies a relationship that isn't there (accidental alignment/clusters); geometric clusters == real hulls.
  - _Pros:_ Prevents "lies" in the diagram; cluster-faithfulness is a current (2024) metric; cheap as a gate.
  - _Cons:_ A guardrail, not a visible feature; thresholds need care.
  - _Fit:_ metrics / acceptance gates (§13, §17). _Default:_ **on (as a test)**. _Rec:_ **yes** — low cost, prevents regressions.
- **EXT-11 — Aspect-ratio / viewport fit.** Target a specific width:height (e.g. the screen) explicitly rather than "shortest then trim width."
  - _Pros:_ Best matches "horizontal but not excessive"; ARCOL (2026) is exactly aspect-ratio-constrained orthogonal layout; fits a viewport without dual-axis scrolling.
  - _Cons:_ Adds a real objective/knob (which ratio? whose viewport?); can conflict with forced-band height.
  - _Fit:_ Stage 3 / this is DEC-4. _Default:_ **decide the target** (screen-ish ratio recommended). _Rec:_ **yes** — pick the target.
- **EXT-12 — No-back-edge routing.** Guarantee nothing ever _looks_ like it flows backward/up-left; route long column-spanning edges cleanly.
  - _Pros:_ Cheap; reinforces L→R reading; TFD order already guarantees the logical direction.
  - _Cons:_ Essentially none — a routing constraint.
  - _Fit:_ Stage 4. _Default:_ **on**. _Rec:_ **yes** — free.

### 23.4 References added (R21–R30)

- **[R21] Purchase, Cohen, James — _Validating Graph Drawing Aesthetics_**, GD 1995. doi:10.1007/BFb0021827 · `doi-10-1007-bfb0021827`. _(crossings ≫ bends > symmetry)_
- **[R22] Purchase — _Effective information visualisation: a study of graph drawing aesthetics and algorithms_**, Interacting with Computers 2000. doi:10.1016/S0953-5438(00)00032-1 · `doi-10-1016-s0953-5438-00-00032-1`.
- **[R23] Purchase, Allder, Carrington — _User Preference of Graph Layout Aesthetics: A UML Study_**, GD 2000. `s2-10-1007-3-540-44541-2-2`.
- **[R24] Ware, Purchase, Colpoys, McGill — _Cognitive Measurements of Graph Aesthetics_**, Information Visualization 2002. doi:10.1057/palgrave.ivs.9500013 · `doi-10-1057-palgrave-ivs-9500013`.
- **[R25] Huang, Eades, Hong — _A Graph Reading Behavior: Geodesic-Path Tendency_**, PacificVis 2009 (`doi-10-1109-pacificvis-2009-4906848`); and **_Measuring Effectiveness of Graph Visualizations: A Cognitive Load Perspective_**, Information Visualization 2009 (doi:10.1057/ivs.2009.10 · `doi-10-1057-ivs-2009-10`).
- **[R26] Archambault, Purchase — _Mental Map Preservation Helps User Orientation in Dynamic Graphs_**, GD 2012. `openalex-10-1007-978-3-642-36763-2-42`. (See also _How Important Is the "Mental Map"?_ `openalex-10-1007-978-3-540-70904-6-19`.)
- **[R27] Wallinger et al. — _Edge-Path Bundling: A Less Ambiguous Edge Bundling Approach_**, IEEE TVCG 2022. doi:10.1109/TVCG.2021.3114795 · `doi-10-1109-tvcg-2021-3114795`. (Confluent: Bach et al. `doi-10-1109-tvcg-2016-2598958`; power-confluent `doi-10-1109-tvcg-2019-2944619`.)
- **[R28] Faithfulness — _On the Faithfulness of Graph Visualizations_** `crossref-10-1007-978-3-642-36763-2-55`; **_Shape-Faithful Graph Drawings_** `arxiv-2208-14095v1`; **_Cluster-Faithful Graph Visualization_**, PacificVis 2024 `s2-10-1109-pacificvis60374-2024-00029`.
- **[R29] Orthogonal / dataflow routing — Spönemann et al. _Port Constraints in Hierarchical Layout of Data Flow Diagrams_** `elk-10-1007-978-3-642-11805-0-14`; **Wybrow, Marriott, Stuckey _Orthogonal Hyperedge Routing_** doi:10.1007/978-3-642-31223-6\*10 · `doi-10-1007-978-3-642-31223-6-10`; \*\*Hegemann, Wolff \_A Simple Pipeline for Orthogonal Graph Drawing**\* arXiv:2309.01671 · `arxiv-2309-01671v2`; **ARCOL: _Aspect Ratio Constrained Orthogonal Layout_\*\* (2026) `openalex-w7148176492`.
- **[R30] Engines — _The Eclipse Layout Kernel_** arXiv:2311.00533 · `elk-eclipse-layout-kernel-arxiv`; ELK/dagre docs `elk-dagre-engine-docs`; LOD rendering `openalex-10-1109-tvcg-2012-238`; topological fisheye `graphviz-fisheye`; overview+detail constraint layout `doi-10-1109-tvcg-2008-130`.

### 23.5 Harvest candidates

The corpus is already strong; these are the gaps worth adding for full context.

- **HOLA — _Human-like Orthogonal Network Layout_** (Kieffer, Dwyer, Marriott, Wybrow), IEEE TVCG 2016, doi:10.1109/TVCG.2015.2467451. **Harvest** — most on-point missing academic source; pairs with EXT-3 (ARCOL, by overlapping authors, is already in-corpus).
- **Practitioner / product docs (harvest selectively as doc entries; precedent: `elk-dagre-engine-docs`).** D2 / TALA (https://d2lang.com, https://terrastruct.com); C4 (https://c4model.com) / Structurizr (https://structurizr.com); Ilograph (https://www.ilograph.com); Cloudcraft (https://www.cloudcraft.co); Hava (https://www.hava.io); Azure Well-Architected diagrams (https://learn.microsoft.com/azure/well-architected/architect-role/design-diagrams); Graphviz attrs (https://graphviz.org/doc/info/attrs.html); ELK reference (https://eclipse.dev/elk/reference.html); Mermaid (https://mermaid.js.org); dagre wiki (https://github.com/dagrejs/dagre/wiki). Highest value: **D2/TALA** and **C4/Structurizr**.
- **GraphMaps — _Browsing Large Graphs as Interactive Maps_**, arXiv:1506.06745. **Optional** — the LOD theme is already covered by `openalex-10-1109-tvcg-2012-238` + `graphviz-fisheye`.
- **Ware — _Information Visualization: Perception for Design_** (book). **Context reference** — abstract only if harvested; read directly for perception foundations.

---

## 24. Implementation order & build sequence (milestones)

This is the **careful, piece-by-piece build order** — the assembly instructions for the Lego pieces of §22. It is not the runtime phase order (§7); it is the _construction_ order, sequenced by dependency and risk so each step is small, verifiable, and reversible, with a real decision made before the next piece is added.

### 24.1 Rules of the build

1. **Everything ships behind the `pipelineLayoutVariant: "rcll"` flag.** The existing builders stay intact until the core (M0–M8) passes the gates; nothing user-facing changes until then.
2. **Correctness first, readability second, optional extras last.** Hard tiers (T1–T3) and clean hulls (T2) before centering (T5), before compaction (T6/T7), before EXT-\*.
3. **Measure before you change.** M0 stands up the metrics so every later milestone is a _measured_ decision, not a guess.
4. **Each milestone ends with a decision gate** — it resolves a specific `DEC-*` / `FLEX-*` / `EXT-*` choice using the M0 metrics — **and acceptance criteria** (an invariant or metric that must hold).
5. **Each milestone is reversible** (a module/flag toggle per §22). A milestone that regresses a gate is reverted, not patched over.

### 24.2 Milestone table

| # | Milestone | Adds (stage/EXT) | Decision gate | Acceptance criteria |
| --- | --- | --- | --- | --- |
| **M0** | Scaffolding + measurement harness | `rcll` flag routing (delegates to old builder); collision diagnostic + readability metrics (§13/§17) | Pick the **polyline-aware crossing counter** ([DEC-6](#14-open-design-decisions)) | Flag routes; all metrics compute; **v2 baselines recorded**; existing tests green |
| **M1** | Prep + compound tree (Stage 0) | compound tree (`root`/`primaryCluster`), `UB`/slack, fan-out/fan-in sets, hull-edge up-projection `D_H`, localized cycle fallback | Cross-hull fan-out at the **LCA** ([DEC-2](#14-open-design-decisions)) | `D_H` acyclic or localized fallback; fan-out sets + slack correct on v2; deterministic. _No placement change yet._ |
| **M2** | Layering (Stage 1a) | longest-path floors (CON-1) + hull staircase (CON-6) + **fan-out column pinning** (T4) | Fan-out shared column = `max LB` over the set | CON-1, CON-6 hold; **fan-out-column rate = 100 %** on v2; deterministic |
| **M3** | Recursion + forced bands + hull frames (Stages 1d-forced / 2-frames) | recursive container layout; forced-band policy; derived hull boxes; collision gate (CON-3/4/5) | [DEC-1](#14-open-design-decisions) staircase Y-overlap; [DEC-3](#14-open-design-decisions) default region policy | **Collision count = 0** (compact **and** full); forced bands disjoint; containment holds |
| **M4** | ~~Hybrid top-spine alignment~~ → **swimlane interior lane-rise** (DEC-1 extended; `swimlaneLaneRise` A/B toggle) | **As-built:** original spine-alignment had no v2 leverage (one provider). Two measured reframes; shipped: X-disjoint swimlane lanes rise to share Y (CON-12-safe). The **global cross-provider spine ruler** is deferred (§34.2). | swimlane-bypass + no-op (Codex); reorder→M6; default OFF == M3b | **rise ON shorter than OFF** + all 4 gates 0 (incl. mixed-VPC unaffected) + determinism + toggle wired; v2 −2.1% / −2.0% |
| — | **▸ Checkpoint A — "correct skeleton":** TFD-correct, hierarchy-clean, frames correct. Can replace `Stacked`/`Packed` _correctness_. Readability not yet improved. First internally-shippable cut. |  |  |  |
| **M5** | Coordinate assignment / **centering** (Stage 1d-packed) | Brandes–Köpf size-aware centering + VPSC clamp; hub-over-fan-out / convergence-over-sources (T5); cross-hull at LCA | ε tolerance ([DEC-6](#14-open-design-decisions)); spine-vs-rest centering **weight** | **hub-centering rate ≥ target within ε**; 0 overlaps; **median ΔY ↓** vs baseline |
| **M6** | Ordering / crossing reduction (Stage 1c) — **EXT-1**; **+ edge-length median reorder** (deferred from M4) | barycenter + strict-improve gate; the **median reorder** (Eades–Wormald [EW94] / Gansner [R-TSE93]) permutes hulls within a column to minimize inter-hull edge length (bounded sweeps for CON-8) | [EXT-1](#23-human-factors-readability--principles-engine-practice--optional-extras) on/off; size-vs-crossings budget; reorder couples to the DEC-1 rise (order-dependent) | **crossings ↓** + **edge length ↓** vs baseline; deterministic; no higher-tier regression |
| **M7** | Height compaction: free-node **push-right** (Stage 1b) — T6 | `balance()` push-right of _free_ nodes; re-center after | free/pinned classification; re-center vs not | **container height ↓** where slack exists; T4/T5 preserved |
| **M8** | Width compaction: **pack-left** + aspect (Stage 3) — T7, **EXT-11** | order-preserving pack-left, fan-out groups as units; aspect target | [DEC-4](#14-open-design-decisions) aspect target value | **width ↓**, height not regressed, **aspect near target** |
| — | **▸ Checkpoint B — "v1 RCLL":** full core (correct + centered + compact). Replaces all four placement toggles. This is the candidate to flip the default / retire `Stacked/Packed/pull-left/Semantic`. |  |  |  |
| **M9** | Routing: **orthogonal + ports** + no-back-edge (Stage 4) — **EXT-3, EXT-12** | right-angle routing, source-right→target-left ports; back-edge guard | [EXT-3](#23-human-factors-readability--principles-engine-practice--optional-extras) default (orthogonal vs smooth toggle) | ports consistent; **0 visual back-edges**; bends bounded; group-drag intact |
| **M10** | Encoding: hull tinting + spine color + legend + salience (Stage R) — **EXT-5, EXT-6** | nested tints, colored spine, auto-legend; heavy-spine/dim-periphery + hover path-highlight | palette + accessibility (color **paired with outline**) | legend present; contrast AA; **no placement change**; salience reads |
| **M11** | Stability: mental-map expand + re-import + faithfulness — **EXT-9, EXT-10** | minimal-push expand; wire `terraformCompoundLocal`; faithfulness metric | re-import anchoring policy | expand no longer overlaps siblings; **faithfulness metric green**; re-import diff-minimal |
| **M12** | Remaining extras (independent) — **EXT-2, EXT-4, EXT-7, EXT-8** | whole-path straightening (±dummy [DEC-5](#14-open-design-decisions)); edge-path bundling; symmetry/grid-snap; progressive-disclosure formalization | per-extra: [DEC-5](#14-open-design-decisions) dummy nodes; [EXT-4](#23-human-factors-readability--principles-engine-practice--optional-extras) ambiguity acceptance | each extra improves its metric **without regressing M0–M8 invariants** |
| — | **▸ M-ANC — RCLL ancillary ("All resources"): reserved bottom band** (DEFERRED; independent of M5–M12). Render the unconnected resources RCLL omits today. **Recipe + the dead ends already measured** are in [§8.1](#81-rcll-ancillary-all-resources--reserved-band-deferred); DI-ANC-1..3; §34.2. | a new `ancillaryBand` role placed as a disjoint-Y band below each container's dataflow (model-phase, like the `mixed`-VPC policy) | accept Y-growth (a band makes a container taller); **band-width cap** so dataflow X is preserved | **collision 0** (Compact + Full) + `primaryClusterCount` unchanged vs OFF + dataflow column X unchanged + determinism |

### 24.3 Dependency graph & reordering freedom

```mermaid
flowchart LR
  M0["M0 harness"] --> M1["M1 prep/tree"] --> M2["M2 layering"] --> M3["M3 forced bands"] --> M4["M4 spine"]
  M4 --> M5["M5 centering"]
  M5 --> M6["M6 crossings"] --> M7["M7 push-right"] --> M8["M8 pack-left"]
  M5 --> M9["M9 orthogonal route"]
  M5 --> M10["M10 color/legend"]
  M5 --> M11["M11 stability"]
  M5 --> M12["M12 remaining extras"]
  M4 -. "Checkpoint A: correct skeleton" .-> M5
  M8 -. "Checkpoint B: v1 RCLL — flip default" .-> M9
```

_Core M0–M8 is linear (M6 ⇄ M7 may swap — keep the better-scoring order). M9–M12 are mutually independent extras; each needs only M0 metrics + a real placement (≥ M5), so reorder freely._

- **Core (M0–M8) is linear** by dependency. **M6 and M7 may swap** (ordering vs height-compaction); run both, keep the order that scores better on the M0 metrics.
- **M9–M12 are mutually independent** optional extras; each depends only on M0 (metrics) + a real placement (≥ M5). Pick the order by value: typically **M9 (orthogonal) then M10 (color/legend)** give the biggest additional human-readability per unit risk.
- Every milestone is a module toggle (§22), so any can be disabled to bisect a regression.

### 24.4 Minimum-viable-readable cuts

- **M0–M5** already a large readability jump: correct hierarchy + **fan-out columns** + **centered hubs** (fixes the two things the current engine most visibly lacks).
- **M0–M8** = full core RCLL; the line at which to consider flipping the default.
- **+ M9 + M10** = the biggest additional readability bump (pipeline routing + color/legend) for comparatively low risk; recommended fast-follows after the core.

### 24.5 Per-milestone deliverables (definition of done)

For **every** milestone: (a) the module(s) behind the `rcll` flag; (b) unit tests for the new module honoring the §22 contract (preserves higher tiers, deterministic); (c) the relevant gate added to the acceptance suite (§13/§17); (d) a one-line entry in the change log recording the decision made at its gate. No milestone is "done" until its acceptance criteria pass on `staging-extended-localstack-v2` in **both** Compact and Full.

---

## 25. Assumptions & preconditions

What must hold of the inputs for RCLL to behave as specified. Each is checked; a violated assumption routes to the named handling, never a crash.

| ID | Assumption | If violated |
| --- | --- | --- |
| **A1** | ≥1 resolved TFD edge (CON-10). | 400 (pipeline undefined without dataflow). |
| **A2** | Every cluster resolves to a topology path rooted at a provider. | Attach to a synthetic `unknown` bucket at the nearest known level; never invent a real account/region (CON-7). §26. |
| **A3** | Cluster addresses are unique within a bundle; multi-state uses the `stackId::` namespace. | Existing loader rule; duplicates are namespaced, not merged. |
| **A4** | Each cluster's skeleton build returns positive width/height. | `buildFallbackCluster` (existing): labeled rectangle. |
| **A5** | Node and hull sizes are known before placement (bottom-up sizing needs leaf sizes first). | Sizing is post-order; a missing size uses the fallback box. |
| **A6** | TFD edges are directed and, after cycle handling (CON-2/DEC-8), form a DAG per container. | SCC handling per DEC-8. |
| **A7** | Topology depth is bounded (`root…subnetZone`, 6 levels). | Extra levels (if ever added) extend the role enum + policy table; algorithm is level-count-agnostic. |
| **A8** | Spacing/geometry constants are positive and title height is finite. | Constants are validated at load; non-finite ⇒ defaults. |

---

## 26. Edge cases & degenerate inputs

The robustness core: every degenerate input has a defined, tested behavior. "Fallback" references the ladder in §27.

| Input | Expected behavior | Authority |
| --- | --- | --- |
| Empty graph / 0 resolved edges | HTTP-style 400. | CON-10 |
| Single cluster | One card + its hull chain; no edges; no band/centering math. | trivial |
| Two clusters, no edge between them, but ≥1 edge elsewhere | Both placed; the unconnected one is a disconnected component (below). | §26 disconnected |
| **Cycle in `D`** | Localized fallback; SCC drawn per **DEC-8** (default: model-order stack in a shared column band + `pipeline_cycle` warning). Never a global flatten (CON-2). | CON-2, DEC-8 |
| Self-loop | Dropped at edge-collapse (existing). | prep |
| Parallel / multi-edges | Collapsed to one edge with `weight = count`; weight feeds connector stroke + spine emphasis. | §6.3 |
| **Disconnected components** | Each component laid out independently, then placed as siblings under their LCA via region packing (Domrös order-preserving), ordered by `firstSequence`. | REQ-8 |
| **Huge fan-out** (`1 → many`) | One shared column until out-degree > N; beyond, grid-wrap within the hop band. | **DEC-7** |
| Deep chain (very long linear path) | Wide by nature; accepted (TFD is linear). Pack-left/aspect trim only non-chain slack. | PREF-4/6 |
| **Missing topology** (no account/region) | Synthetic `unknown` bucket at the nearest known level; truthful (no invented real topology). | A2, CON-7 |
| Cluster whose edges span inconsistent paths | Cluster placed by **its own** placement path; each edge up-projects to its own LCA. | §6.3 |
| Satellite with no primary owner | Promoted to its own primary cluster. | prep |
| Duplicate addresses across bundles | Namespaced `stackId::` (existing). | A3 |
| Hull with a single child | Hull = child bbox + pad; no band/stack logic. | §7.2e |
| Fan-out targets in different forced bands | Cross-hull centering at the LCA (hub centered on child-hull medians, clamped to its band). | DEC-2 |
| No edges create depth (all column 0) | Degenerate single column; render as a vertical stack (still valid; signals "no flow"). | T1 |
| Wider than viewport after pack-left | Accepted — flow is genuinely wide; aspect is a preference, not a hard cap. | PREF-4 |
| Module emits non-finite / overlapping coordinates | Output rejected; module skipped; prior tree kept; recorded in `rcllDegraded`. | §27, §30 |

---

## 27. Failure modes & graceful degradation

**The fallback ladder (normative).** Each rung is a valid layout by the induction "the previous rung satisfied the higher tiers." If a stage cannot satisfy its §22 contract (throws, times out, or emits an invalid tree — overlap, non-finite, higher-tier violation), it is **skipped** and the previous tree is kept; the scene meta's `rcllDegraded` lists every skipped module so degradation is observable, not silent.

```mermaid
flowchart TD
  F0["Full RCLL — centered + compacted + routed"] -->|"centering/compaction infeasible"| F1["Forced-band placement only (skip centering, push-right, pack-left)"]
  F1 -->|"a container still can't place"| F2["Local forced stack for THAT container only (rest of scene unaffected)"]
  F2 -->|"global placement fails"| F3["Classic grid stacking (today's Stacked builder)"]
  F3 -->|"prep/skeletons fail"| F4["Fallback cluster rectangles (buildFallbackCluster)"]
  F4 -->|"no resolved edges"| F5["HTTP-style 400"]
```

**Properties:**

- **Locality (CON-2).** A failure inside one container degrades only that container; siblings keep the full treatment.
- **Per-module guard.** Every stage is wrapped: validate output is finite, non-overlapping (per its tier), and tier-preserving before accepting it.
- **Timeouts.** `perStageTimeoutMs` (§28) bounds each stage; a timeout = skip = fall back one rung.
- **Determinism preserved on fallback.** Each rung is itself deterministic, so a degraded layout is still byte-identical on re-run (CON-8).

---

## 28. Configuration & module API surface

The concrete contract implementers and reviewers share. Options are additive; defaults reproduce the recommended RCLL behavior.

```ts
type RcllOptions = {
  // policy (FLEX-1, §8)
  levelPolicy: Partial<Record<TopologyRole, "forced" | "packed">>; // default §8 table
  staircaseBandOverlap: boolean; // DEC-1, default true

  // objective (FLEX-3 / DEC-4)
  aspect:
    | { mode: "height-first" } // default
    | { mode: "ratio"; ratio: number }
    | { mode: "viewport" };

  // modules — each "off" or a strategy id (§22.2 registry)
  layering: "longest-path" | "network-simplex" | "coffman-graham"; // default longest-path
  ordering: "barycenter" | "off"; // default barycenter
  centering: "brandes-koepf" | "priority" | "off"; // default brandes-koepf
  heightCompaction: "balance-pushright" | "off"; // default balance-pushright
  widthCompaction: "pack-left" | "off"; // default pack-left
  routing: "straight" | "orthogonal-ports"; // default straight (EXT-3 toggle)

  // optional extras (EXT-*) — booleans, defaults per §23.3
  pathStraightening: boolean; // EXT-2 (default off)
  edgeBundling: boolean; // EXT-4 (default off)
  hullTinting: boolean; // EXT-5 (default on)
  salience: boolean; // EXT-6 (default partial/on)
  gridSnap: boolean; // EXT-7 (default off)
  mentalMapExpand: boolean; // EXT-9 (default on)
  noBackEdge: boolean; // EXT-12 (default on)
  faithfulnessCheck: boolean; // EXT-10 (default on)

  // limits & tolerances (§16, §30, DEC-6/DEC-7)
  maxClusters?: number; // bail to classic grid above this
  perStageTimeoutMs?: number; // per-module timeout (§27)
  centeringEpsilonPx?: number; // ε for "centered" (DEC-6)
  hugeFanoutThreshold?: number; // N for DEC-7 grid-wrap
  coordRoundingPx?: number; // determinism snap (§30), default 1
};

// §22 module contract
type Lattice = {
  /* LB/UB/slack, fanout/fanin sets, hull-edge DAGs, boxes */
};
type StageResult = { tree: CompoundNode; meta: Record<string, unknown> };
type Stage = (
  tree: CompoundNode,
  lattice: Lattice,
  opts: RcllOptions,
) => StageResult;
// registry: Record<string, Stage>; selection driven by RcllOptions; each Stage honors §22.1.
```

**Dialog / URL mapping (extends §18):** each geometry-affecting option maps to a demo URL param and a dialog control; the consolidated dial set is `levelPolicy`, `aspect`, `routing`, plus the staircase/extras toggles. Content toggles (Compact/Full, Dataflow-only/All) remain separate.

---

## 29. Observability & debugging

So a bad layout is diagnosable from artifacts, not guesswork.

**Scene meta (extends existing `[terraform:local-parse]` `pipelineLayout.meta`):**

```ts
{
  layoutEngine: "pipeline",
  pipelineVariant: "rcll",
  rcllModules: { layering, ordering, centering, heightCompaction, widthCompaction, routing },
  rcllDegraded: string[],          // modules skipped via the fallback ladder (§27)
  counts: { clusters, edges, columns, fanoutSets },
  readability: { crossings, hubsCenteredPct, medianDeltaYPx, nearStraightPct, aspect },
  gates: { collisions, semanticEdgeViolations },   // must be 0 / []
  warnings: string[],              // e.g. "pipeline_cycle", "unknown_topology_bucket"
}
```

**Profiler spans (extends `terraformImportProfile`):** `rcll.prep`, `rcll.layer`, `rcll.order`, `rcll.center`, `rcll.pushright`, `rcll.spine`, `rcll.packleft`, `rcll.route`, `rcll.finalize`.

**Debug toggles (localStorage):** dump per-container boxes; overlay the column grid; draw band boundaries; log each decision-gate choice. (Mirror the existing `terraformImportProfile` pattern.)

**Diagnosis playbook (symptom → look here):**

| Symptom | Inspect |
| --- | --- |
| Arrows diagonal / hubs off-center | `centering` ran? `readability.hubsCenteredPct`, `medianDeltaYPx`; `rcllDegraded`. |
| Overlap / collision | `gates.collisions`; which module is in `rcllDegraded`; band policy (§8). |
| Wrong column / back-edge | `layering`; the container's hull-edge DAG `D_H`; `gates.semanticEdgeViolations`. |
| Too tall | region policy (DEC-3); `staircaseBandOverlap` (DEC-1); `counts.columns` vs forced bands. |
| Too wide | `widthCompaction` ran? `aspect`; deep-chain edge case (§26). |
| Non-deterministic diff | §30; check tie-break keys + `coordRoundingPx`. |

---

## 30. Determinism specification (normative)

CON-8 in detail. **All** layout-affecting ordering MUST follow these rules; this is the single source for tie-breaking.

1. **Canonical sort key (everywhere a set is ordered):** `(primaryStructuralKey, firstSequence, topologyKey, id)` where `primaryStructuralKey` is the stage-relevant order (e.g. `LB`/column for layering; topological order on `D_H` for forced stacks; barycenter for ordering). Lower wins; the final `id` guarantees total order.
2. **No incidental iteration order.** Never let `Map`/`Set`/object-key iteration decide geometry; copy to an array and sort by rule 1 first.
3. **Explicit comparators only.** No locale-dependent or default string sort; use a fixed comparator.
4. **No nondeterministic sources.** No RNG, `Date.now`, identity hashing, or floating wall-clock in layout. (Element `id`/`versionNonce` come from the existing deterministic convert path keyed by stable identity, so reconciliation is stable.)
5. **Float discipline.** Snap emitted coordinates to `coordRoundingPx` (default 1 px); snap VPSC outputs before use. Prefer integer/rational arithmetic where feasible to avoid cross-platform drift.
6. **Re-run guarantee.** Build twice → byte-identical element arrays (positions, ids, order). Enforced by a determinism test (§17, §35).
7. **Fallback determinism.** Every rung of the §27 ladder is itself deterministic.

---

## 31. Interactions with existing editor features

RCLL must not break features that already work. Each is specified.

| Feature | Interaction |
| --- | --- |
| **Compact→Full expand** | EXT-9 mental-map: rebuild the cluster, push neighbors minimally; because RCLL is deterministic, untouched regions don't jump. Expand is its own history entry. |
| **Multi-hop hover focus (R4)** | Unaffected; EXT-6 salience extends it (path highlight). |
| **Compound group-drag (REQ-10)** | Preserved: arrows parented to LCA topology frame; `getFrameDescendants` moves them. |
| **Export (SVG/PNG/canvas)** | Pure geometry; tinting/legend (EXT-5) are real elements, so they export. No RCLL-only export path. |
| **Collaboration / reconciliation** | Deterministic ids + stable z-order + fractional index. A re-layout is an element-update diff; note a full re-import is a **large** diff — fine for import, not intended for live multi-user re-layout. |
| **Undo/redo** | Import = one history entry (existing); expand/collapse = their own entries. |
| **KV layout cache** | Cache key MUST include every geometry-affecting `RcllOptions`; otherwise skip cache (as packed/semantic do today). Recommend: include and cache. |
| **Z-order / nesting** | hull frames behind children; tint behind frames; connectors above frames; legend top-most. |

---

## 32. Backward compatibility & migration

| Concern | Position |
| --- | --- |
| **`customData` fields** | Keep all existing (`terraformTopologyRole/Key/Path`, `terraformCompoundLayout/ParentKey/Local`, `terraformPipelineExpandable/Expanded/Placement`). RCLL adds only **additive** fields; old readers ignore unknown keys. |
| **Already-imported scenes** | Static; no migration. Re-import to obtain an RCLL layout. |
| **`terraformCompoundLocal`** | Previously written-but-unread; EXT-9 begins reading it — implementation MUST tolerate its absence (old scenes) and shape drift. |
| **Scene meta** | Additive keys only; old consumers unaffected. |
| **Default flip** | The only user-visible change (Checkpoint B); flag-gated and reversible (§18, §36-style kill switch in §33). |
| **`.tfd` syntax** | Unchanged (N1). Optional FLEX-9 edge weights are additive and ignored if absent. |
| **Public API / re-exports** | No changes to `packages/excalidraw` public exports; RCLL lives in the terraform layout core. |

---

## 33. Risk register

| Risk | Likelihood | Impact | Mitigation | Early warning |
| --- | --- | --- | --- | --- |
| Forced bands still too tall on sparse graphs | Med | High | DEC-3 region-packed toggle + DEC-1 staircase overlap | `readability.aspect`, height vs baseline |
| Centering ↔ compaction instability/thrash | Med | Med | Strict-improve gates; single-pass; determinism test | non-deterministic diff; oscillating metrics |
| VPSC infeasible / pathological constraints | Low | High | Fallback ladder to forced-only; finite-check | `rcllDegraded` contains `center` |
| Performance on very large plans | Med | Med | `perStageTimeoutMs`, `maxClusters` bail to classic; profiler spans | span durations; bail count |
| Orthogonal routing looks cluttered | Med | Med | EXT-3 is a toggle; default smooth until M9 proven | bend count; review |
| Crossing counter inaccuracy misguides M6/M8 | Med | Med | Polyline-aware counter before trusting numbers (DEC-6) | counter vs visual spot-check |
| Re-layout diff too large for collab | Low | Med | Import-only context; documented (§31) | n/a |
| Scope creep across 12 extras | High | Med | Milestone gates (§24), each reversible; checkpoints A/B | milestone slippage |
| Determinism breaks across platforms | Low | High | Coord rounding, explicit comparators, CI determinism test | cross-platform diff |
| Packing introduces misleading alignments | Low | High | Faithfulness gate EXT-10 | faithfulness metric |
| **Kill switch** | — | — | The `pipelineLayoutVariant` flag reverts to the existing builders instantly; RCLL ships off by default until Checkpoint B. | — |

---

## 34. Consolidated decision log

The single registry of **settled** decisions. Open items live in §14 (DEC-1…DEC-8); per-extra defaults in §23.3. **Design-time** decisions (the algorithm itself) are **D1–D12** below; **as-built implementation** decisions made at each milestone's gate/eng-review are **§34.1 (DI-\*)**. The change log (top of doc) is the narrative; §34.1 is the structured registry.

### 34.0 Design-time decisions (D-\*)

| ID | Decision | Rationale | Set | Revisitable? |
| --- | --- | --- | --- | --- |
| **D1** | Design the one algorithm now; rollout decided at review (report-first). | User scope answer. | v0.1 | n/a |
| **D2** | Forced vertical bands at chosen levels (no X-disjoint sibling band-sharing). | Ownership clarity. | v0.1 | via FLEX-1 |
| **D3** | Hybrid columns: global top spine, local below. | Aligned org hops without space waste. | v0.1 | yes (§11) |
| **D4** | Height lever = push **free** nodes right, then pack left. | User's literal height/width model. | v0.1 | tunable |
| **D5** | Forced + packed policy split across levels. | Clarity at containers, compaction inside. | v0.1 | via FLEX-1 |
| **D6** | Per-level forced toggle; one-way hull→hull edge ⇒ dependent hull deeper/right. | Per-density control + hull-level L→R. | v0.1 | toggle |
| **D7** | Fan-out targets share a column even when it costs height. | Human expectation. | v0.1 | no (core) |
| **D8** | Center on median in both directions; forced shared **column** for fan-out only (not fan-in). | Hub-over-children reading; keep fan-in free for compaction. | v0.1 | no (core) |
| **D9** | Readability senior to compaction; move fan-out groups as rigid units; apply fan-out+centering recursively to hulls. | The priority lattice. | v0.1 | no (core) |
| **D10** | Modular "Lego" pipeline; the priority lattice is the module contract. | Swap/adjust pieces safely. | v0.2 | no (architecture) |
| **D11** | Build order M0–M12, each behind the flag with a gate. | Careful incremental build. | v0.3 | yes (sequence) |
| **D12** | Robustness contract: defined behavior for every degenerate input + a fallback ladder. | Resilience. | v0.4 | no (core) |

### 34.1 Implementation decision log (DI-\*, per-milestone, as built)

Every settled build decision, in the order made. `Origin` cites the eng-review finding ID (`F#`/`Issue #`) or clarifying question (`Q#`) it came from. These are the ground-truth record behind the change-log rows; the git commit for each milestone carries the same decisions in prose.

| ID | Milestone | Decision | Rationale | Revisitable? |
| --- | --- | --- | --- | --- |
| **DI-M0a-1** | M0a | Export `runRcllPipeline` + take `stages` as a default param. | Lets the §27 fallback guard be unit-tested end-to-end (Issue 1). | no |
| **DI-M0a-2** | M0a | `runRcllPipeline` collects `StageResult.meta` (was a dead field). | §28 contract; M1+ stages surface diagnostics. | no |
| **DI-M0a-3** | M0a | `rcll` skips the KV layout cache; dialog hides the Layout-variant control; stale `view:"experimental"` migrates to `"semantic"`. | The view forces `rcll`; cache/UI must not fight it. | no |
| **DI-M0b-1** | M0b | Polyline-aware crossing counter; de-dupe per arrow **pair**; a 2-point arrow reduces to the old chord count. | DEC-6; future orthogonal routing (M9) must measure honestly without regressing today's numbers. | no |
| **DI-M0b-2** | M0b | ΔY / near-straight use the polyline **vertical extent** (`max_y − min_y`), not endpoint Δy. | An elbow jog with equal endpoints must read as deviating. | no |
| **DI-M0b-3** | M0b | Every rate carries a companion count; rate = 0 on an empty denominator (never a vacuous 1.0). | Honest metrics when nothing resolves (Full-mode 0/0). | no |
| **DI-M0b-4** | M0b | Gate dials: ε = 36px (`PIPELINE_CLUSTER_GAP_Y`), fan-out column tol = 75px (`PIPELINE_COLUMN_GAP`/2), near-straight ≤ 24px. | Tuned to the card grid; local consts in the diagnostics leaf (arch-clean). | tunable (FLEX-5) |
| **DI-M0b-5** | M0b | Hub-centering measured in **both** directions (fan-out hubs + fan-in convergence). | §13 centering gate is two-sided; `hubCount ≠ fanoutSetCount`. | no |
| **DI-M1-1** | M1 | Leaf `CompoundNode`s keyed by **`cluster.id`**, not the topology-path prefix. | Path excludes the resource, so same-subnet siblings would collide and drop their `D_H` edge (F2 — was a P1 correctness bug). | no (core) |
| **DI-M1-2** | M1 | Declared box→box edges merged into `D_H` by `(from,to)` **without** summing weight. | Avoids double-counting when a declared edge coincides with an up-projected one (F1). | no |
| **DI-M1-3** | M1 | Inline the successor map in `computeUpperBounds` (declined a shared helper). | Smallest diff; only the 3rd consumer. **Superseded by DI-M2-4** when a 4th appeared. | superseded |
| **DI-M1-4** | M1 | Import is **unguarded** (no try/catch around `buildRcllModel`). | A model-build bug should surface loudly, not silently blank the view; degenerate-input no-throw tests are the compensating control (F3). | revisit if real inputs prove fragile |
| **DI-M1-5** | M1 | `UB` clamped `≥ LB` so `slack ≥ 0`. | A cycle artifact in `computeDepths` can otherwise yield negative slack that would mislead the M7 push-right. | no |
| **DI-M1-6** | M1 | DEC-2 realized: cross-hull fan-out up-projected to the **LCA container** via `lcaTopologyPath`. | Evaluate fan-out/centering where both ends are visible. | no (core) |
| **DI-M1-7** | M1 | Compound builder takes an optional `prep`; RCLL shares its prep with the fallback. | Skeleton build runs once, not twice (no ~2× regression). | no |
| **DI-M1-8** | M1 | Container cycles in `D_H` are **detected + flagged only**; the localized fallback is M3. | Nothing to act on without a placement; v2 has 6 such containers (up-projecting a DAG is not a DAG). | M3 acts |
| **DI-M2-1** | M2 | Layering is **model-only**: write `localColumn`, change no geometry; the gate is asserted on the model. | Keeps M3 the first-geometry boundary; ships no collisions mid-campaign (collision gate is M3). (Q1) | no (campaign rule) |
| **DI-M2-2** | M2 | Cyclic containers get **sequential columns** `0,1,2…` and are **excused** from the CON-1/CON-6 gate. | Longest-path is undefined on a loop; M2 only needs sane numbers, smarter handling is M3. (Q2) | M3 refines |
| **DI-M2-3** | M2 | Fan-out pinning is **junior to precedence (T1 > T4)**: a target internally preceded by another keeps its later column. Algorithm = pin to set-max → forward-relax → **measure** (assert rate = 1.0, an un-aligned set is a documented finding, never a silent weakening). | Precedence is hard; co-columning is readability-hard. v2 hit 1.0, so no union-find column-classes needed. (Issue 3) | escalate to column-classes only if a preset misses 1.0 |
| **DI-M2-4** | M2 | Extracted shared `longestPath(nodeKeys, edges, rankOf) → {column, hasCycle, unresolved}`; `computeDepths` routes through it (byte-identical, regression-tested); each caller keeps its own cyclic fallback. | The 4th consumer appeared (**supersedes DI-M1-3**); kept minimal to avoid an over-parameterized helper. (Issue 2) | no |
| **DI-M2-5** | M2 | Layering stage is a **pure transform** (clones the tree); the builder is rewired to consume `runRcllPipeline().tree`. | Honors the §22.1 contract and threads the tree forward for M3+ placement; closes the latent "builder drops the pipeline tree" gap. (Issue 1) | no |
| **DI-M3a-1** | M3a | **M3 is split into M3a + M3b.** M3a = correct geometry (placement + forced bands + frames + collision gate); M3b = DEC-1 staircase Y-overlap + DEC-3 region policy knob. | Smallest reversible step that draws first geometry; the height levers layer on top and stay measurable in isolation. (Q1) | no |
| **DI-M3a-2** | M3a | **Packed containers use column-stack** (each child at its column X; same-column children stacked in Y by `(mds,key)`); **no** centering, **no** row-sharing. | The honest un-centered Sugiyama coordinate; centering is M5 (T5), row-share is M7 (T6). Keeps M3a's only job "turn columns into boxes." (Q2) | M5/M7 refine |
| **DI-M3a-3** | M3a | **Structural gates only**: collision = 0 + containment (CON-3) + forced bands disjoint (CON-5) + determinism, Compact **and** Full. `semanticEdgeViolations` is **observed, not gated**; the "geometry ≡ compound" net is **retired**. | M3a's whole point is new geometry; cross-container edge straightness is the M4 spine's job (REQ-7), not a structural-correctness gate. RCLL may be taller than compound until M7. (Q3) | M4 drives semantic-edge down |
| **DI-M3a-4** | M3a | **DEC-1 OFF**: forced bands strictly disjoint in Y (no staircase rise). | Makes collision = 0 hold by construction for forced levels; DEC-1(B) rise-beside is M3b. | M3b enables |
| **DI-M3a-5** | M3a | **Cyclic containers placed via M2's sequential columns** (a left-to-right strip), `pipeline_cycle_container` warning; **DEC-8(B) shared-band stack deferred** — a deliberate divergence from §26. | M2's columns are already collision-free + deterministic + read L→R, so the gate passes without a second placement codepath; the learning "M3 must implement the fallback" is satisfied by *placing* them correctly. (eng-review A1) | M3b/M5 revisit DEC-8(B) |
| **DI-M3a-6** | M3a | Export **branches on `ran.includes("placement")`**, not a `box`-presence sniff. | Stays in lockstep with the §27 guard's bookkeeping; a degraded placement can never take the boxes path. (eng-review A2) | no |
| **DI-M3a-7** | M3a | **Provider Y stacking owned solely by `applyCompoundHierarchicalLayout`** — placement lays out *within* each provider subtree (X only at root), never bands providers (root policy = `passthrough`). | One owner, matches compound's proven behavior, multi-provider works for free later. (eng-review A3) | no |
| **DI-M3a-8** | M3a | Each container footprint **reserves its own frame-title** (`PIPELINE_FRAME_TITLE_HEIGHT` for titled roles) at the top. | Title lives inside the footprint ⇒ stacking siblings with any positive gap keeps derived frame rects + title strips disjoint; removes per-gap title arithmetic and makes all four collision classes hold by construction. | no |
| **DI-M3a-9** | M3a | Leaf emit **pre-compensates the skeleton origin**: translate by `(box - frameLocal)` so the cluster frame lands exactly at the placed box; `layoutBoxes` = the frame's true box. | Cluster skeletons are NOT origin-normalized (frame at local e.g. `(-18,+233)`); without this the rendered card sits below its derived hull and pokes into the next band's title (a real `frame-title-primary-cluster` collision caught on v2 Full). | no |
| **DI-M3a-10** | M3a | Extracted shared `columnOffsetsFromWidths(widths, startX, gap)`; `computeGlobalColumnX` routes through it (regression-guarded). | DRY: same cumulative-offsets kernel as the global grid (eng-review CQ1); mirrors M2's `longestPath` extraction. | no |
| **DI-M3a-11** | M3a-hardening | **The iron rule is a hard constraint (CON-12) + a model-level gate**, not an "M4 will fix it" goal. `backwardEdgeGate` runs on placed **boxes** (Compact **and** Full): `acyclicBackwardEdges` MUST be 0, `cyclicBackwardEdges` excused + counted. | Empirically 100% of v2's backward edges had a cyclic LCA; the acyclic case is already forward by the width-aware staircase. Box-level measurement cures the rendered metric's Full-mode blindness. **Supersedes DI-M3a-3** (semanticEdgeViolations observed-not-gated → the iron rule IS gated; the rendered metric stays observed). | no (core) |
| **DI-M3a-12** | M3a-hardening | **Cyclic containers → DEC-8(B) SCC condensation** (iterative Tarjan + longest-path on the condensation): SCC members share one `localColumn`; acyclic members stay forward. **[SUPERSEDED by DI-M3a-16.]** | Replaces M2's sequential-column strip. A shared column ⇒ M3a packed stacks members in Y at one X ⇒ no intra-SCC *backward* render. **Supersedes DI-M2-2.** ⚠️ But a shared column makes the sibling hulls read **same-column** — which the *extended* iron rule (DI-M3a-16) forbids. Retained only as M2's per-container layering contract; **no longer drives placement**. | superseded (DI-M3a-16) |
| **DI-M3a-13** | M3a-hardening | The residual intra-SCC wrap-edges (11 compact / 22 full on v2) are **excused + styled as explicit back-edges (EXT-12)** via `styleRcllBackEdges` (dashed + `#e8590c` + `terraformBackEdge`); count in `meta.gates.backEdgesStyled`. **[MOOT on v2 after DI-M3a-16.]** | Under DEC-8(B) a cycle of width-bearing members had no fully-forward drawing. Under DEC-8(C) the *spurious* cycles are dissolved into lanes ⇒ **0 wrap-edges on v2**; EXT-12 styling is retained as the **defensive path for a genuine `D` cycle** (where lane mode still leaves a real wrap-edge). | genuine-cycle path |
| **DI-M3a-14** | M3a-hardening | **`semanticEdgeViolations` precisely defined + disambiguated** from the §13 "acyclic guard": it is the *rendered* backward-reading count (frame center-X), observed-not-gated (blind in Full; double-counts cyclic wrap-edges in Compact). | Two different notions shared one name (H1). The box-level gate is authoritative. | no |
| **DI-M3a-15** | M3a-hardening | Documented that dataflow arrows are `isDeleted` in the scene and `diagnosePipelineScene` counts them regardless; a caller that pre-filters `!isDeleted` reads a **false 0**. | Caught while classifying the 35 (a pre-filtering probe read 0). The existing `terraformPipelineRcll.test.ts` `layout()` helper pre-filters — its rendered dataflow metrics are vacuous; the box-level gate is not affected. | flag for test cleanup |
| **DI-M3a-16** | M3a-hardening-2 | **The iron rule gains a second half: no TFD edge shares a column** (CON-12), and **spurious hull cycles are dissolved into swimlanes** (DEC-8(C)), replacing DI-M3a-12's SCC-shared-column. `arrangeLaneSubtree` columns a cyclic container's descendant clusters by `denseRank(LB)` (a TFD edge always crosses a column) and lays its sub-hulls as **Y-lanes** spanning column ranges; `backwardEdgeGate` now also returns `acyclic/cyclicSameColumnEdges`, both gated 0 (acyclic) on the box **left edge**. | The user's rule: resources in the TFD must not occupy the same column. DI-M3a-12 cured backward edges by making sibling hulls **share** a column — which violates exactly that. The cluster graph `D` is acyclic, so dissolving the spurious cycle onto a shared cluster axis makes every edge read strictly forward; **v2: acyclicBackward = acyclicSameColumn = 0, both modes; 0 back-edges to style.** | no (core) |
| **DI-M3a-17** | M3a-hardening-2 | **`backwardEdgeGate` keys off the box LEFT EDGE, not `centerX`**, with threshold `ε = PIPELINE_COLUMN_GAP/2` read **inside** the function. | `centerX` is ambiguous (same-column cards have different widths ⇒ different centers). The left edge is the column indicator. The threshold is read at call time because a module-top-level `const ε = PIPELINE_COLUMN_GAP/2` binds during a **circular-import dead zone** → `NaN` (every edge misclassified as same-column — caught in test). | no |
| **DI-M3b-1** | M3b | **A cyclic container is decomposed into `D_H` SCCs**, NOT dissolved whole: multi-hull SCC → swimlane (shared `denseRank(LB)` axis), one-way condensation → staircase + DEC-1 Y-rise (`arrangeCyclicContainer`). **Supersedes DI-M3a-16's** global dissolve (the axis is now scoped per SCC group). | Hulls placed by edge directionality; the global dissolve put all of v2's accounts on one column-0 axis (Step 0: 16,165/29,405 px Y-stack, no separable lever). Per-group local axes + staircase is the only model that separates accounts that each contain a source. | no (core) |
| **DI-M3b-2** | M3b | **Multi-hull SCC flatten is REQUIRED, not optional.** A genuine mutual cycle's cross-member resource edges only read forward on ONE shared axis (CON-12), so members lose independent banding by necessity; singletons keep full `sizeAndArrange` structure + nested recursion. | The asymmetry Codex flagged is intentional: a 2-way mutual cycle IS one interwoven dataflow; a singleton is not. | no |
| **DI-M3b-3** | M3b | **The iron-rule gate (`backwardEdgeGate`) is RE-BASED**: an edge is excused only if its two clusters share a strongly-connected component of the **cluster graph `D`** — NOT because their LCA topology container is cyclic. Signature dropped the `cyclicContainers` param. | After the redesign most resource edges have the cyclic provider as their LCA, so the old LCA-keyed excusal would silently excuse every cross-group edge and go blind (Codex). `D` acyclic on v2 ⇒ 0 excused ⇒ the hard gate covers every edge. Also fixes a latent pre-M3b blind spot. | no (core) |
| **DI-M3b-4** | M3b | **`forcedBandViolations` → `siblingOverlapViolations`** — true **2D** overlap (X∧Y) among ANY container's children, policy-agnostic. | The old forced-only **Y-overlap** check false-positived the legitimate DEC-1 rise (3 on v2: X-disjoint risen accounts share Y, which is legal). 2D-overlap counts only real collisions; the rendered diagnostic gives the typed region/subnet/frame breakdown. | no |
| **DI-M3b-5** | M3b | Groups are **normalized rigid boxes** (`[0,w]×[0,h]`, one translation) placed in **canonical order** `(groupCol, minSeq, rep)`; the Y-rise (`placeRiseStack`) packs on **title-inflated footprints** (DI-M3a-8). `stronglyConnectedComponents` **extracted to shared** (reused by layering + the `D`-level gate). | Codex: a multi-hull SCC bbox may have `minX>0`; un-normalized translation breaks widths/collisions. Canonical order + the rigid-box contract preserve determinism (CON-8). DRY: one Tarjan, mirrors the `longestPath` extraction. | no |
| **DI-M3b-6** | M3b | **DEC-1 default `staircaseBandOverlap = true`** (X-disjoint groups rise to share rows); `false` = sequential stack (taller, the off-switch). Threaded `RcllBuildOptions → RcllOptions → PlaceCtx`. Internal only (no dialog/URL). **Mirror-width** parked; **DEC-3** region toggle deferred. | The height lever, now at the hull/group level where it bites. v2: rise on = 14,285/27,674 (−12%/−6%), collision 0. | no |
| **DI-M4-1** | M4 (Step 0) | **M4's "global top-spine alignment" has no v2 leverage** and is **deferred** (recorded §34.2): v2 has one provider, so "align accounts across providers" has nothing to act on, and M3b already staircases the accounts. | v2 is the only real preset; a single-provider org makes the global ruler identical to M3b's per-provider staircase. The win must come from a lever that bites on v2. (Step-0 measurement; the M3b discipline.) | superseded-by-reframe (DI-M4-3) |
| **DI-M4-2** | M4 (Step 0) | The reframe "**route every non-root container through the hull matrix**" (`placementMatrix`) was built behind a flag, measured, and **reverted**: on v2 it is **byte-identical to M3b** (full positional geometry, Compact + Full). | Proven no-op: the M3a forced/packed/mixed policies already equal the matrix — both use longest-path columns (M2's `localColumn` IS longest-path), and the width-aware staircase makes the DEC-1 rise degenerate to per-column stacking on acyclic containers; the swimlane branch only fires for cyclic containers, which already route through the matrix. Shipping a no-op adds blast radius (Codex #10) for zero value. | no (reverted) |
| **DI-M4-3** | M4 | **Shipped: `swimlaneLaneRise`** — extend the **DEC-1 Y-rise into swimlane interiors** (`layoutLanesOnAxis`). Each nested lane's frame is tightened to its content shared-column range (shift the lane's direct children by `−columnX[minCol]`, reposition the box); X-disjoint lanes then RISE via `riseStackY` instead of pure Y-stacking. | The one place the matrix does NOT reach on v2 is a swimlane's interior (`arrangeSubtreeOnAxis`, NOT `sizeAndArrange` — Codex #1). The pure Y-stack there is the reclaimable height. v2: −2.1% / −2.0%. | no (core) |
| **DI-M4-4** | M4 | **CON-12-safe by construction:** the rise changes only Y; **leaf absolute X is preserved** (the lane-box move is countered by the child shift), so leaves keep the shared `denseRank(LB)` column ⇒ cross-member edges still read forward. Gate unchanged; `acyclicBackwardEdges = acyclicSameColumnEdges = 0` under rise ON (verified). | The shared axis is what makes a 2-way swimlane's cross-edges forward; the rise must not break it. Tightening + counter-shift keeps leaf X identical (unit-tested ON==OFF leaf X). | no |
| **DI-M4-5** | M4 | **Front-end A/B toggle**, default **OFF** (== M3b): dialog control "Swimlanes · Stacked / Risen" (RCLL-only, `TerraformImportPipelineSettings`) + `swimlaneRise` URL param; threaded `pipelineSwimlaneLaneRise` through the import chain → `RcllBuildOptions.swimlaneLaneRise`. `rcllMilestone` → `"M4"` + `rcllSwimlaneLaneRise` meta when active (Codex #9: metadata must reflect the global placement change). | The user asked to A/B-test before committing a default; OFF == M3b means zero blast radius until flipped. URL param enables shareable side-by-side links. | no |
| **DI-M4-6** | M4 | The **edge-length median reorder** originally scoped for M4 is **deferred to M6**; the `edgeLength` metric is dropped from M4 (no consumer). **DEC-10** (independence gap) parked. | Eng-review A1: reordering hulls within a column by median-Y is structurally Sugiyama's *ordering* phase (M6), and it couples to the Y-rise (a group's Y depends on placement order), so "minimize edge length at fixed height" is an order-dependent proxy — it belongs in M6, not here. | no |
| **DI-ANC-1** | Ancillary | **Shipped (UI-only): the RCLL "All resources" option is disabled** (greyed + a "not in this layout / planned" note via the `resources.allRcll` help entry) and "Dataflow only" reads active. `TerraformImportPipelineSettings.option()` gains a `disabled` arm gated on `!showVariant` (RCLL view); SCSS `:disabled`. No engine/model change. | The toggle threaded end-to-end but RCLL is dataflow-only, so it silently no-op'd — a lying control. Disabling it (rather than hiding) keeps the feature discoverable as "coming soon" while reflecting reality. | reconciled when reserved band ships |
| **DI-ANC-2** | Ancillary | **The correct design is a model-phase reserved bottom band** per container (a distinct `ancillaryBand` role placed in `sizeAndArrange` below the dataflow columns in a disjoint-Y region, like the `mixed`-VPC policy), so the container **footprint reserves the space** (no collision), it is not a column (no `columnWidths` reflow), and it is not a `primaryCluster` (no metric pollution). | Two cheaper approaches were eliminated by measurement/analysis: **column-leaf injection** reflows columns + pollutes `primaryClusterCount` (code analysis); **export-phase placement** measured **90/86 collisions on v2** (export only re-stacks providers, so a strip grows a region into the next region). Only model-phase space reservation holds the gate. | future milestone |
| **DI-ANC-3** | Ancillary | **Feature DEFERRED** (not built now). Codex showed the reserved band is a real placement-engine milestone with ~5 interaction points: role-blindness in `collectClusterLeaves` + the cyclic `arrangeByHullMatrix` engine; inject **before** `runRcllPipeline` (layering + placement both clone); a determinism re-sort after tree injection; a **mandatory band-width cap** (the container footprint width still feeds the parent's `columnWidths`, so a wide band shifts siblings); the empty-`normalKids` case. | User chose to defer the feature and ship the honest toggle (DI-ANC-1) after the scope grew across three architectures. Adding ancillary necessarily grows/shifts the diagram (a band makes a container taller), so a future build must accept Y-growth + cap band width to preserve dataflow X. | future milestone |

### 34.2 Implemented-vs-specified delta (as-built, M3a-hardening)

Where the **normative prose elsewhere in this RFC describes an intent the code does not (yet) match**, so a future agent reading a section in isolation is not misled. Each row: spec says · code does · why.

| Topic | Spec says | As-built (M3a) | Why / when reconciled |
| --- | --- | --- | --- |
| **Root policy** ([§8](#8-per-level-placement-policy)) | `root → providers = forced band` | `root = passthrough` (children get column X only; provider **Y** owned solely by `applyCompoundHierarchicalLayout`'s reanchor). | One owner for provider Y; matches compound's proven behavior (DI-M3a-7). |
| **Staircase Y-overlap** ([§28](#28-configuration--module-api-surface) `staircaseBandOverlap`, [FLEX-2](#4-requirements-catalogue)) | default `true` (DEC-1 "on") | behaves as **`false`** — forced bands strictly disjoint. | DEC-1(B) rise-beside is M3b (DI-M3a-4); makes collision = 0 hold by construction meanwhile. |
| **`coordRoundingPx`** ([§28](#28-configuration--module-api-surface), [§30](#30-determinism-specification-normative)) | tunable, default 1 | **accepted but unread** — hard-coded `Math.round` (1px). | Default matches; wire to the option when a non-1 caller appears. |
| **`hugeFanoutThreshold`** ([§28](#28-configuration--module-api-surface), [DEC-7](#14-open-design-decisions)) | grid-wrap past N | **accepted but unread** — DEC-7 unimplemented; a `1→N` fan-out shares one tall column. | No v2 preset hits it; guard/grid-wrap is a robustness follow-up. |
| **Cyclic placement** ([§26](#26-edge-cases--degenerate-inputs)/[DEC-8](#14-open-design-decisions)) | "model-order stack in a shared column band" | **DEC-8(C) swimlane** — a *spurious* hull cycle is dissolved onto a shared cluster column axis; sibling hulls become Y-lanes (DI-M3a-16). The earlier DEC-8(B) SCC-shared-column (DI-M3a-12) is **superseded** (it made sibling hulls read same-column). | Implemented at M3a-hardening-2; matches Sander [R6]. Genuine `D`-cycle path = lane + EXT-12. |
| **`emitTopologyContextFrames`** ([§21](#21-appendix-b--implementation-file-map)) | named reuse target | code calls **`buildCompoundFramesFromLayoutBoxes`** (an alias of the same function). | Rename drift; same behavior. |
| **`semanticEdgeViolations`** ([§13](#13-invariants--acceptance-gates)) | listed as an acyclic-guard gate (`= []`) | the **iron rule** (`backwardEdgeGate`, CON-12) is the gate; the rendered `semanticEdgeViolations` is observed-only (DI-M3a-14). | Disambiguated at M3a-hardening. |
| **Ancillary strips** ("All resources") | the unconnected resources render as per-scope "Unconnected" strips (compound/classic behavior) | **NOT drawn in RCLL** (model is dataflow-only). Investigated 2026-06-18: **export-phase placement measured 90/86 collisions on v2** (RCLL positions accounts/regions/VPCs in the model phase; export only re-stacks providers, so a strip grows a region hull into the next region). The correct design — a **model-phase reserved bottom band** per container (like the `mixed`-VPC policy: a disjoint-Y region below the columns, so the footprint reserves the space) — is a real placement-engine milestone (DI-ANC-2). | **Feature DEFERRED** (DI-ANC-3) — design + Step-0 evidence recorded; the inert toggle was **disabled under RCLL** so it can't mislead (the honest interim, DI-ANC-1). Reconciled when the reserved-band milestone is built. |
| **Global top-spine ruler** ([§11](#11-hybrid-column-model), [REQ-7](#4-requirements-catalogue), M4) | a single diagram-wide `columnX[]` aligns `root→provider→account` across the whole diagram | **NOT built** — M4 found it has no v2 leverage (one provider; accounts already staircased by M3b). The interior is still **local/group-scoped** (§11). | Deferred (DI-M4-1) until a **multi-provider preset** exists to exercise + justify it. M4 shipped the swimlane lane-rise instead. |

### 34.3 Commit map (what each commit implemented · decided · amended)

Retroactive audit trail: every RCLL commit linked to the work it carries. `Implemented` = code/tests shipped; `Decided` = the DI/DEC/CON records settled; `Amended` = what it changed or superseded in this RFC or a prior milestone. Resolve a hash with `git show <hash>`.

| Commit | Milestone | Implemented | Decided | Amended |
| --- | --- | --- | --- | --- |
| `497450e72` | RFC v0.5 | The design doc itself (§1–§36: lattice, algorithm, milestones, glossary). | D1–D12, DEC-1…8, the priority lattice T1–T7, the M0–M12 build plan. | — (initial RFC). |
| `ff77beac4` | M0a | RCLL top-level view; ELK-style **import→pipeline→export** seam with **zero** stages; compound builder wired as the §27 fallback rung; §28 contract types (`terraformPipelineRcllTypes.ts`). | DI-M0a-1..3 (export `runRcllPipeline` + `stages` param; collect `StageResult.meta`; `rcll` skips KV cache + dialog hides variant). | **Retired the Experimental view** (took its slot). |
| `be46f7c76` | M0b | Polyline-aware crossing counter; readability metrics (`fanoutColumnRate`/`hubCenteringRate`/`aspect`) + companion counts; §35 adversarial fixtures. | DI-M0b-1..5 (de-dupe per arrow **pair**; ΔY = polyline vertical extent; rate 0 on empty denom; ε=36px / tol=75px dials; two-sided hub-centering). | Crossing metric: straight-chord → **polyline-aware**. |
| `acaa4ead4` | M1 | `buildRcllModel` → compound tree + lattice (UB/slack, fan-out/fan-in, `D_H` LCA up-projection, container-cycle flags); shared prep threaded into the fallback. | DI-M1-1..8 (leaf keyed by `cluster.id`; `UB ≥ LB`; declared-edge merge without double-count; **detect-only** cycles; unguarded import). | **DEC-2 settled** (cross-hull fan-out at the LCA). |
| `651d87dfd` | M2 | `layeringStage` writing `localColumn` (longest-path floors + hull staircase + fan-out pinning); extracted shared `longestPath`. | DI-M2-1..5 (model-only; **cyclic → sequential columns** [*superseded — see hardening*]; T1 > T4; extract `longestPath`; pure transform). | `computeDepths` routed through shared `longestPath` (byte-identical). |
| `e6f367723` | docs | §34.1 implementation decision log (backfill DI-M0a…M2). | Standing practice: every settled decision is mirrored to §34.1. | Restructured §34 into §34.0 (design-time D*) + §34.1 (as-built DI-*). |
| `c25f0b2a1` | M3a | `placementStage` — **first geometry**: forced bands + packed column-stack + derived hull frames; collision gate = 0 (Compact + Full); shared `columnOffsetsFromWidths`. | DI-M3a-1..10 (split M3a/M3b; packed = column-stack; structural gates only; DEC-1 off; provider-Y via reanchor; footprint reserves title; skeleton-origin pre-compensation). | **Retired the "geometry ≡ compound" invariant.** |
| `ee0e44e93` | **M3a-hardening** | **CON-12 iron-rule gate** (`backwardEdgeGate` on placed boxes, Compact + Full); **cyclic DEC-8(B) SCC condensation** (Tarjan + condensation longest-path); **EXT-12 back-edge styling** (dashed + `#e8590c` + `terraformBackEdge`); §27 finite-check; empty-subnetZone mixed-vpc fix; height anchor; fan-out sort key. | DI-M3a-11..15 (iron rule **gated, not deferred**; SCC condensation; wrap-edges excused + styled; `semanticEdgeViolations` disambiguated; `isDeleted` false-0 finding). | **Supersedes DI-M3a-3** (semanticEdgeViolations now *gated* via CON-12) and **DI-M2-2** (cyclic sequential strip → SCC condensation); restated **CON-6** as the width-aware pixel guarantee; added §34.2 delta + this §34.3 map. |
| `9393013dc` | docs | §34.3 commit-map hash backfill. | — | Filled `ee0e44e93` into the M3a-hardening row above (its own hash was unknowable when written). |
| `68fa65398` | **M3a-hardening-2** | **Extended iron rule (no same-column edge) + swimlane placement for spurious hull cycles.** `arrangeLaneSubtree` dissolves a cyclic container onto a shared `denseRank(LB)` cluster axis with sub-hulls as Y-lanes; `backwardEdgeGate` keys off the box **left edge** + adds `acyclic/cyclicSameColumnEdges`; `policyForContainer` is role-only (cyclic routed to lanes upstream). Swimlane unit suite + v2 integration asserts (`acyclicBackward = acyclicSameColumn = 0`, both modes). | DI-M3a-16/17 (no-same-column half of CON-12; spurious cycle → swimlane, **supersedes DI-M3a-12/DEC-8(B)**; left-edge gate + circular-import threshold fix). | **Supersedes DI-M3a-12** (SCC-shared-column → swimlane) and makes **DI-M3a-13** moot on v2 (0 wrap-edges); scoped **CON-6** to spine hulls; extended **CON-12** (no same-column); added **DEC-8(C)**; §8 swimlane row; §11 lane boundary. |
| `e62a9e46b` | **M3b** | **Hull-aware cyclic placement.** `arrangeCyclicContainer` decomposes a cyclic container's `D_H` into SCCs — multi-hull SCC → swimlane (`arrangeSwimlaneGroup`, shared axis), one-way condensation → staircase + DEC-1 Y-rise (`placeRiseStack`); `stronglyConnectedComponents` extracted to `terraformPipelineLayoutShared`; `backwardEdgeGate` re-based off cluster-graph `D` SCCs (dropped `cyclicContainers` param); `forcedBandViolations` → `siblingOverlapViolations` (2D); `staircaseBandOverlap` default true, threaded through the builder. v2: −12%/−6% height, collision 0, iron rule 0. | DI-M3b-1..6 (SCC decompose; flatten required; gate re-base; 2D overlap metric; normalized rigid box + canonical order + Tarjan extract; DEC-1 default on / mirror-width parked / DEC-3 deferred). | **Refines DEC-8(C)** (per-SCC axis, supersedes DI-M3a-16's global dissolve); **DI-M3a-4** moot (DEC-1 now on at the hull level); marks `rcll-m3a-cyclic-dec8-deferred` superseded. |
| `956d387a0` | **M4** | **Swimlane interior lane-rise** (`swimlaneLaneRise`). `layoutLanesOnAxis` tightens each lane to its content shared-column range (child counter-shift preserves leaf X) + `riseStackY` lifts X-disjoint lanes (CON-12-safe); `arrangeCyclicContainer` renamed `arrangeByHullMatrix`; option threaded `RcllBuildOptions → RcllOptions → PlaceCtx → LaneContext` + the import chain (`pipelineSwimlaneLaneRise`); front-end "Swimlanes · Stacked / Risen" control + `swimlaneRise` URL param; `rcllMilestone` → `"M4"`. v2: −2.1%/−2.0% height, all gates 0. | DI-M4-1..6 (spine ruler deferred; universal-matrix dispatch built-then-**reverted** as a v2 no-op; swimlane lane-rise shipped; CON-12-safe; A/B toggle default OFF; reorder→M6, DEC-10 parked). | Deferred the **global spine ruler** (§34.2); **DI-M4-1/-2** record the two reframes; the M6 row gains the edge-length reorder; **DEC-10** added. |
| _(pending)_ | **Ancillary** | **RCLL "All resources" made honest (UI-only).** `TerraformImportPipelineSettings.option()` gains a `disabled` arm; under RCLL (`!showVariant`) "All resources" is disabled + "Dataflow only" forced active; `resources.allRcll` help entry; SCSS `:disabled`. Dialog test asserts disabled + active + `pipelineIncludeAncillary:false`. No engine/model change. | DI-ANC-1..3 (honest toggle shipped; reserved-band is the correct design; feature deferred after column-leaf [rejected] + export-phase [measured 90/86 collisions] eliminated). | Updated §34.2 "Ancillary strips" row (export-phase collision finding + reserved-band design); no prior decision superseded. |

### 34.4 Decision dependency graph (blast radius)

The change-log is the **narrative**, [§34.1](#341-implementation-decision-log-di--per-milestone-as-built) the **registry**, [§34.3](#343-commit-map-what-each-commit-implemented--decided--amended) the **commit↔decision** map. This section adds the missing axis: **what depends on what**, so a reversal's blast radius is explicit (DOC-4/DOC-5). Two relations:

- **Depends-on** — `A → B` means **"B rests on A; reverting/changing A forces re-deciding B."** B's premises are A.
- **Supersession** — `A ⊟ B` means **B replaced A** (drawn dashed). The superseded row is retained (DOC-3); its dependents move to the superseding row.

**Premise roots** (not themselves DI-decisions): the design-time decisions **D1–D12** + the priority lattice **T1–T7** (the algorithm), the hard constraints **CON-\***, the open decisions **DEC-\***, and **measured findings** (e.g. the M1 "`D_H` has 6 cyclic containers" probe, the M3b Step-0 "v2 provider is one cyclic container" probe). A finding root that changes invalidates everything below it (DOC-4).

#### Complete dependency table (every DI-\*)

| DI | Depends on (premises) | Supersession |
| --- | --- | --- |
| **DI-M0a-1** | §28 seam contract | — |
| **DI-M0a-2** | DI-M0a-1 | — |
| **DI-M0a-3** | §18/§32 view routing | — |
| **DI-M0b-1** | DEC-6 | — |
| **DI-M0b-2** | DEC-6 | — |
| **DI-M0b-3** | DEC-6 | — |
| **DI-M0b-4** | DEC-6, FLEX-5 | tunable |
| **DI-M0b-5** | DEC-6, §13 centering | — |
| **DI-M1-1** | §6.2 compound tree | — |
| **DI-M1-2** | DI-M1-1 | — |
| **DI-M1-3** | `computeUpperBounds` | ⊟ by **DI-M2-4** |
| **DI-M1-4** | — (unguarded import) | revisit |
| **DI-M1-5** | `computeDepths` | — |
| **DI-M1-6** | DEC-2, DI-M1-1 | — |
| **DI-M1-7** | DI-M0a-1 | — |
| **DI-M1-8** | DI-M1-6 (`D_H`), finding "DAG up-projects to non-DAG" | acted on by DI-M2-2, DI-M3a-5/12/16, DI-M3b-1 |
| **DI-M2-1** | DI-M1-1, DI-M1-6 | — |
| **DI-M2-2** | DI-M1-8 | ⊟ by **DI-M3a-12** |
| **DI-M2-3** | DI-M2-1, T1>T4 | — |
| **DI-M2-4** | DI-M1-3 (4th consumer) | supersedes **DI-M1-3** |
| **DI-M2-5** | DI-M0a-1 | — |
| **DI-M3a-1** | DI-M2-1 | — |
| **DI-M3a-2** | DI-M2-1 | M5/M7 refine |
| **DI-M3a-3** | DI-M3a-1 | ⊟ by **DI-M3a-11** |
| **DI-M3a-4** | DI-M3a-1, DEC-1 | moot after **DI-M3b-6** |
| **DI-M3a-5** | DI-M1-8, DI-M2-2 | ⊟ by **DI-M3a-12** |
| **DI-M3a-6** | DI-M2-5 | — |
| **DI-M3a-7** | reanchor (compound) | — |
| **DI-M3a-8** | footprint/title model | used by DI-M3b-5 |
| **DI-M3a-9** | DI-M3a-8 | — |
| **DI-M3a-10** | DI-M2-4 (extract pattern) | used by DI-M3b-1 |
| **DI-M3a-11** | DI-M3a-3, CON-1, CON-6, finding "100% of v2 backward edges are cyclic-LCA" | supersedes **DI-M3a-3** |
| **DI-M3a-12** | DI-M3a-11, DI-M3a-5, DI-M2-2 | supersedes **DI-M2-2**; ⊟ by **DI-M3a-16** |
| **DI-M3a-13** | DI-M3a-12, EXT-12 | moot after **DI-M3a-16** |
| **DI-M3a-14** | DI-M3a-11 | — |
| **DI-M3a-15** | finding (`isDeleted` false-0) | flag |
| **DI-M3a-16** | DI-M3a-11, DI-M1-8, CON-12, user report (same-column subnets) | supersedes **DI-M3a-12**; ⊟ refined by **DI-M3b-1** |
| **DI-M3a-17** | DI-M3a-11 | — |
| **DI-M3b-1** | **Step-0 finding (M3b)**, DI-M3a-16, DI-M1-8, DI-M1-1, DI-M2-4, DI-M3a-10, DEC-8(C) | refines **DI-M3a-16** (per-SCC vs global) |
| **DI-M3b-2** | DI-M3b-1, CON-12 | — |
| **DI-M3b-3** | DI-M3b-1, DI-M3a-11, CON-1, CON-12 | supersedes DI-M3a-16's LCA-keyed excusal |
| **DI-M3b-4** | DI-M3b-1, DI-M3a-3 | supersedes the forced-only Y-overlap metric |
| **DI-M3b-5** | DI-M3b-1, DI-M2-4, DI-M3a-8 | — |
| **DI-M3b-6** | DI-M3b-1, DEC-1, DI-M3a-4 | moots **DI-M3a-4** |
| **DI-M4-1** | **Step-0 finding (M4)**, REQ-7, DI-M3b-1 | deferred → §34.2; superseded-by-reframe **DI-M4-3** |
| **DI-M4-2** | DI-M4-1, Step-0 probe, DI-M2-1 (longest-path == localColumn), DI-M3b-6 (rise degenerates) | reverted (no-op) |
| **DI-M4-3** | DI-M4-2 (the no-op pointed here), DI-M3b-1, DI-M3b-6, DEC-1, CON-12 | extends DEC-1 into swimlane interiors |
| **DI-M4-4** | DI-M4-3, CON-12, DI-M3a-16 (shared axis) | — |
| **DI-M4-5** | DI-M4-3, DI-M3b-6 (option-threading pattern) | — |
| **DI-M4-6** | DI-M4-3, EXT-1/M6, DEC-1 | reorder deferred → M6; DEC-10 parked |

#### Lineage — cyclic placement (the most-evolved chain)

```mermaid
flowchart TD
  F1["finding (M1): D_H has 6 cyclic<br/>containers; D acyclic"]
  S0["finding (Step 0, M3b): v2 provider is<br/>ONE cyclic container, accounts on column-0 axis"]
  M1_8["DI-M1-8<br/>detect + flag cycles only"]
  M2_2["DI-M2-2<br/>cyclic → sequential columns 0,1,2…"]
  M3a5["DI-M3a-5<br/>place via M2 seq columns"]
  M3a12["DI-M3a-12<br/>DEC-8(B) SCC condense → one column"]
  M3a16["DI-M3a-16<br/>DEC-8(C) swimlane: global shared axis"]
  M3b1["DI-M3b-1<br/>SCC decompose: 2-way swimlane / 1-way staircase"]
  F1 --> M1_8
  M1_8 --> M2_2 --> M3a5
  M3a5 -. ⊟ .-> M3a12
  M2_2 -. ⊟ .-> M3a12
  M3a12 -. ⊟ .-> M3a16
  M3a16 -. ⊟ refined .-> M3b1
  S0 --> M3b1
  M1_8 --> M3b1
```

#### Lineage — the iron rule (CON-12)

```mermaid
flowchart TD
  CON1["CON-1 / CON-6<br/>precedence + width-aware staircase"]
  M3a3["DI-M3a-3<br/>semanticEdgeViolations observed, not gated"]
  M3a11["DI-M3a-11<br/>iron rule GATED on boxes (backwardEdgeGate)"]
  M3a16b["DI-M3a-16<br/>+ no-same-column half; LCA-keyed excusal"]
  M3a17["DI-M3a-17<br/>gate keys off box LEFT EDGE"]
  M3b3["DI-M3b-3<br/>excusal RE-BASED on cluster-graph D SCCs"]
  M3b4["DI-M3b-4<br/>forcedBand → siblingOverlap (2D)"]
  CON12(["CON-12 (hard constraint)"])
  M3a3 -. ⊟ .-> M3a11
  CON1 --> M3a11
  M3a11 --> M3a16b
  M3a11 --> M3a17
  M3a16b -. ⊟ excusal .-> M3b3
  M3a11 --> M3b3
  M3b3 --> CON12
  M3a17 --> CON12
  M3a3 -. ⊟ metric .-> M3b4
  M3b4 --> CON12
```

**Worked examples (blast radius).**

- Revert **DI-M3b-1** (stop SCC-decomposing) → its dependents **DI-M3b-2/3/4/5/6 all collapse**, and placement falls back to **DI-M3a-16** (global dissolve): v2's column-0 Y-stack returns (−12%/−6% lost) and **DI-M3b-3**'s re-based gate is moot, so **CON-12** loses its honest verifier on real data.
- Change the **Step-0 finding** (a future preset's provider is *not* one cyclic container) → by DOC-4, re-evaluate **DI-M3b-1** and everything below it; the swimlane/staircase split may no longer be the right shape.
- **DI-M3b-3** (gate re-base) is load-bearing for **CON-12** *independent* of the placement: even if the geometry changed again, the gate MUST key off cluster-graph `D` SCCs or it goes blind once most edges sit under a cyclic container.

---

## 35. Test fixture matrix

Synthetic minimal fixtures (fast, no preset DB) exercise one behavior each; the real preset is the integration backstop. Each asserts the named invariant/metric.

| Fixture | Exercises | Asserts | Edge case |
| --- | --- | --- | --- |
| `fanout-column` | one source → 3 targets | targets share a column (T4); rate 100 % | §26 fan-out |
| `hub-centering` | hub over even/odd fan-out | hub Y within ε of median (T5) | DEC-2/DEC-6 |
| `forced-bands` | 2 regions, 1 account | distinct Y bands; containment | CON-5 |
| `staircase` | hull A→B dependency | B deeper than A; (DEC-1) Y-overlap behavior | CON-6 |
| `cross-hull-fanout` | root → 3 accounts | LCA centering; spine aligned | DEC-2 |
| `cycle` | A→B→A | localized fallback; `pipeline_cycle`; no global flatten | CON-2/DEC-8 |
| `disconnected` | 2 components | both placed; order by firstSequence | §26 disconnected |
| `missing-topology` | cluster w/o account | `unknown` bucket; no invented topology | A2/CON-7 |
| `huge-fanout` | 1 → N>threshold | grid-wrap; no runaway column | DEC-7 |
| `deep-chain` | 30-hop linear | width accepted; no false compaction | §26 deep chain |
| `degenerate-no-depth` | nodes, no depth-creating edges | single column vertical stack, still valid | §26 |
| `determinism` | any of the above ×2 | byte-identical builds | CON-8/§30 |
| `module-failure` (inject) | force a stage to throw | falls back one rung; `rcllDegraded` set | §27 |
| `staging-extended-localstack-v2` | full integration | gates 0; readability ↑ vs baseline; both Compact & Full | §17 |

Run via the existing `terraformPipeline*` test harness; the determinism and collision gates are wired into the acceptance suite (§13, §17).

---

## 36. Appendix C — Visual glossary

A figure for every concept and every decision, so the whole design can be understood visually. **Structural** diagrams use Mermaid; **geometric** diagrams use ASCII "before/after" sketches that show real relative position. Convention throughout: **X = TFD/column axis, increasing →**; **Y = cross/row axis, increasing ↓**. Captions tie each figure to its section/ID.

### C.1 Structural concepts (Mermaid)

**C.1.1 Compound topology tree** (§6) — the nesting every hull/cluster lives in.

```mermaid
flowchart TD
  root["root"] --> prov["provider (aws)"]
  prov --> acc1["account: workload"]
  prov --> acc2["account: ingestion"]
  prov --> acc3["account: security"]
  acc1 --> reg1["region: us-east-1"]
  reg1 --> vpc1["vpc: app"]
  vpc1 --> sz1["subnetZone: private"]
  sz1 --> c1["primaryCluster: ecs_producer"]
  sz1 --> c2["primaryCluster: api1"]
  reg1 --> rdirect["primaryCluster: region-direct (no VPC)"]
```

**C.1.2 TFD DAG `D` vs hull-edge up-projection `D_H`** (§6.3) — cluster edges roll up to sibling-hull edges at their LCA container.

```mermaid
flowchart LR
  subgraph Dsub["TFD DAG D (clusters)"]
    a["ecs_producer (acct A)"] --> b["ingest_fifo (acct B)"]
  end
  subgraph DHsub["D_H at root/provider (hulls)"]
    A["hull: account A"] --> B["hull: account B"]
  end
  a -. "up-project to LCA" .-> A
  b -. "up-project to LCA" .-> B
```

**C.1.3 Fan-out & fan-in sets** (§6, T4/T5) — hubs and convergence nodes.

```mermaid
flowchart LR
  hub["hub u"] --> t1["target B"]
  hub --> t2["target C"]
  hub --> t3["target D"]
  s1["source P"] --> w["convergence w"]
  s2["source Q"] --> w
  classDef pin fill:#eef,stroke:#669;
  class t1,t2,t3 pin;
```

_Fan-out targets B/C/D (shaded) are **pinned** to a shared column (T4); the hub is centered on their median (T5). Sources P/Q are **not** column-forced (FLEX-4), but `w` is centered on them._

**C.1.4 Data model (ER)** (§6.2) — the objects passed between stages.

```mermaid
classDiagram
  class CompoundNode {
    key
    role
    minDescendantSequence
    box
    localColumn
  }
  class PipelineCluster {
    id
    primaryAddress
    firstSequence
    depthFloor_LB
    width
    height
  }
  class HullEdge {
    from
    to
    weight
    declared
  }
  class Lattice {
    floors_LB_UB_slack
    fanoutSets
    hullEdgeDAGs
  }
  CompoundNode "1" o-- "many" CompoundNode : children
  CompoundNode "1" --> "0..1" PipelineCluster : leaf
  Lattice "1" --> "many" HullEdge : per-container
```

**C.1.5 Decision → stage map** (§22/§24) — which decision tunes which module.

```mermaid
flowchart LR
  DEC1["DEC-1 staircase overlap"] --> C["1d Centering / forced-band Y"]
  DEC2["DEC-2 cross-hull LCA"] --> C
  DEC3["DEC-3 region policy"] --> C
  DEC4["DEC-4 aspect"] --> W["3 Pack-left"]
  DEC5["DEC-5 dummy nodes"] --> P["1d+ Path-straighten"]
  DEC6["DEC-6 epsilon + crossing metric"] --> O["1c Ordering"]
  DEC7["DEC-7 huge fan-out"] --> L["1a Layering"]
  DEC8["DEC-8 SCC cycle"] --> L
  EXT1["EXT-1 crossings"] --> O
  EXT3["EXT-3 orthogonal + ports"] --> R["4 Routing"]
  EXT5["EXT-5 tint / legend"] --> E["R Encoding"]
  EXT9["EXT-9 mental-map"] --> X["X Cross-cutting"]
  EXT10["EXT-10 faithfulness"] --> X
  EXT11["EXT-11 aspect / viewport"] --> W
  EXT12["EXT-12 no-back-edge"] --> R
```

### C.2 Geometric concepts (ASCII before/after)

**C.2.1 Fan-out centering — D7/D8, T5.** Hub centered on the median child, not inline with the first.

```text
  BAD (inline with first child)        GOOD (centered on median)
  A ── B                                      ┌─ B
       C                               A ──────┼─ C
       D                                      └─ D
  (A aligned to B; reads lopsided)     (A centered over B/C/D)
```

**C.2.2 Hull staircase — CON-6 / D6.** A one-way hull→hull edge puts the dependent hull deeper (→) and lower (↓).

```text
   col0        col1
  ┌───────┐
  │ hull A│──────┐
  └───────┘      ▼
              ┌───────┐
              │ hull B│      (A → B  ⇒  B is right of and below A)
              └───────┘
```

**C.2.3 Forced bands vs packed row-share — D2 / D5 / §8.**

```text
  FORCED (each sibling its own band)     PACKED (X-disjoint siblings share a row)
  ┌─ region us-east-1 ───────┐           ┌─ region us-east-1 ─┐ ┌─ region us-west-2 ┐
  │ ...                      │           │ ...                │ │ ...               │
  └──────────────────────────┘          └────────────────────┘ └───────────────────┘
  ┌─ region us-west-2 ───────┐            (side-by-side; shorter)
  │ ...                      │
  └──────────────────────────┘
  (distinct rows; taller, cleanest ownership)
```

**C.2.4 Push-right → row-share — T6 (height ↓).** A _free_ node with slack moves right into an existing row instead of opening a new one.

```text
  BEFORE (free node F at its floor)     AFTER (F pushed right to share a row)
  col0   col1   col2                    col0   col1   col2
  A      B                              A      B      F
  F                                     (F joined row 0; one fewer row)
  (F alone on row 1 → taller)
```

**C.2.5 Pack-left — T7 (width ↓), fan-out group moves as a unit.**

```text
  BEFORE (slack on the left)            AFTER (pulled left, group intact)
  col0        col2   col3               col0   col1   col2
  A                  ┌B                  A      ┌B
                     │C                         │C
                     └D                         └D
  (gap at col1; too wide)               (B/C/D kept its shared column + centering)
```

**C.2.6 Hybrid columns — D3 / §11.** Spine columns align globally; columns inside an account are local.

```text
  GLOBAL spine grid:   col0      col1        col2
                       root ──> account ──> account ...   (aligned across whole diagram)
  LOCAL inside acctA:  [ hop0  hop1  hop2 ]  (its own column origins)
  LOCAL inside acctB:  [ hop0 hop1 ]         (need not match acctA's hop X)
```

**C.2.7 DEC-1 — forced-band Y-overlap on a staircase.**

```text
  OPTION A (no overlap; taller)         OPTION B (recommended; X-disjoint may rise)
  ┌A┐                                   ┌A┐ ┌B┐
  └─┘                                   └─┘ └─┘   (B rose beside A; shorter)
      ┌B┐
      └─┘
```

**C.2.8 DEC-2 — cross-hull fan-out at the LCA.** Hub centers on child-hull medians, clamped to its band.

```text
  org_root ─┬─> [account: workload ]
            ├─> [account: ingestion]   (hub centered on the 3 hull centers,
            └─> [account: security ]    evaluated at the LCA = provider/root)
```

**C.2.9 DEC-7 — huge fan-out.**

```text
  OPTION A (one tall column)            OPTION B (grid-wrap past N)
  u ─ t1                                u ─ t1 t5 t9
      t2                                    t2 t6 t10
      t3   ... (200 rows)                   t3 t7 t11
      tN                                    t4 t8 ...   (bounded height)
```

### C.3 Decision cards

Every decision is represented. Open decisions show **A vs B**; settled decisions (D-series) and extras (EXT-series) show the chosen behavior. Figures are reused where one drawing covers several IDs.

**C.3.1 Open decisions (DEC-1…DEC-8)**

| ID | Figure | One-line |
| --- | --- | --- |
| DEC-1 | C.2.7 | Forced-band staircase: no-overlap (A) vs rise-beside (B, rec). |
| DEC-2 | C.2.8 | Cross-hull fan-out centered at the LCA. |
| DEC-3 | C.2.3 | Region **forced** (taller, cleanest) vs **packed** (shorter). |
| DEC-4 | below | Aspect target: `height-first` \| `ratio` \| `viewport`. |
| DEC-5 | below | Dummy nodes for column-skipping edges: off (v1) vs on (straighter). |
| DEC-6 | C.1.5 | ε tolerance + polyline-aware crossing counter (feeds 1c). |
| DEC-7 | C.2.9 | Huge fan-out: tall column (A) vs grid-wrap past N (B, rec). |
| DEC-8 | below | SCC cycle: break with back-edge vs model-order stack (rec). |

```text
DEC-4 aspect modes:
  height-first → [tall? then pull width]      ratio 16:9 → [ ■■■■■ ]      viewport → fit screen box

DEC-5 dummy nodes (edge skips col1):
  OFF:  A ─────────────▶ C   (diagonal over col1)
  ON:   A ─▶ (•) ─▶ C        (• = dummy in col1 ⇒ straight, costs an element)

DEC-8 cycle A→B→A:
  BREAK:  A ─▶ B ╌╌▶ A   (one visible back-edge)
  STACK:  [ A  B ]  one shared column band, model order  (recommended; no back-edge)
```

**C.3.2 Settled decisions (D1…D12)**

| ID | Figure | Decision (settled) |
| --- | --- | --- |
| D1 | — (process) | Report-first; rollout at review. |
| D2 | C.2.3 | Forced sibling bands (no X-share) at chosen levels. |
| D3 | C.2.6 | Hybrid columns: global spine, local below. |
| D4 | C.2.4 + C.2.5 | Push free right (height), then pack left (width). |
| D5 | C.2.3 | Forced + packed policy split by level. |
| D6 | C.2.2 | Per-level forced toggle; hull→hull dep ⇒ deeper/right. |
| D7 | C.2.9 / C.1.3 | Fan-out shares a column even if taller. |
| D8 | C.2.1 | Center on median both ways; column-force fan-out only. |
| D9 | C.3.3 | Readability senior to compaction; groups move as units; recursive to hulls. |
| D10 | C.1.5 + §22 fig | Modular Lego; the lattice is the module contract. |
| D11 | §24 fig | Build order M0–M12 behind the flag. |
| D12 | §27 fig | Robustness contract + fallback ladder. |

**C.3.3 The priority lattice (T1…T7)** — the senior→junior order that D9 encodes (also inline at §5).

```mermaid
flowchart TD
  T1["T1 TFD precedence (hard)"] --> T2["T2 Hull nesting / forced bands (hard)"]
  T2 --> T3["T3 Hull→hull staircase (hard)"]
  T3 --> T4["T4 Fan-out shared column (readability-hard)"]
  T4 --> T5["T5 Centering / balance (readability)"]
  T5 --> T6["T6 Height compaction: push free right (optimize)"]
  T6 --> T7["T7 Width compaction: pack left (optimize)"]
```

_Read top→down as "senior to": a lower tier may optimize only within the freedom the tiers above leave; it must never violate a higher one. This single rule is the module contract (D10)._

**C.3.4 Optional extras (EXT-1…EXT-12)** — on/off or before/after for each.

```text
EXT-1  crossings      X X   →   ⫝ ⫝   (untangle; #1 readability factor)
EXT-2  path-straight  zig-zag spine  →  ──────── straight spine
EXT-3  orthogonal     ╲ diagonal     →  └─┐ right-angle + ports (src-right→tgt-left)
EXT-4  bundling       ╳╳╳ many lines →  ═══ one bundle (cross-hull only)
EXT-5  tint+legend    plain hulls    →  shaded by account + [legend]
EXT-6  salience       flat strokes   →  heavy spine, dim periphery, hover-path
EXT-7  grid-snap      jittery gaps   →  even grid, uniform combs
EXT-8  LOD/expand     all open       →  [collapsed] → click → [expanded]
EXT-9  mental-map     expand overlaps→  neighbors pushed minimally (stable)
EXT-10 faithfulness   accidental row →  guarded: geometry == real clusters
EXT-11 aspect/view    very tall      →  fit toward target ratio
EXT-12 no-back-edge   A◀──B (up-left)→  A──▶B (always forward)
```

_Defaults per §23.3: on by default — EXT-1, EXT-5, EXT-9, EXT-10, EXT-12 (and EXT-6 partial); toggle — EXT-3; off until proven — EXT-2, EXT-4, EXT-7; EXT-8 already largely present; EXT-11 target per DEC-4._

---

_End of RFC 0.5. This document is the agreed source of truth for the RCLL design discussion; amend via the change log._
