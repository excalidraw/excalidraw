/**
 * Pure TFD semantics for pipeline layout: column depth, primary parent, lane barycenter.
 */

import type {
  PipelineAtomEdge,
  PipelineAtomGraph,
} from "./terraformPipelineAtoms";

/** Column advance for one TFD edge (`->` = 1, `-->` = 0, etc.). */
export function tfdEdgeColumnAdvance(columnBackoff = 0): number {
  return Math.max(0, 1 - columnBackoff);
}

/**
 * Primary TFD parent = source of the earliest declared edge into `target` (file order).
 */
export function buildTfdPrimaryParentMap(
  edges: readonly PipelineAtomEdge[],
): Map<string, string> {
  const sorted = [...edges].sort(
    (a, b) => a.sequence - b.sequence || a.source.localeCompare(b.source),
  );
  const parentByTarget = new Map<string, string>();
  for (const e of sorted) {
    if (!parentByTarget.has(e.target)) {
      parentByTarget.set(e.target, e.source);
    }
  }
  return parentByTarget;
}

export type TfdEdgeAdvance = {
  source: string;
  target: string;
  advance: number;
};

/** Precompute per-edge column advance from TFD contiguous runs (independent of source column). */
export function buildTfdEdgeAdvances(
  edges: readonly PipelineAtomEdge[],
): TfdEdgeAdvance[] {
  const sorted = [...edges].sort(
    (a, b) => a.sequence - b.sequence || a.source.localeCompare(b.source),
  );

  const advances: TfdEdgeAdvance[] = [];
  const sequentialRunBySource = new Map<string, number>();

  for (let i = 0; i < sorted.length; ) {
    let j = i + 1;
    while (j < sorted.length && sorted[j]!.source === sorted[i]!.source) {
      j += 1;
    }
    const run = sorted.slice(i, j);
    const source = run[0]!.source;
    const runOrdinal = sequentialRunBySource.get(source) ?? 0;
    sequentialRunBySource.set(source, runOrdinal + 1);
    const parallelRun = run.length > 1 && runOrdinal === 0;
    for (const e of run) {
      const advance = parallelRun
        ? tfdEdgeColumnAdvance(e.columnBackoff)
        : Math.max(0, 1 + runOrdinal - (e.columnBackoff ?? 0));
      advances.push({ source, target: e.target, advance });
    }
    i = j;
  }

  return advances;
}

function relaxPipelineColumnIndexMap(
  colByAtom: Map<string, number>,
  advances: readonly TfdEdgeAdvance[],
  maxIterations: number,
): void {
  for (let pass = 0; pass < maxIterations; pass++) {
    let changed = false;
    for (const { source, target, advance } of advances) {
      const srcCol = colByAtom.get(source);
      if (srcCol === undefined) {
        continue;
      }
      const nextCol = srcCol + advance;
      const prev = colByAtom.get(target) ?? 0;
      if (nextCol > prev) {
        colByAtom.set(target, nextCol);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
}

/** Assign each atom a column index from TFD edge order, fanout runs, and arrow backoff. */
export function buildPipelineColumnIndexMap(
  atomGraph: PipelineAtomGraph,
  edges: readonly PipelineAtomEdge[],
): Map<string, number> {
  const sorted = [...edges].sort(
    (a, b) => a.sequence - b.sequence || a.source.localeCompare(b.source),
  );

  const sources = new Set(sorted.map((e) => e.source));
  const targets = new Set(sorted.map((e) => e.target));
  const roots = [...sources].filter((s) => !targets.has(s)).sort();

  const colByAtom = new Map<string, number>();
  for (const r of roots) {
    colByAtom.set(r, 0);
  }
  if (roots.length === 0 && atomGraph.atoms.size > 0) {
    colByAtom.set([...atomGraph.atoms.keys()].sort()[0]!, 0);
  }

  const advances = buildTfdEdgeAdvances(sorted);
  relaxPipelineColumnIndexMap(
    colByAtom,
    advances,
    advances.length + atomGraph.atoms.size,
  );

  let fallbackCol =
    colByAtom.size > 0 ? Math.max(...colByAtom.values()) + 1 : 0;
  for (const addr of [...atomGraph.atoms.keys()].sort()) {
    if (!colByAtom.has(addr)) {
      colByAtom.set(addr, fallbackCol);
      fallbackCol += 1;
    }
  }

  return colByAtom;
}

/** Group atoms by TFD column index into column lists (unsorted lanes). */
export function buildPipelineColumnsFromTfdDepth(
  atomGraph: PipelineAtomGraph,
  edges: readonly PipelineAtomEdge[],
): string[][] {
  const colByAtom = buildPipelineColumnIndexMap(atomGraph, edges);
  const columnMap = new Map<number, string[]>();
  for (const [atom, col] of colByAtom) {
    const list = columnMap.get(col) ?? [];
    list.push(atom);
    columnMap.set(col, list);
  }

  const maxCol = Math.max(...columnMap.keys(), 0);
  const columns: string[][] = [];
  for (let i = 0; i <= maxCol; i++) {
    const list = columnMap.get(i);
    if (!list?.length) {
      continue;
    }
    list.sort((a, b) => a.localeCompare(b));
    columns.push(list);
  }

  return columns;
}

/** Sort multi-lane columns by average parent lane (barycenter); lanes are not in TFD. */
export function barycenterSortFanoutColumns(
  columnAtomLists: string[][],
  edges: readonly PipelineAtomEdge[],
  primaryParent: ReadonlyMap<string, string>,
): string[][] {
  const laneByAtom = new Map<string, number>();
  const result: string[][] = [];

  for (const columnAtoms of columnAtomLists) {
    const atoms = [...columnAtoms];

    if (atoms.length > 1) {
      const barycenter = (atom: string): number => {
        const parents = [
          ...new Set(
            edges.filter((e) => e.target === atom).map((e) => e.source),
          ),
        ];
        const resolved =
          parents.length > 0
            ? parents
            : primaryParent.has(atom)
            ? [primaryParent.get(atom)!]
            : [];
        let sum = 0;
        let count = 0;
        for (const p of resolved) {
          const lane = laneByAtom.get(p);
          if (lane !== undefined) {
            sum += lane;
            count += 1;
          }
        }
        return count > 0 ? sum / count : Number.MAX_SAFE_INTEGER;
      };

      atoms.sort((a, b) => barycenter(a) - barycenter(b) || a.localeCompare(b));
    }

    atoms.forEach((atom, lane) => laneByAtom.set(atom, lane));
    result.push(atoms);
  }

  return result;
}

/**
 * Lane index follows the TFD primary-parent chain so single-atom columns stay
 * aligned with their fanout parent (barycenter only orders within multi-lane columns).
 */
export function buildTfdLaneIndexMap(
  columnAtomLists: readonly string[][],
  primaryParent: ReadonlyMap<string, string>,
): Map<string, number> {
  const laneByAtom = new Map<string, number>();

  const fanoutColumn = columnAtomLists.reduce(
    (best, col) => (col.length > best.length ? col : best),
    [] as string[],
  );
  if (fanoutColumn.length > 1) {
    fanoutColumn.forEach((atom, lane) => laneByAtom.set(atom, lane));
  }

  for (const col of columnAtomLists) {
    for (const atom of col) {
      if (laneByAtom.has(atom)) {
        continue;
      }
      const parent = primaryParent.get(atom);
      if (parent && laneByAtom.has(parent)) {
        laneByAtom.set(atom, laneByAtom.get(parent)!);
      } else {
        laneByAtom.set(atom, 0);
      }
    }
  }

  return laneByAtom;
}
