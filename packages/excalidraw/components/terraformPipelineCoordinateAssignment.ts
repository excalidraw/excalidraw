/**
 * RCLL (Recursive Compound Layered Layout) — Coordinate-assignment metrics (RFC §9).
 *
 * Shared, pure, deterministic readability primitives: the centering `median` (DRY
 * with the rendered diagnostic) and a **model-level** hub-centering metric over the
 * placed leaf boxes (mode-independent — it reads boxes, not frame customData, so it
 * never goes blind the way the rendered metric does in Full mode).
 *
 * NOTE (2026-06-18 pivot): the median-centering *engine* (des(v) + down-only
 * separation) was measured to trade crossings + near-straightness for hub-centering
 * on v2 and was **parked**. The readability goal is reframed to **straightness**
 * (Brandes–Köpf alignment, RFC §9.3); this module keeps the metric + shared median
 * that the straightness work also builds on. See the campaign plan / RFC §9.
 */

/**
 * Median with even-length midpoint averaging (RFC §9.5 centering median) — the
 * SAME definition the rendered `hubCenteringRate` diagnostic uses, so a model win
 * and a rendered win agree on even fan-out.
 *
 * Returns 0 on an empty set; callers that must distinguish "no neighbours" guard
 * the empty case BEFORE calling — the 0 here is a numeric convenience, not a
 * coordinate.
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Model-level hub-centering rate over placed boxes (RFC §13 gate, computed on the
 * geometry the placement engine produced — deterministic and mode-independent,
 * immune to the model≠rendered skew the rendered diagnostic suffers when RCLL's
 * emitted frames don't resolve by address in Full mode).
 *
 * Mirrors the rendered `evaluate`: a node is a **hub** if it fans out OR converges
 * to ≥2 neighbours that resolve to a placed centre AND the node itself resolves; it
 * is **centered** when its centre-Y is within `epsilon` of the median of those
 * neighbours' centre-Ys. A node that is both a fan-out source and a fan-in target is
 * counted once per direction (same as the rendered gate).
 *
 * @param centerYById leaf cluster id → placed box centre-Y (leaves only — hubs and
 *   their neighbours are leaf clusters; container/hull boxes are not addressable
 *   endpoints).
 * @param fanout lattice out-adjacency (cluster id → ordered neighbour cluster ids).
 * @param fanin  lattice in-adjacency (cluster id → ordered neighbour cluster ids).
 * @param epsilon centering tolerance (PIPELINE_CLUSTER_GAP_Y, == the rendered gate).
 */
export function hubCenteringOverBoxes(
  centerYById: ReadonlyMap<string, number>,
  fanout: ReadonlyMap<string, readonly string[]>,
  fanin: ReadonlyMap<string, readonly string[]>,
  epsilon: number,
): { hubCount: number; hubCentered: number; rate: number } {
  let hubCount = 0;
  let hubCentered = 0;

  const evaluate = (nodeId: string, neighbours: readonly string[]): void => {
    const neighbourYs: number[] = [];
    for (const n of neighbours) {
      if (n === nodeId) {
        continue; // self-loop is not a fan-out neighbour
      }
      const y = centerYById.get(n);
      if (y != null) {
        neighbourYs.push(y);
      }
    }
    if (neighbourYs.length < 2) {
      return;
    }
    const nodeY = centerYById.get(nodeId);
    if (nodeY == null) {
      return;
    }
    hubCount += 1;
    if (Math.abs(nodeY - median(neighbourYs)) <= epsilon) {
      hubCentered += 1;
    }
  };

  for (const [source, targets] of fanout) {
    evaluate(source, targets);
  }
  for (const [target, sources] of fanin) {
    evaluate(target, sources);
  }

  const rate =
    hubCount > 0 ? Math.round((hubCentered / hubCount) * 100) / 100 : 0;
  return { hubCount, hubCentered, rate };
}
