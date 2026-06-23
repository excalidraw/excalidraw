/**
 * RCLL (Recursive Compound Layered Layout) — Container-aware crossing minimization
 * (Milestone M6c, RFC §7.2c / §9.5 / DEC-6). Default-OFF, deterministic.
 *
 * **Why this exists.** `rankSeparate` (DI-DEB-6) and the de-band ladder create real
 * X-room — one-way sibling hulls land in disjoint global columns and the M4 lane-rise
 * shares their Y rows (v2 Compact −42 % height) — but at a recorded cost: rendered
 * crossings rose ~+45 % (250 → 362), explicitly deferred to *"cross-container
 * crossing-min, a separate milestone"*. Today's M6 (`reorder`) permutes ONLY leaves
 * within a single column, per-container, so it cannot touch crossings BETWEEN
 * containers (DI-M6-3: a measured no-op). This pass reorders **whole lanes / sub-hulls
 * within their parent AND leaves within columns**.
 *
 * **The model (Sander / Forster heuristic, RENDERED-coordinate gate).** The reorder
 * unit is the compound tree's *sibling order*: at each container its children have a
 * sibling order; we only ever permute sibling slots, so two containers' members never
 * interleave in a column ⇒ contiguity holds by construction. X (`colByCluster` /
 * `localColumn` / the staircase column) is NEVER a function of order in this engine,
 * so reordering moves only Y — CON-12 (the iron rule) is untouched.
 *
 * The candidate order is *proposed* by a hierarchical **barycenter** (a child sorts to
 * the average placed-Y of everything its descendant leaves connect to — Sugiyama's
 * classic heuristic), but a proposal is only *accepted* after re-placement if the
 * **rendered crossing count strictly drops** and the structural gates do not regress.
 * The scorer reads placed `box.x/box.y` (center-to-center segments over the collapsed
 * cluster edges) through the SAME `segmentsCross` kernel `diagnosePipelineScene` uses —
 * not a floor-coordinate proxy — so the model the search optimizes IS (modulo arrow
 * routing) the count the rendered diagnostic reports. This is the codex-driven pivot:
 * a floor-coordinate ordinal pre-pass can lower its own count while raising the rendered
 * one; a rendered-coordinate measure-driven loop cannot.
 *
 * **The loop (measure-driven hill-climb, the M5c `columnCompact` precedent).** Place a
 * baseline (empty override) → score. Then iterate: from the current best placement
 * propose a global barycenter order → re-place a clone with that order → score; accept
 * iff strictly fewer crossings AND containment/overlap do not regress; stop at the first
 * non-improving sweep. Bounded sweeps + an eval budget (CON-8). Nothing accepted ⇒ the
 * empty override ⇒ OFF byte-identical.
 *
 * Pure + deterministic: no RNG, no timings; barycenter ties break on model order
 * `(minDescendantSequence, key)`; the global rank is a stable pre-order walk.
 */
import {
  segmentsCross,
  type Seg,
} from "./terraformPipelineCollisionDiagnostics";
import {
  isTerraformImportProfilerEnabled,
  terraformImportProfilerMeasure,
} from "./terraformImportProfiler";

import type { TerraformDependencyLayoutBox } from "./terraformElkLayout";
import type { CompoundNode } from "./terraformPipelineRcllTypes";

/** A collapsed cluster-level dataflow edge: source cluster id → target cluster id. */
export type CrossingEdge = readonly [string, string];

/** Outcome of the search — surfaced (scalars only) on `rcllStageMeta.placement`. */
export type CrossingMinResult = {
  /** A move was accepted (rendered crossings strictly dropped). */
  applied: boolean;
  /** Rendered crossings of the baseline (empty-override) placement. */
  before: number;
  /** Rendered crossings of the accepted placement (== before when none accepted). */
  after: number;
  /** Number of child nodes whose sibling slot differs from model order in the result. */
  moves: number;
  /** Placed-height delta (accepted − baseline), px. Reported, UNGATED (user decision). */
  heightDeltaPx: number;
  /** Placed-width delta (accepted − baseline), px. Reported, UNGATED. */
  widthDeltaPx: number;
  /** True iff the eval budget was hit before the search converged. */
  evalCapReached: boolean;
};

/** Structural metrics the gate reads (must not regress vs baseline). */
export type PlacementMetrics = {
  containment: number;
  overlap: number;
  width: number;
  height: number;
};

export type MinimizeCrossingsOptions = {
  /** Max improving sweeps (each = one full re-place). Default 8. */
  sweeps?: number;
  /** Hard cap on trial placements (CON-8 budget). Default 16. */
  evalBudget?: number;
};

const DEFAULT_SWEEPS = 8;
const DEFAULT_EVAL_BUDGET = 16;

const centerX = (b: TerraformDependencyLayoutBox): number => b.x + b.width / 2;
const centerY = (b: TerraformDependencyLayoutBox): number => b.y + b.height / 2;

/** Leaf cluster id → placed box, over a fully-placed compound tree. */
export function boxByClusterId(
  tree: CompoundNode,
): Map<string, TerraformDependencyLayoutBox> {
  const out = new Map<string, TerraformDependencyLayoutBox>();
  const walk = (n: CompoundNode): void => {
    if (n.children.length === 0) {
      if (n.cluster && n.box) {
        out.set(n.cluster.id, n.box);
      }
      return;
    }
    for (const c of n.children) {
      walk(c);
    }
  };
  walk(tree);
  return out;
}

/**
 * Rendered crossing count over collapsed cluster edges, from placed box centers — the
 * box-coordinate analogue of `diagnosePipelineScene`'s arrow-pair counter (same
 * `segmentsCross` kernel, edges that share a cluster endpoint do not cross). Each edge
 * is a straight `center(source) → center(target)` segment; a pair counts once.
 */
export function countPlacedCrossings(
  boxes: ReadonlyMap<string, TerraformDependencyLayoutBox>,
  edges: readonly CrossingEdge[],
): number {
  return terraformImportProfilerMeasure("pipeline.rcll.crossingMin.count", () => {
    const segs: Seg[] = [];
    for (const [u, v] of edges) {
      const bu = boxes.get(u);
      const bv = boxes.get(v);
      if (!bu || !bv) {
        continue;
      }
      segs.push({
        x1: centerX(bu),
        y1: centerY(bu),
        x2: centerX(bv),
        y2: centerY(bv),
      });
    }
    let crossings = 0;
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        if (segmentsCross(segs[i]!, segs[j]!)) {
          crossings += 1;
        }
      }
    }
    return crossings;
  });
}

/** Collapsed cluster edges from the lattice fan-out adjacency (self-loops dropped). */
export function collapsedEdgesFromFanout(
  fanout: ReadonlyMap<string, readonly string[]>,
): CrossingEdge[] {
  const edges: CrossingEdge[] = [];
  for (const [u, targets] of fanout) {
    for (const v of targets) {
      if (u !== v) {
        edges.push([u, v]);
      }
    }
  }
  return edges;
}

const byModelOrder = (a: CompoundNode, b: CompoundNode): number =>
  a.minDescendantSequence - b.minDescendantSequence ||
  a.key.localeCompare(b.key);

/** Descendant leaf cluster ids under a node (leaf itself if it is a cluster). */
function descendantLeafIds(node: CompoundNode, out: string[]): void {
  if (node.children.length === 0) {
    if (node.cluster) {
      out.push(node.cluster.id);
    }
    return;
  }
  for (const c of node.children) {
    descendantLeafIds(c, out);
  }
}

/**
 * Propose a **global sibling order** from a placed tree by hierarchical barycenter.
 * Returns a pre-order rank per node key; because the placement comparators compare only
 * siblings, the rank fully determines each container's child order (model order is the
 * stable tiebreak, so a node with no cross-edges keeps its slot). A child's barycenter
 * is the mean, over its descendant leaf clusters, of each leaf's mean neighbour
 * centre-Y (a leaf with no neighbour contributes its own Y — stays put).
 */
export function barycenterOrder(
  tree: CompoundNode,
  edges: readonly CrossingEdge[],
): Map<string, number> {
  const boxes = boxByClusterId(tree);
  const adj = new Map<string, string[]>();
  for (const [u, v] of edges) {
    if (!boxes.has(u) || !boxes.has(v)) {
      continue;
    }
    (adj.get(u) ?? adj.set(u, []).get(u)!).push(v);
    (adj.get(v) ?? adj.set(v, []).get(v)!).push(u);
  }

  const leafBary = (clusterId: string): number => {
    const box = boxes.get(clusterId)!;
    const ns = adj.get(clusterId) ?? [];
    let sum = 0;
    let n = 0;
    for (const nb of ns) {
      const nbBox = boxes.get(nb);
      if (nbBox) {
        sum += centerY(nbBox);
        n += 1;
      }
    }
    return n > 0 ? sum / n : centerY(box);
  };

  const baryCache = new Map<string, number>();
  const nodeBary = (node: CompoundNode): number => {
    const cached = baryCache.get(node.key);
    if (cached != null) {
      return cached;
    }
    const ids: string[] = [];
    descendantLeafIds(node, ids);
    let value: number;
    if (ids.length === 0) {
      value = node.box ? centerY(node.box) : 0;
    } else {
      let sum = 0;
      for (const id of ids) {
        sum += leafBary(id);
      }
      value = sum / ids.length;
    }
    baryCache.set(node.key, value);
    return value;
  };

  const rank = new Map<string, number>();
  let counter = 0;
  const walk = (node: CompoundNode): void => {
    rank.set(node.key, counter++);
    const ordered = [...node.children].sort(
      (a, b) => nodeBary(a) - nodeBary(b) || byModelOrder(a, b),
    );
    for (const c of ordered) {
      walk(c);
    }
  };
  walk(tree);
  return rank;
}

/**
 * Count child nodes whose sibling slot under `override` differs from model order —
 * a scalar "how much did we reorder" surfaced as `crossingMinMoves`.
 */
export function countReordered(
  tree: CompoundNode,
  override: ReadonlyMap<string, number>,
): number {
  if (override.size === 0) {
    return 0;
  }
  let moves = 0;
  const walk = (node: CompoundNode): void => {
    if (node.children.length > 1) {
      const model = [...node.children].sort(byModelOrder);
      const overridden = [...node.children].sort((a, b) => {
        const ra = override.get(a.key);
        const rb = override.get(b.key);
        if (ra != null && rb != null && ra !== rb) {
          return ra - rb;
        }
        return byModelOrder(a, b);
      });
      for (let i = 0; i < model.length; i++) {
        if (model[i]!.key !== overridden[i]!.key) {
          moves += 1;
        }
      }
    }
    for (const c of node.children) {
      walk(c);
    }
  };
  walk(tree);
  return moves;
}

const EMPTY_OVERRIDE: ReadonlyMap<string, number> = new Map();

/**
 * Measure-driven container-aware crossing minimization. `place` re-places the tree for
 * a given sibling-order override (X is order-independent, so this only moves Y); `metrics`
 * reads the structural gate metrics of a placed tree. Returns the best placed tree plus
 * the result meta. When nothing beats the baseline, returns the baseline placement and an
 * empty-override result (`applied: false`) — OFF byte-identical.
 */
export function minimizeCrossings(
  edges: readonly CrossingEdge[],
  place: (override: ReadonlyMap<string, number>) => CompoundNode,
  metrics: (tree: CompoundNode) => PlacementMetrics,
  opts: MinimizeCrossingsOptions = {},
): {
  tree: CompoundNode;
  /** The accepted sibling-order override (empty when nothing beat the baseline). */
  override: ReadonlyMap<string, number>;
  result: CrossingMinResult;
} {
  const sweeps = Math.max(0, Math.floor(opts.sweeps ?? DEFAULT_SWEEPS));
  const evalBudget = Math.max(1, Math.floor(opts.evalBudget ?? DEFAULT_EVAL_BUDGET));

  let best = place(EMPTY_OVERRIDE);
  let bestOverride: ReadonlyMap<string, number> = EMPTY_OVERRIDE;
  let bestCrossings = countPlacedCrossings(boxByClusterId(best), edges);
  const baseCrossings = bestCrossings;
  const baseMetrics = metrics(best);
  let evals = 1;
  let evalCapReached = false;
  let sweepsRun = 0;

  for (let s = 0; s < sweeps; s++) {
    if (evals >= evalBudget) {
      evalCapReached = true;
      break;
    }
    sweepsRun += 1;
    const override = barycenterOrder(best, edges);
    const trial = place(override);
    evals += 1;
    const trialCrossings = countPlacedCrossings(boxByClusterId(trial), edges);
    const trialMetrics = metrics(trial);
    const structurallySafe =
      trialMetrics.containment <= baseMetrics.containment &&
      trialMetrics.overlap <= baseMetrics.overlap;
    if (trialCrossings < bestCrossings && structurallySafe) {
      best = trial;
      bestOverride = override;
      bestCrossings = trialCrossings;
    } else {
      // Hill-climb: first non-improving (or unsafe) sweep ends the search.
      break;
    }
  }

  if (isTerraformImportProfilerEnabled()) {
    // eslint-disable-next-line no-console -- gated instrumentation counter
    console.log("[terraform:rcll-instr] crossingMin", {
      sweepsRun,
      evalsRun: evals,
      sweepBudget: sweeps,
      evalBudget,
    });
  }

  const finalMetrics = metrics(best);
  return {
    tree: best,
    override: bestOverride,
    result: {
      applied: bestCrossings < baseCrossings,
      before: baseCrossings,
      after: bestCrossings,
      moves: countReordered(best, bestOverride),
      heightDeltaPx: finalMetrics.height - baseMetrics.height,
      widthDeltaPx: finalMetrics.width - baseMetrics.width,
      evalCapReached,
    },
  };
}
