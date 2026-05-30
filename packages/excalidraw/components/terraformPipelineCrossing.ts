/**
 * Within-column lane ordering to minimize edge crossings between adjacent
 * pipeline columns (Sugiyama crossing-reduction pass; layers fixed by TFD).
 */

import { isTfdHopAddress } from "./terraformDeclaredDataFlow";

import type { PipelineAtomEdge } from "./terraformPipelineAtoms";

export type MinimizePipelineCrossingsOptions = {
  maxIterations?: number;
  /** Use median of neighbor lanes (Graphviz dot); otherwise barycenter. */
  useMedian?: boolean;
  enableSifting?: boolean;
  maxSiftingPasses?: number;
};

const DEFAULT_OPTIONS: Required<MinimizePipelineCrossingsOptions> = {
  maxIterations: 12,
  useMedian: false,
  enableSifting: true,
  maxSiftingPasses: 10,
};

/** Sifting tries every lane index; skip on very wide layers. */
const MAX_SIFTING_COLUMN_WIDTH = 12;

type ColumnLayout = {
  columns: string[][];
  laneByAtom: Map<string, number>;
  colByAtom: Map<string, number>;
};

function buildLayout(columnAtomLists: string[][]): ColumnLayout {
  const columns = columnAtomLists.map((col) => [...col]);
  const laneByAtom = new Map<string, number>();
  const colByAtom = new Map<string, number>();
  for (let c = 0; c < columns.length; c++) {
    const col = columns[c]!;
    for (let lane = 0; lane < col.length; lane++) {
      laneByAtom.set(col[lane]!, lane);
      colByAtom.set(col[lane]!, c);
    }
  }
  return { columns, laneByAtom, colByAtom };
}

function neighborLanes(
  atom: string,
  edges: readonly PipelineAtomEdge[],
  neighborCol: number,
  layout: ColumnLayout,
  direction: "in" | "out",
): number[] {
  const lanes: number[] = [];
  for (const e of edges) {
    if (direction === "in" && e.target === atom) {
      const col = layout.colByAtom.get(e.source);
      if (col === neighborCol) {
        const lane = layout.laneByAtom.get(e.source);
        if (lane !== undefined) {
          lanes.push(lane);
        }
      }
    }
    if (direction === "out" && e.source === atom) {
      const col = layout.colByAtom.get(e.target);
      if (col === neighborCol) {
        const lane = layout.laneByAtom.get(e.target);
        if (lane !== undefined) {
          lanes.push(lane);
        }
      }
    }
  }
  return lanes;
}

function aggregateLane(positions: readonly number[], useMedian: boolean): number {
  if (positions.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }
  const sorted = [...positions].sort((a, b) => a - b);
  if (!useMedian) {
    return sorted.reduce((s, p) => s + p, 0) / sorted.length;
  }
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  const left = sorted[mid - 1]!;
  const right = sorted[mid]!;
  return (left + right) / 2;
}

function isHopAtom(atom: string): boolean {
  return isTfdHopAddress(atom);
}

function sortKeyForAtom(
  atom: string,
  edges: readonly PipelineAtomEdge[],
  layout: ColumnLayout,
  colIdx: number,
  useMedian: boolean,
  sweepDown: boolean,
): number {
  if (isHopAtom(atom)) {
    return Number.MAX_SAFE_INTEGER - 0.5;
  }
  if (sweepDown && colIdx > 0) {
    const lanes = neighborLanes(atom, edges, colIdx - 1, layout, "in");
    return aggregateLane(lanes, useMedian);
  }
  if (!sweepDown && colIdx < layout.columns.length - 1) {
    const lanes = neighborLanes(atom, edges, colIdx + 1, layout, "out");
    return aggregateLane(lanes, useMedian);
  }
  return Number.MAX_SAFE_INTEGER;
}

function reorderColumn(
  colIdx: number,
  layout: ColumnLayout,
  edges: readonly PipelineAtomEdge[],
  useMedian: boolean,
  sweepDown: boolean,
): void {
  const col = layout.columns[colIdx]!;
  if (col.length <= 1) {
    return;
  }
  col.sort((a, b) => {
    const ka = sortKeyForAtom(a, edges, layout, colIdx, useMedian, sweepDown);
    const kb = sortKeyForAtom(b, edges, layout, colIdx, useMedian, sweepDown);
    return ka - kb || a.localeCompare(b);
  });
  for (let lane = 0; lane < col.length; lane++) {
    layout.laneByAtom.set(col[lane]!, lane);
  }
}

/** Edges with endpoints in exactly these two column indices. */
function edgesBetweenColumns(
  colA: number,
  colB: number,
  edges: readonly PipelineAtomEdge[],
  layout: ColumnLayout,
): Array<{ srcLane: number; tgtLane: number }> {
  const out: Array<{ srcLane: number; tgtLane: number }> = [];
  for (const e of edges) {
    const sc = layout.colByAtom.get(e.source);
    const tc = layout.colByAtom.get(e.target);
    if (sc === colA && tc === colB) {
      const srcLane = layout.laneByAtom.get(e.source);
      const tgtLane = layout.laneByAtom.get(e.target);
      if (srcLane !== undefined && tgtLane !== undefined) {
        out.push({ srcLane, tgtLane });
      }
    }
  }
  return out;
}

/** Count crossings for one bipartite layer pair (fixed source/target lane orders). */
export function countBipartiteCrossings(
  layerEdges: readonly { srcLane: number; tgtLane: number }[],
): number {
  if (layerEdges.length < 2) {
    return 0;
  }
  const sorted = [...layerEdges].sort(
    (a, b) => a.srcLane - b.srcLane || a.tgtLane - b.tgtLane,
  );
  let crossings = 0;
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!;
      const b = sorted[j]!;
      if (a.srcLane < b.srcLane && a.tgtLane > b.tgtLane) {
        crossings += 1;
      }
    }
  }
  return crossings;
}

/** Crossings between two adjacent pipeline columns only. */
export function countAdjacentColumnCrossings(
  columnAtomLists: readonly string[][],
  edges: readonly PipelineAtomEdge[],
  colA: number,
  colB: number,
): number {
  const layout = buildLayout([...columnAtomLists.map((c) => [...c])]);
  return countBipartiteCrossings(
    edgesBetweenColumns(colA, colB, edges, layout),
  );
}

/** Sum crossings over all consecutive column pairs. */
export function countTotalAdjacentCrossings(
  columnAtomLists: readonly string[][],
  edges: readonly PipelineAtomEdge[],
): number {
  const layout = buildLayout([...columnAtomLists.map((c) => [...c])]);
  let total = 0;
  for (let c = 0; c < layout.columns.length - 1; c++) {
    total += countBipartiteCrossings(
      edgesBetweenColumns(c, c + 1, edges, layout),
    );
  }
  return total;
}

function crossingsBetweenPair(
  layout: ColumnLayout,
  edges: readonly PipelineAtomEdge[],
  colA: number,
  colB: number,
): number {
  return countBipartiteCrossings(
    edgesBetweenColumns(colA, colB, edges, layout),
  );
}

function countCrossingsForAdjacentSwap(
  layout: ColumnLayout,
  edges: readonly PipelineAtomEdge[],
  colIdx: number,
  laneA: number,
  laneB: number,
): { before: number; after: number } {
  let before = 0;
  let after = 0;
  const col = layout.columns[colIdx]!;
  const atomA = col[laneA]!;
  const atomB = col[laneB]!;

  const swapLanes = (laneMap: Map<string, number>) => {
    laneMap.set(atomA, laneB);
    laneMap.set(atomB, laneA);
  };

  if (colIdx > 0) {
    before += crossingsBetweenPair(layout, edges, colIdx - 1, colIdx);
  }
  if (colIdx < layout.columns.length - 1) {
    before += crossingsBetweenPair(layout, edges, colIdx, colIdx + 1);
  }

  swapLanes(layout.laneByAtom);
  if (colIdx > 0) {
    after += crossingsBetweenPair(layout, edges, colIdx - 1, colIdx);
  }
  if (colIdx < layout.columns.length - 1) {
    after += crossingsBetweenPair(layout, edges, colIdx, colIdx + 1);
  }
  swapLanes(layout.laneByAtom);

  return { before, after };
}

/** Graphviz-style transpose: one adjacent swap pass per column if crossings decrease. */
function transposeColumns(
  layout: ColumnLayout,
  edges: readonly PipelineAtomEdge[],
): boolean {
  let changed = false;
  for (let c = 0; c < layout.columns.length; c++) {
    const col = layout.columns[c]!;
    for (let i = 0; i < col.length - 1; i++) {
      const { before, after } = countCrossingsForAdjacentSwap(
        layout,
        edges,
        c,
        i,
        i + 1,
      );
      if (after < before) {
        const tmp = col[i]!;
        col[i] = col[i + 1]!;
        col[i + 1] = tmp;
        layout.laneByAtom.set(col[i]!, i);
        layout.laneByAtom.set(col[i + 1]!, i + 1);
        changed = true;
      }
    }
  }
  return changed;
}

function layerSweepPass(
  layout: ColumnLayout,
  edges: readonly PipelineAtomEdge[],
  useMedian: boolean,
  downward: boolean,
): boolean {
  let changed = false;
  const cols = downward
    ? [...layout.columns.keys()]
    : [...layout.columns.keys()].reverse();
  for (const c of cols) {
    const prev = layout.columns[c]!.join("\0");
    reorderColumn(c, layout, edges, useMedian, downward);
    if (layout.columns[c]!.join("\0") !== prev) {
      changed = true;
    }
  }
  return changed;
}

function atomDegree(atom: string, edges: readonly PipelineAtomEdge[]): number {
  let d = 0;
  for (const e of edges) {
    if (e.source === atom || e.target === atom) {
      d += 1;
    }
  }
  return d;
}

function tryAtomAtLane(
  layout: ColumnLayout,
  colIdx: number,
  atom: string,
  targetLane: number,
): void {
  const col = layout.columns[colIdx]!;
  const from = layout.laneByAtom.get(atom)!;
  if (from === targetLane) {
    return;
  }
  col.splice(from, 1);
  col.splice(targetLane, 0, atom);
  for (let lane = 0; lane < col.length; lane++) {
    layout.laneByAtom.set(col[lane]!, lane);
  }
}

function siftingPass(
  layout: ColumnLayout,
  edges: readonly PipelineAtomEdge[],
): boolean {
  const atoms = [...layout.laneByAtom.keys()].filter((a) => !isHopAtom(a));
  atoms.sort(
    (a, b) => atomDegree(b, edges) - atomDegree(a, edges) || a.localeCompare(b),
  );

  let changed = false;
  for (const atom of atoms) {
    const colIdx = layout.colByAtom.get(atom);
    if (colIdx === undefined) {
      continue;
    }
    const col = layout.columns[colIdx]!;
    if (col.length <= 1 || col.length > MAX_SIFTING_COLUMN_WIDTH) {
      continue;
    }
    const startLane = layout.laneByAtom.get(atom)!;
    let bestLane = startLane;
    let bestCrossings = countTotalAdjacentCrossingsForLayout(layout, edges);

    for (let lane = 0; lane < col.length; lane++) {
      if (lane === startLane) {
        continue;
      }
      tryAtomAtLane(layout, colIdx, atom, lane);
      const crossings = countTotalAdjacentCrossingsForLayout(layout, edges);
      if (crossings < bestCrossings) {
        bestCrossings = crossings;
        bestLane = lane;
      }
      tryAtomAtLane(layout, colIdx, atom, startLane);
    }

    if (bestLane !== startLane) {
      tryAtomAtLane(layout, colIdx, atom, bestLane);
      changed = true;
    }
  }
  return changed;
}

function countTotalAdjacentCrossingsForLayout(
  layout: ColumnLayout,
  edges: readonly PipelineAtomEdge[],
): number {
  let total = 0;
  for (let c = 0; c < layout.columns.length - 1; c++) {
    total += crossingsBetweenPair(layout, edges, c, c + 1);
  }
  return total;
}

/**
 * Reorder atoms within each TFD column to reduce crossings between adjacent columns.
 * Column indices are unchanged; only lane order changes.
 */
export function minimizePipelineCrossings(
  columnAtomLists: string[][],
  edges: readonly PipelineAtomEdge[],
  options?: MinimizePipelineCrossingsOptions,
): string[][] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (columnAtomLists.length === 0) {
    return columnAtomLists;
  }

  const layout = buildLayout(columnAtomLists.map((c) => [...c]));
  let bestColumns = layout.columns.map((c) => [...c]);
  let bestCrossings = countTotalAdjacentCrossingsForLayout(layout, edges);

  const saveIfBetter = () => {
    const crossings = countTotalAdjacentCrossingsForLayout(layout, edges);
    if (crossings < bestCrossings) {
      bestCrossings = crossings;
      bestColumns = layout.columns.map((c) => [...c]);
    }
    return crossings;
  };

  for (let iter = 0; iter < opts.maxIterations; iter++) {
    const down = layerSweepPass(layout, edges, opts.useMedian, true);
    saveIfBetter();
    transposeColumns(layout, edges);
    saveIfBetter();
    const up = layerSweepPass(layout, edges, opts.useMedian, false);
    saveIfBetter();
    transposeColumns(layout, edges);
    const crossings = saveIfBetter();
    if (!down && !up && crossings === bestCrossings) {
      break;
    }
  }

  layout.columns = bestColumns.map((c) => [...c]);
  layout.laneByAtom.clear();
  layout.colByAtom.clear();
  for (let c = 0; c < layout.columns.length; c++) {
    for (let lane = 0; lane < layout.columns[c]!.length; lane++) {
      const atom = layout.columns[c]![lane]!;
      layout.laneByAtom.set(atom, lane);
      layout.colByAtom.set(atom, c);
    }
  }

  if (opts.enableSifting) {
    for (let pass = 0; pass < opts.maxSiftingPasses; pass++) {
      if (!siftingPass(layout, edges)) {
        break;
      }
      const crossings = countTotalAdjacentCrossingsForLayout(layout, edges);
      if (crossings < bestCrossings) {
        bestCrossings = crossings;
        bestColumns = layout.columns.map((col) => [...col]);
      }
    }
  }

  return bestColumns;
}

/** @deprecated Use {@link minimizePipelineCrossings}. */
export function barycenterSortFanoutColumnsViaCrossing(
  columnAtomLists: string[][],
  edges: readonly PipelineAtomEdge[],
): string[][] {
  return minimizePipelineCrossings(columnAtomLists, edges, {
    useMedian: false,
    enableSifting: false,
    maxIterations: 1,
  });
}
