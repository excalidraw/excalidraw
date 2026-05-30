/**
 * Per-column vertical packing: align atoms to graph neighbors and pack without overlap.
 */

import { isTfdHopAddress } from "./terraformDeclaredDataFlow";
import { minimizePipelineCrossings } from "./terraformPipelineCrossing";

import type {
  PipelineAtomPlacement,
  PipelineColumn,
} from "./terraformPipelineContainers";
import type { PipelineAtomEdge } from "./terraformPipelineAtoms";
import type { MinimizePipelineCrossingsOptions } from "./terraformPipelineCrossing";

const PACK_GAP = 24;
const TRACK_GAP = 32;
const NOMINAL_SLOT = 96;
const MEDIAN_SWEEPS = 6;
const FORWARD_PIN_PASSES = 2;

const TRACK_ORDER = [
  "trunk",
  ...Array.from({ length: 11 }, (_, i) => `api${i + 1}`),
  "other",
];

export function trackSortIndex(trackId: string): number {
  const i = TRACK_ORDER.indexOf(trackId);
  return i >= 0 ? i : TRACK_ORDER.length;
}

/** Infer API trunk track from stack-qualified address. */
export function trackIdFromAddress(primaryAddress: string): string | null {
  const stackApi = primaryAddress.match(
    /(?:^|::)\d+-(?:east|west)-api-(\d+)/,
  );
  if (stackApi) {
    return `api${stackApi[1]}`;
  }
  const moduleApi = primaryAddress.match(/api(\d+)_/i);
  if (moduleApi) {
    return `api${moduleApi[1]}`;
  }
  if (
    /ecs-edge|ecs_alb|ecs_listener|ecs_target|ecs_producer|messaging|event_queue|consumer_lambda|queue_consumer/i.test(
      primaryAddress,
    )
  ) {
    return "trunk";
  }
  return null;
}

/** Walk primary-parent chain to the owning API gateway / trunk track. */
export function derivePipelineTrackId(
  primaryAddress: string,
  primaryParent: ReadonlyMap<string, string>,
): string {
  if (isTfdHopAddress(primaryAddress)) {
    return "hop";
  }
  const direct = trackIdFromAddress(primaryAddress);
  if (direct) {
    return direct;
  }
  let current = primaryAddress;
  const seen = new Set<string>();
  while (primaryParent.has(current) && !seen.has(current)) {
    seen.add(current);
    current = primaryParent.get(current)!;
    const t = trackIdFromAddress(current);
    if (t) {
      return t;
    }
  }
  return "other";
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return Number.NaN;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function incomingNeighborYs(
  atom: string,
  neighborCol: number,
  edges: readonly PipelineAtomEdge[],
  centerY: ReadonlyMap<string, number>,
  colByAtom: ReadonlyMap<string, number>,
): number[] {
  const ys: number[] = [];
  for (const e of edges) {
    if (e.target !== atom) {
      continue;
    }
    if (colByAtom.get(e.source) !== neighborCol) {
      continue;
    }
    const y = centerY.get(e.source);
    if (y !== undefined) {
      ys.push(y);
    }
  }
  return ys;
}

function packTrackBand(
  atoms: readonly string[],
  desiredY: ReadonlyMap<string, number>,
  slotHeight: ReadonlyMap<string, number>,
  startY: number,
): { centers: Map<string, number>; bandBottom: number } {
  const sorted = [...atoms].sort(
    (a, b) =>
      (desiredY.get(a) ?? 0) - (desiredY.get(b) ?? 0) || a.localeCompare(b),
  );
  const centers = new Map<string, number>();
  let bottom = startY;
  for (const atom of sorted) {
    const h = slotHeight.get(atom) ?? NOMINAL_SLOT;
    const wantTop = (desiredY.get(atom) ?? bottom) - h / 2;
    const top = Math.max(bottom, wantTop);
    centers.set(atom, top + h / 2);
    bottom = top + h + PACK_GAP;
  }
  return { centers, bandBottom: bottom };
}

/** Pin targets to median Y of sources on forward edges (col+1). */
export function pinDesiredYFromForwardEdges(
  edges: readonly PipelineAtomEdge[],
  colByAtom: ReadonlyMap<string, number>,
  centerY: ReadonlyMap<string, number>,
  desiredY: Map<string, number>,
): void {
  const sourcesByTarget = new Map<string, number[]>();
  for (const e of edges) {
    const sc = colByAtom.get(e.source);
    const tc = colByAtom.get(e.target);
    if (sc === undefined || tc === undefined || tc !== sc + 1) {
      continue;
    }
    const sy = centerY.get(e.source);
    if (sy === undefined) {
      continue;
    }
    const list = sourcesByTarget.get(e.target) ?? [];
    list.push(sy);
    sourcesByTarget.set(e.target, list);
  }
  for (const [target, ys] of sourcesByTarget) {
    const m = median(ys);
    if (!Number.isNaN(m)) {
      desiredY.set(target, m);
    }
  }
}

function repackAllColumns(
  columns: readonly PipelineColumn[],
  visible: readonly PipelineAtomPlacement[],
  desiredY: ReadonlyMap<string, number>,
  centerY: Map<string, number>,
  slotHeight: ReadonlyMap<string, number>,
  packGap: number,
  trackGap: number,
): void {
  for (const col of columns) {
    const atoms = col.atoms.filter(
      (a) => !isTfdHopAddress(a) && slotHeight.has(a),
    );
    const byTrack = new Map<string, string[]>();
    for (const atom of atoms) {
      const p = visible.find((pl) => pl.primaryAddress === atom);
      const track = p?.trackId ?? "other";
      const list = byTrack.get(track) ?? [];
      list.push(atom);
      byTrack.set(track, list);
    }
    const tracks = [...byTrack.keys()].sort(
      (a, b) => trackSortIndex(a) - trackSortIndex(b),
    );
    let y = 0;
    for (const track of tracks) {
      const { centers, bandBottom } = packTrackBand(
        byTrack.get(track) ?? [],
        desiredY,
        slotHeight,
        y,
      );
      for (const [atom, cy] of centers) {
        centerY.set(atom, cy);
      }
      y = bandBottom + trackGap;
    }
  }
}

/** Max |ΔY| on edges where target column is source column + 1. */
export function maxForwardAdjacentColumnDeltaY(
  placements: readonly PipelineAtomPlacement[],
  edges: readonly PipelineAtomEdge[],
  colByAtom: ReadonlyMap<string, number>,
): number {
  const yByAtom = new Map(
    placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]),
  );
  let max = 0;
  for (const e of edges) {
    const sc = colByAtom.get(e.source);
    const tc = colByAtom.get(e.target);
    if (sc === undefined || tc === undefined || tc !== sc + 1) {
      continue;
    }
    const sy = yByAtom.get(e.source);
    const ty = yByAtom.get(e.target);
    if (sy === undefined || ty === undefined) {
      continue;
    }
    max = Math.max(max, Math.abs(sy - ty));
  }
  return max;
}

export type AssignPipelineColumnPackedYOptions = {
  packGap?: number;
  trackGap?: number;
  medianSweeps?: number;
};

/**
 * Assign packedOffsetY (column-local center Y) and refine laneIndex from track order.
 * Mutates placements in place.
 */
export function assignPipelineColumnPackedY(
  placements: PipelineAtomPlacement[],
  columns: readonly PipelineColumn[],
  edges: readonly PipelineAtomEdge[],
  slotHeight: ReadonlyMap<string, number>,
  colByAtom: ReadonlyMap<string, number>,
  options?: AssignPipelineColumnPackedYOptions,
): void {
  const packGap = options?.packGap ?? PACK_GAP;
  const trackGap = options?.trackGap ?? TRACK_GAP;
  const sweeps = options?.medianSweeps ?? MEDIAN_SWEEPS;

  const visible = placements.filter(
    (p) => slotHeight.has(p.primaryAddress) && !isTfdHopAddress(p.primaryAddress),
  );
  if (visible.length === 0) {
    return;
  }

  const centerY = new Map<string, number>();
  const desiredY = new Map<string, number>();

  for (const col of columns) {
    const atoms = col.atoms.filter(
      (a) => !isTfdHopAddress(a) && slotHeight.has(a),
    );
    const byTrack = new Map<string, string[]>();
    for (const atom of atoms) {
      const p = visible.find((pl) => pl.primaryAddress === atom);
      const track = p?.trackId ?? "other";
      const list = byTrack.get(track) ?? [];
      list.push(atom);
      byTrack.set(track, list);
    }
    const tracks = [...byTrack.keys()].sort(
      (a, b) => trackSortIndex(a) - trackSortIndex(b),
    );
    let y = 0;
    for (const track of tracks) {
      const bandAtoms = byTrack.get(track) ?? [];
      for (let i = 0; i < bandAtoms.length; i++) {
        const atom = bandAtoms[i]!;
        const h = slotHeight.get(atom) ?? NOMINAL_SLOT;
        const cy = y + h / 2;
        centerY.set(atom, cy);
        desiredY.set(atom, cy);
        y += h + packGap;
      }
      y += trackGap;
    }
  }

  const maxCol = Math.max(...visible.map((p) => p.columnIndex), 0);

  for (let pass = 0; pass < sweeps; pass++) {
    for (let c = 1; c <= maxCol; c++) {
      for (const p of visible) {
        if (p.columnIndex !== c) {
          continue;
        }
        const atom = p.primaryAddress;
        const m = median(
          incomingNeighborYs(atom, c - 1, edges, centerY, colByAtom),
        );
        if (!Number.isNaN(m)) {
          desiredY.set(atom, m);
        }
      }
    }
    repackAllColumns(
      columns,
      visible,
      desiredY,
      centerY,
      slotHeight,
      packGap,
      trackGap,
    );
  }

  for (let pinPass = 0; pinPass < FORWARD_PIN_PASSES; pinPass++) {
    pinDesiredYFromForwardEdges(edges, colByAtom, centerY, desiredY);
    repackAllColumns(
      columns,
      visible,
      desiredY,
      centerY,
      slotHeight,
      packGap,
      trackGap,
    );
  }

  const alignTrackAcrossColumns = (trackId: string): void => {
    const atoms = visible.filter((p) => (p.trackId ?? "other") === trackId);
    if (atoms.length <= 1) {
      return;
    }
    const ys = atoms
      .map((p) => centerY.get(p.primaryAddress))
      .filter((y): y is number => y !== undefined);
    const target = median(ys);
    if (Number.isNaN(target)) {
      return;
    }
    for (const p of atoms) {
      desiredY.set(p.primaryAddress, target);
    }
    repackAllColumns(
      columns,
      visible,
      desiredY,
      centerY,
      slotHeight,
      packGap,
      trackGap,
    );
  };

  alignTrackAcrossColumns("trunk");

  const trackSlot = new Map<string, number>();
  for (const track of TRACK_ORDER) {
    trackSlot.set(track, trackSortIndex(track));
  }

  for (const p of placements) {
    const cy = centerY.get(p.primaryAddress);
    if (cy !== undefined) {
      p.packedOffsetY = cy;
    }
    const tid = p.trackId ?? "other";
    p.laneIndex = trackSlot.get(tid) ?? trackSortIndex(tid);
  }
}

/** Build column index map and slot heights from cluster build sizes. */
export function buildColumnPackInputs(
  layoutPlan: {
    placements: readonly PipelineAtomPlacement[];
    columns: readonly PipelineColumn[];
  },
  slotHeight: ReadonlyMap<string, number>,
): { colByAtom: Map<string, number> } {
  const colByAtom = new Map<string, number>();
  for (const p of layoutPlan.placements) {
    colByAtom.set(p.primaryAddress, p.columnIndex);
  }
  for (const col of layoutPlan.columns) {
    for (const atom of col.atoms) {
      colByAtom.set(atom, col.columnIndex);
    }
  }
  void slotHeight;
  return { colByAtom };
}

export function derivePlacementTrackIds(
  placements: PipelineAtomPlacement[],
  primaryParent: ReadonlyMap<string, string>,
): void {
  for (const p of placements) {
    p.trackId = derivePipelineTrackId(p.primaryAddress, primaryParent);
  }
}

/** Reorder each column by minimizing crossings within each API track slice. */
export function minimizePipelineCrossingsByTrack(
  columnAtomLists: string[][],
  edges: readonly PipelineAtomEdge[],
  primaryParent: ReadonlyMap<string, string>,
  options?: MinimizePipelineCrossingsOptions,
): string[][] {
  const trackIds = new Set<string>();
  for (const col of columnAtomLists) {
    for (const atom of col) {
      if (!isTfdHopAddress(atom)) {
        trackIds.add(derivePipelineTrackId(atom, primaryParent));
      }
    }
  }
  const tracks = [...trackIds].sort(
    (a, b) => trackSortIndex(a) - trackSortIndex(b),
  );
  const columns = columnAtomLists.map((col) => [...col]);

  for (const trackId of tracks) {
    const subLists = columns.map((col) =>
      col.filter(
        (a) =>
          !isTfdHopAddress(a) &&
          derivePipelineTrackId(a, primaryParent) === trackId,
      ),
    );
    if (subLists.every((slice) => slice.length <= 1)) {
      continue;
    }
    const minimized = minimizePipelineCrossings(subLists, edges, options);
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c]!;
      const byTrack = new Map<string, string[]>();
      const hops: string[] = [];
      for (const atom of col) {
        if (isTfdHopAddress(atom)) {
          hops.push(atom);
          continue;
        }
        const tid = derivePipelineTrackId(atom, primaryParent);
        const list = byTrack.get(tid) ?? [];
        list.push(atom);
        byTrack.set(tid, list);
      }
      byTrack.set(trackId, minimized[c] ?? []);
      columns[c] = [...tracks.flatMap((t) => byTrack.get(t) ?? []), ...hops];
    }
  }
  return columns;
}
