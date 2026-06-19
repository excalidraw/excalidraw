/**
 * RCLL (Recursive Compound Layered Layout) — §28 module-contract types.
 *
 * Source of truth: docs/pipeline-rcll-layout-design.md §6.2 (data model) and §28
 * (module API surface). These are the types the import→pipeline→export seam is
 * built against. At milestone M0 the pipeline registers ZERO stages and control
 * falls through to the compound builder (the §27 fallback rung), so nothing here
 * is exercised yet — but the seam type-checks against the real `Stage` contract,
 * so later milestones (M1 tree/lattice, M2 layering, …) register stages without
 * re-cutting the seam. The full `RcllOptions` knob set is filled in as modules
 * land; M0 needs only the content/detail flags it passes to the fallback.
 */
import type { PipelineCluster } from "./terraformPipelineLayoutShared";

/** Topology nesting role (§6.2). */
export type RcllTopologyRole =
  | "root"
  | "provider"
  | "account"
  | "region"
  | "vpc"
  | "subnetZone"
  | "primaryCluster";

/** A node in the compound tree T (§6.2); fields filled progressively in layout. */
export type CompoundNode = {
  key: string;
  role: RcllTopologyRole;
  level: number;
  /** min `firstSequence` over descendants — forced-stack ordering tiebreak. */
  minDescendantSequence: number;
  /** set iff `role === "primaryCluster"`. */
  cluster?: PipelineCluster;
  children: CompoundNode[];
  /** local then global box, assigned during layout. */
  box?: { x: number; y: number; width: number; height: number };
  localColumn?: number;
};

/** A sibling-hull dependency in a container's hull-edge DAG (§6.3, REQ-9). */
export type HullEdge = {
  from: string;
  to: string;
  weight: number;
  declared: boolean;
};

/**
 * Lattice state threaded between stages (§28): the priority-lattice inputs —
 * column floors/ceilings + slack, fan-out/fan-in sets, per-container hull-edge
 * DAGs. Populated at M1; fields are optional so the seam compiles before the
 * producers exist.
 */
export type Lattice = {
  /** LB(v): longest-path column floor, by cluster id. */
  floor?: ReadonlyMap<string, number>;
  /** UB(v): rightmost legal column, by cluster id. */
  ceil?: ReadonlyMap<string, number>;
  /** slack(v) = UB − LB, by cluster id. */
  slack?: ReadonlyMap<string, number>;
  /** out(u): fan-out target ids, by source id. */
  fanout?: ReadonlyMap<string, readonly string[]>;
  /** in(w): fan-in source ids, by target id. */
  fanin?: ReadonlyMap<string, readonly string[]>;
  /** per-container hull-edge DAG, by container key. */
  hullEdges?: ReadonlyMap<string, readonly HullEdge[]>;
  /**
   * Container keys whose hull-edge DAG `D_H` contains a cycle (CON-2). M1 flags
   * these only; the localized model-order-stack fallback for a cyclic subtree is
   * M3 (when boxes are first placed). Independent of `computeDepths`' global
   * cluster-level `hasCycle`.
   */
  cyclicContainers?: ReadonlySet<string>;
};

/**
 * Options selecting modules + tunables (§28). M0 uses only the pass-through
 * detail/content flags; the forced/packed policy, aspect, routing, and EXT-*
 * knobs are added as their modules land.
 */
export type RcllOptions = {
  /** primary-card-only clusters (true) vs satellites inline (false). */
  compact?: boolean;
  /** draw non-TFD resources in per-hull "Unconnected" strips. */
  includeAncillary?: boolean;
  /**
   * DEC-1 / FLEX-2 (default **true**): inside a cyclic container, X-disjoint SCC
   * groups laid out as a staircase **rise** in Y to share rows (the height lever).
   * `false` = each group stacked sequentially below the last (taller; the
   * off-switch). Internal only (no dialog/URL surface).
   */
  staircaseBandOverlap?: boolean;
  /**
   * M4 (default **false**): inside a swimlane (a multi-hull SCC group), X-disjoint
   * **lanes rise** to share Y rows (DEC-1 extended to swimlane interiors) instead of
   * pure Y-stacking. Each lane's frame is tightened to its content shared-column
   * range while **leaf X is preserved** (CON-12-safe — cross-member edges stay
   * forward). `false` ⇒ M3b lane Y-stack. The A/B toggle (dialog + URL):
   * "Swimlanes · Stacked / Compact".
   */
  swimlaneLaneRise?: boolean;
  /**
   * M6 (default **false**): crossing minimization (RFC §7.2c). The within-column
   * leaf Y-order is chosen by a per-container **barycenter** reorder, accepted only
   * when it **strictly reduces** a model-level crossing count (else model order).
   * X (columns) is untouched — order only, so the iron rule is unaffected.
   * `false` ⇒ model-order stacking. The A/B toggle: "Ordering · Off / On".
   */
  reorder?: boolean;
  /**
   * M5 (default **false**): coordinate assignment / **straightening** (RFC §9, Axis-1
   * = Brandes–Köpf). After M6 settles the within-column order, each leaf is assigned a
   * Y that aligns it with its dataflow neighbours in adjacent columns (the spine reads
   * flat), replacing the naive top→down stack. **Y only** — column X + within-column
   * order (M6) untouched, so the iron rule (CON-12) holds. `false` ⇒ plain stack. The
   * A/B toggle: "Straighten · Off / On".
   */
  straighten?: boolean;
  /**
   * M5b (default **false**): de-density (Axis-2 B, RFC §9.3). On the swimlane path the
   * dense-rank axis piles independent same-floor clusters into one column; de-density
   * promotes a SAFE subset one column right to make Y-room for the straightener.
   * Column-preserving, single-column, forward-only ⇒ CON-12-safe by construction.
   * **Internal / measurement-only** (not wired to the UI). `deDensifyMaxCols` is the
   * width dial; 0 (default) disables the pass even when `deDensify` is true.
   */
  deDensify?: boolean;
  deDensifyMaxCols?: number;
  /**
   * Subnet de-band (PROBE, default **false**): on the swimlane path each subnet is a
   * Y-lane stacked into its own disjoint band, so VPC height ≈ Σ(subnet bands). This
   * collapses the subnet level — lifting every subnet's clusters to be direct VPC
   * children — so all of a VPC's resources share ONE column stack (height → the merged
   * max-column-occupancy). X (`colByCluster`) is untouched ⇒ CON-12-safe. Throwaway
   * Phase-0 measurement wiring; suppresses the subnet frame (no annotation visual yet).
   */
  subnetDeBand?: boolean;
};

/** A stage's output: the updated tree plus stage-scoped meta (§28). */
export type StageResult = {
  tree: CompoundNode;
  meta?: Record<string, unknown>;
};

/**
 * The module contract (§22.1 / §28): a deterministic transform that may optimize
 * only its own tier and must never violate a higher one. M0 registers none.
 */
export type Stage = (
  tree: CompoundNode,
  lattice: Lattice,
  opts: RcllOptions,
) => StageResult;
