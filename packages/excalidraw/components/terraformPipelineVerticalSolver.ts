/** Global vertical positioning for fixed pipeline columns. */

import ELK from "elkjs/lib/elk.bundled.js";

import { isTfdHopAddress } from "./terraformDeclaredDataFlow";
import {
  derivePipelineTrackId,
  trackSortIndex,
} from "./terraformPipelineColumnPack";
import { assignTrackRows } from "./terraformPipelineTrackRows";

import type { PipelineAtomEdge } from "./terraformPipelineAtoms";
import type {
  PipelineAtomPlacement,
  PipelineColumn,
} from "./terraformPipelineContainers";
import type { TerraformPipelineVerticalSolverMode } from "./terraformPipelineLayoutMode";

const DEFAULT_GAP = 24;
const DEFAULT_ANCHOR_WEIGHT = 0.2;
const DEFAULT_EDGE_WEIGHT = 1;
const STRAIGHT_ANCHOR_WEIGHT = 0.02;
const STRAIGHT_EDGE_WEIGHT = 8;
const CONSTRAINED_SWEEPS = 80;
const EXACT_SWEEPS = 240;
const STRAIGHT_SWEEPS = 180;
const ELK_NODE_W = 120;

export type PipelineVerticalSolverWarning = {
  mode: TerraformPipelineVerticalSolverMode;
  message: string;
};

export type PipelineVerticalSolverResult = {
  appliedMode: TerraformPipelineVerticalSolverMode;
  warnings: PipelineVerticalSolverWarning[];
};

export type PipelineVerticalSolverOptions = {
  mode: TerraformPipelineVerticalSolverMode;
  gap?: number;
  anchorWeight?: number;
  edgeWeight?: number;
  primaryParent?: ReadonlyMap<string, string>;
};

type PipelineEdgeClass = "backbone" | "handoff" | "ssm" | "other";

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

function isSsmAddress(address: string): boolean {
  return /aws_ssm_parameter/i.test(address);
}

function isGatewayAddress(address: string): boolean {
  return /aws_api_gateway_rest_api|_gateway$/i.test(address);
}

function isComputeLikeAddress(address: string): boolean {
  return (
    /aws_ecs_service|aws_lambda_function|_compute$/i.test(address) ||
    /::module\.api\.(aws_ecs_service|module\.lambda)/i.test(address)
  );
}

function isDatastoreAddress(address: string): boolean {
  return (
    /aws_db_instance|aws_rds_cluster|aws_dynamodb_table|aws_s3_bucket/i.test(
      address,
    ) ||
    /(?:^|_)store$/i.test(address) ||
    /datastores/i.test(address)
  );
}

function trackForAtom(
  address: string,
  placementByAtom: ReadonlyMap<string, PipelineAtomPlacement>,
  primaryParent: ReadonlyMap<string, string>,
): string {
  const p = placementByAtom.get(address);
  if (p?.trackId) {
    return p.trackId;
  }
  return derivePipelineTrackId(address, primaryParent);
}

function classifyPipelineEdge(
  edge: PipelineAtomEdge,
  placementByAtom: ReadonlyMap<string, PipelineAtomPlacement>,
  primaryParent: ReadonlyMap<string, string>,
): PipelineEdgeClass {
  const { source, target } = edge;
  if (isSsmAddress(target)) {
    return "ssm";
  }
  const sourceTrack = trackForAtom(source, placementByAtom, primaryParent);
  const targetTrack = trackForAtom(target, placementByAtom, primaryParent);
  if (
    sourceTrack === targetTrack &&
    primaryParent.get(target) === source
  ) {
    return "backbone";
  }
  if (
    sourceTrack !== targetTrack &&
    isGatewayAddress(target) &&
    isComputeLikeAddress(source)
  ) {
    return "handoff";
  }
  return "other";
}

type VisibleAtom = {
  atom: string;
  columnIndex: number;
  initialY: number;
  halfHeight: number;
};

function visibleAtoms(
  placements: readonly PipelineAtomPlacement[],
  slotHeight: ReadonlyMap<string, number>,
): VisibleAtom[] {
  return placements
    .filter(
      (p) =>
        !isTfdHopAddress(p.primaryAddress) &&
        slotHeight.has(p.primaryAddress) &&
        Number.isFinite(p.packedOffsetY),
    )
    .map((p) => ({
      atom: p.primaryAddress,
      columnIndex: p.columnIndex,
      initialY: p.packedOffsetY ?? 0,
      halfHeight: (slotHeight.get(p.primaryAddress) ?? 0) / 2,
    }));
}

function finiteOrThrow(values: ReadonlyMap<string, number>): void {
  for (const [atom, y] of values) {
    if (!Number.isFinite(y)) {
      throw new Error(`non-finite vertical coordinate for ${atom}`);
    }
  }
}

function projectColumnOrder(
  columns: readonly PipelineColumn[],
  atomsById: ReadonlyMap<string, VisibleAtom>,
  yByAtom: Map<string, number>,
  gap: number,
  preserveOriginalSpacing = false,
): void {
  for (const col of columns) {
    const atoms = col.atoms.filter((atom) => atomsById.has(atom));
    if (atoms.length <= 1) {
      continue;
    }
    for (let i = 1; i < atoms.length; i++) {
      const prev = atoms[i - 1]!;
      const next = atoms[i]!;
      const prevAtom = atomsById.get(prev)!;
      const nextAtom = atomsById.get(next)!;
      const heightMin = prevAtom.halfHeight + nextAtom.halfHeight + gap;
      const minDelta = preserveOriginalSpacing
        ? Math.max(heightMin, nextAtom.initialY - prevAtom.initialY)
        : heightMin;
      const prevY = yByAtom.get(prev) ?? prevAtom.initialY;
      const nextY = yByAtom.get(next) ?? nextAtom.initialY;
      if (nextY < prevY + minDelta) {
        yByAtom.set(next, prevY + minDelta);
      }
    }
    for (let i = atoms.length - 2; i >= 0; i--) {
      const prev = atoms[i]!;
      const next = atoms[i + 1]!;
      const prevAtom = atomsById.get(prev)!;
      const nextAtom = atomsById.get(next)!;
      const heightMin = prevAtom.halfHeight + nextAtom.halfHeight + gap;
      const minDelta = preserveOriginalSpacing
        ? Math.max(heightMin, nextAtom.initialY - prevAtom.initialY)
        : heightMin;
      const prevY = yByAtom.get(prev) ?? prevAtom.initialY;
      const nextY = yByAtom.get(next) ?? nextAtom.initialY;
      if (prevY > nextY - minDelta) {
        yByAtom.set(prev, nextY - minDelta);
      }
    }
    const originalTop = atomsById.get(atoms[0]!)!.initialY;
    const currentTop = yByAtom.get(atoms[0]!) ?? originalTop;
    const shift = originalTop - currentTop;
    for (const atom of atoms) {
      yByAtom.set(atom, (yByAtom.get(atom) ?? 0) + shift);
    }
  }
}

function blendWithAnchor(
  atom: string,
  candidateY: number,
  yByAtom: Map<string, number>,
  atomsById: ReadonlyMap<string, VisibleAtom>,
  desiredY: ReadonlyMap<string, number> | undefined,
  anchorWeight: number,
): number {
  const atomInfo = atomsById.get(atom);
  const anchor = desiredY?.get(atom) ?? atomInfo?.initialY ?? candidateY;
  return (
    (anchor * anchorWeight + candidateY) /
    Math.max(anchorWeight + 1, 0.000001)
  );
}

function medianFromForwardSources(
  target: string,
  targetCol: number,
  edges: readonly PipelineAtomEdge[],
  colByAtom: ReadonlyMap<string, number>,
  yByAtom: ReadonlyMap<string, number>,
  edgeClass: ReadonlyMap<PipelineAtomEdge, PipelineEdgeClass>,
): number {
  const backbone: number[] = [];
  const handoff: number[] = [];
  const other: number[] = [];
  for (const edge of edges) {
    if (edge.target !== target) {
      continue;
    }
    const sourceCol = colByAtom.get(edge.source);
    if (sourceCol === undefined || sourceCol >= targetCol) {
      continue;
    }
    const sy = yByAtom.get(edge.source);
    if (sy === undefined) {
      continue;
    }
    const cls = edgeClass.get(edge) ?? "other";
    if (cls === "ssm") {
      continue;
    }
    if (cls === "backbone") {
      backbone.push(sy);
    } else if (cls === "handoff") {
      handoff.push(sy);
    } else {
      other.push(sy);
    }
  }
  if (backbone.length > 0) {
    return median(backbone);
  }
  if (handoff.length > 0) {
    return median(handoff);
  }
  if (other.length > 0) {
    return median(other);
  }
  return Number.NaN;
}

function medianFromBackwardChildren(
  source: string,
  sourceCol: number,
  edges: readonly PipelineAtomEdge[],
  colByAtom: ReadonlyMap<string, number>,
  yByAtom: ReadonlyMap<string, number>,
  edgeClass: ReadonlyMap<PipelineAtomEdge, PipelineEdgeClass>,
  primaryParent: ReadonlyMap<string, string>,
): number {
  const ys: number[] = [];
  for (const edge of edges) {
    if (edge.source !== source) {
      continue;
    }
    const targetCol = colByAtom.get(edge.target);
    if (targetCol === undefined || targetCol <= sourceCol) {
      continue;
    }
    const cls = edgeClass.get(edge) ?? "other";
    if (cls === "ssm") {
      continue;
    }
    if (cls === "backbone" && primaryParent.get(edge.target) !== source) {
      continue;
    }
    const ty = yByAtom.get(edge.target);
    if (ty !== undefined) {
      ys.push(ty);
    }
  }
  return median(ys);
}

function solveColumnForward(params: {
  atoms: readonly VisibleAtom[];
  columns: readonly PipelineColumn[];
  edges: readonly PipelineAtomEdge[];
  colByAtom: ReadonlyMap<string, number>;
  placementByAtom: ReadonlyMap<string, PipelineAtomPlacement>;
  primaryParent: ReadonlyMap<string, string>;
  desiredY?: ReadonlyMap<string, number>;
  sweeps: number;
  gap: number;
  anchorWeight: number;
  preserveOriginalSpacing: boolean;
}): Map<string, number> {
  const atomsById = new Map(params.atoms.map((atom) => [atom.atom, atom]));
  const yByAtom = new Map(
    params.atoms.map((atom) => [atom.atom, atom.initialY]),
  );
  const edgeClass = new Map<PipelineAtomEdge, PipelineEdgeClass>();
  for (const edge of params.edges) {
    edgeClass.set(
      edge,
      classifyPipelineEdge(edge, params.placementByAtom, params.primaryParent),
    );
  }
  const maxCol = Math.max(...params.atoms.map((a) => a.columnIndex), 0);
  const atomsByCol = new Map<number, VisibleAtom[]>();
  for (const atom of params.atoms) {
    const list = atomsByCol.get(atom.columnIndex) ?? [];
    list.push(atom);
    atomsByCol.set(atom.columnIndex, list);
  }

  for (let sweep = 0; sweep < params.sweeps; sweep++) {
    const next = new Map(yByAtom);
    for (let c = 1; c <= maxCol; c++) {
      for (const atom of atomsByCol.get(c) ?? []) {
        const m = medianFromForwardSources(
          atom.atom,
          c,
          params.edges,
          params.colByAtom,
          yByAtom,
          edgeClass,
        );
        if (!Number.isNaN(m)) {
          next.set(
            atom.atom,
            blendWithAnchor(
              atom.atom,
              m,
              yByAtom,
              atomsById,
              params.desiredY,
              params.anchorWeight,
            ),
          );
        }
      }
    }
    for (let c = maxCol - 1; c >= 0; c--) {
      for (const atom of atomsByCol.get(c) ?? []) {
        const m = medianFromBackwardChildren(
          atom.atom,
          c,
          params.edges,
          params.colByAtom,
          next,
          edgeClass,
          params.primaryParent,
        );
        if (!Number.isNaN(m)) {
          const blended = blendWithAnchor(
            atom.atom,
            m,
            next,
            atomsById,
            params.desiredY,
            params.anchorWeight,
          );
          next.set(atom.atom, blended);
        }
      }
    }
    projectColumnOrder(
      params.columns,
      atomsById,
      next,
      params.gap,
      params.preserveOriginalSpacing,
    );
    yByAtom.clear();
    for (const [atom, y] of next) {
      yByAtom.set(atom, y);
    }
  }
  finiteOrThrow(yByAtom);
  return yByAtom;
}

function computeTargetYByTrack(
  atoms: readonly VisibleAtom[],
  placements: readonly PipelineAtomPlacement[],
  columns: readonly PipelineColumn[],
  edges: readonly PipelineAtomEdge[],
  yByAtom: ReadonlyMap<string, number>,
  placementByAtom: ReadonlyMap<string, PipelineAtomPlacement>,
  primaryParent: ReadonlyMap<string, string>,
  atomsById: ReadonlyMap<string, VisibleAtom>,
): Map<string, number> {
  const visible = new Set(atoms.map((atom) => atom.atom));
  const multiAtomCols = new Set<number>();
  for (const col of columns) {
    if (col.atoms.filter((a) => visible.has(a)).length > 1) {
      multiAtomCols.add(col.columnIndex);
    }
  }

  const storeAuthYsByTrack = new Map<string, number[]>();
  const columnAuthYsByTrack = new Map<string, number[]>();
  const allYsByTrack = new Map<string, number[]>();
  for (const placement of placements) {
    if (!visible.has(placement.primaryAddress)) {
      continue;
    }
    const track = placement.trackId ?? placement.primaryAddress;
    const addr = placement.primaryAddress;
    // Use packed initial Y for track targets — not post-solve yByAtom (avoids drift).
    const y = atomsById.get(addr)?.initialY ?? placement.packedOffsetY ?? 0;
    const all = allYsByTrack.get(track) ?? [];
    all.push(y);
    allYsByTrack.set(track, all);
    const authY = atomsById.get(addr)?.initialY ?? y;
    if (isDatastoreAddress(addr)) {
      const store = storeAuthYsByTrack.get(track) ?? [];
      store.push(authY);
      storeAuthYsByTrack.set(track, store);
    } else if (multiAtomCols.has(placement.columnIndex)) {
      const col = columnAuthYsByTrack.get(track) ?? [];
      col.push(authY);
      columnAuthYsByTrack.set(track, col);
    }
  }

  const targetByTrack = new Map<string, number>();
  for (const [track, allYs] of allYsByTrack) {
    const ys =
      storeAuthYsByTrack.get(track) ??
      columnAuthYsByTrack.get(track) ??
      allYs;
    const sorted = [...ys].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    targetByTrack.set(
      track,
      sorted.length % 2 === 1
        ? sorted[mid]!
        : (sorted[mid - 1]! + sorted[mid]!) / 2,
    );
  }

  const edgeClass = new Map<PipelineAtomEdge, PipelineEdgeClass>();
  for (const edge of edges) {
    edgeClass.set(
      edge,
      classifyPipelineEdge(edge, placementByAtom, primaryParent),
    );
  }
  for (const edge of edges) {
    if (edgeClass.get(edge) !== "handoff") {
      continue;
    }
    if (!visible.has(edge.source) || !visible.has(edge.target)) {
      continue;
    }
    const sourceTrack = trackForAtom(
      edge.source,
      placementByAtom,
      primaryParent,
    );
    const targetTrack = trackForAtom(
      edge.target,
      placementByAtom,
      primaryParent,
    );
    const rowY =
      targetByTrack.get(sourceTrack) ??
      atomsById.get(edge.source)?.initialY ??
      yByAtom.get(edge.source);
    if (rowY !== undefined) {
      targetByTrack.set(targetTrack, rowY);
    }
  }

  return targetByTrack;
}

function applyTrackBandSnap(params: {
  atoms: readonly VisibleAtom[];
  placements: PipelineAtomPlacement[];
  columns: readonly PipelineColumn[];
  edges: readonly PipelineAtomEdge[];
  yByAtom: Map<string, number>;
  gap: number;
  placementByAtom: ReadonlyMap<string, PipelineAtomPlacement>;
  primaryParent: ReadonlyMap<string, string>;
  preserveOriginalSpacing: boolean;
}): void {
  const atomsById = new Map(params.atoms.map((atom) => [atom.atom, atom]));
  /** Snap per-API rows only; trunk/relay uses column-forward positioning. */
  const shouldSnapTrack = (track: string) => /^api\d+$/i.test(track);

  const targetByTrack = computeTargetYByTrack(
    params.atoms,
    params.placements,
    params.columns,
    params.edges,
    params.yByAtom,
    params.placementByAtom,
    params.primaryParent,
    atomsById,
  );

  const visible = new Set(params.atoms.map((a) => a.atom));
  for (const [track, target] of targetByTrack) {
    if (!shouldSnapTrack(track)) {
      continue;
    }
    for (const placement of params.placements) {
      if (!visible.has(placement.primaryAddress)) {
        continue;
      }
      if (placement.trackId !== track) {
        continue;
      }
      params.yByAtom.set(placement.primaryAddress, target);
      placement.packedOffsetY = target;
    }
  }

  projectColumnOrder(
    params.columns,
    atomsById,
    params.yByAtom,
    params.gap,
    params.preserveOriginalSpacing,
  );
}

/** Center trunk/relay on the median Y of downstream fan-out children. */
function pinTrunkRelayToFanoutMedian(
  placements: readonly PipelineAtomPlacement[],
  atoms: readonly VisibleAtom[],
  edges: readonly PipelineAtomEdge[],
  colByAtom: ReadonlyMap<string, number>,
  yByAtom: Map<string, number>,
  placementByAtom: ReadonlyMap<string, PipelineAtomPlacement>,
  primaryParent: ReadonlyMap<string, string>,
): void {
  const visible = new Set(atoms.map((a) => a.atom));
  const edgeClass = new Map<PipelineAtomEdge, PipelineEdgeClass>();
  for (const edge of edges) {
    edgeClass.set(
      edge,
      classifyPipelineEdge(edge, placementByAtom, primaryParent),
    );
  }
  for (const placement of placements) {
    if (!visible.has(placement.primaryAddress)) {
      continue;
    }
    if (placement.trackId !== "trunk") {
      continue;
    }
    const m = medianFromBackwardChildren(
      placement.primaryAddress,
      placement.columnIndex,
      edges,
      colByAtom,
      yByAtom,
      edgeClass,
      primaryParent,
    );
    if (!Number.isNaN(m)) {
      yByAtom.set(placement.primaryAddress, m);
    }
  }
}

function solveByAveraging(params: {
  atoms: readonly VisibleAtom[];
  columns: readonly PipelineColumn[];
  edges: readonly PipelineAtomEdge[];
  colByAtom: ReadonlyMap<string, number>;
  desiredY?: ReadonlyMap<string, number>;
  sweeps: number;
  gap: number;
  anchorWeight: number;
  edgeWeight: number;
  preserveOriginalSpacing?: boolean;
}): Map<string, number> {
  const atomsById = new Map(params.atoms.map((atom) => [atom.atom, atom]));
  const yByAtom = new Map(
    params.atoms.map((atom) => [atom.atom, atom.initialY]),
  );
  const neighbors = new Map<string, string[]>();
  for (const edge of params.edges) {
    if (!atomsById.has(edge.source) || !atomsById.has(edge.target)) {
      continue;
    }
    if (
      params.colByAtom.get(edge.source) === params.colByAtom.get(edge.target)
    ) {
      continue;
    }
    const a = neighbors.get(edge.source) ?? [];
    a.push(edge.target);
    neighbors.set(edge.source, a);
    const b = neighbors.get(edge.target) ?? [];
    b.push(edge.source);
    neighbors.set(edge.target, b);
  }
  for (let sweep = 0; sweep < params.sweeps; sweep++) {
    const next = new Map(yByAtom);
    for (const atom of params.atoms) {
      let weightedY =
        (params.desiredY?.get(atom.atom) ?? atom.initialY) *
        params.anchorWeight;
      let totalWeight = params.anchorWeight;
      for (const neighbor of neighbors.get(atom.atom) ?? []) {
        weightedY += (yByAtom.get(neighbor) ?? 0) * params.edgeWeight;
        totalWeight += params.edgeWeight;
      }
      next.set(atom.atom, weightedY / Math.max(totalWeight, 0.000001));
    }
    projectColumnOrder(params.columns, atomsById, next, params.gap, params.preserveOriginalSpacing);
    yByAtom.clear();
    for (const [atom, y] of next) {
      yByAtom.set(atom, y);
    }
  }
  finiteOrThrow(yByAtom);
  return yByAtom;
}

function isStraightMode(mode: TerraformPipelineVerticalSolverMode): boolean {
  return (
    mode === "straight-y" ||
    mode === "straight-reorder" ||
    mode === "straight-relay"
  );
}

function isTrackRowsMode(mode: TerraformPipelineVerticalSolverMode): boolean {
  return (
    mode === "track-rows" ||
    mode === "track-rows-cascade" ||
    mode === "track-rows-reorder"
  );
}

function straightTrackDesiredY(
  atoms: readonly VisibleAtom[],
  placements: readonly PipelineAtomPlacement[],
  columns: readonly PipelineColumn[],
): Map<string, number> {
  const atomsById = new Map(atoms.map((atom) => [atom.atom, atom]));
  const placementByAtom = new Map(
    placements.map((p) => [p.primaryAddress, p]),
  );
  const targetByTrack = computeTargetYByTrack(
    atoms,
    placements,
    columns,
    [],
    new Map(atoms.map((atom) => [atom.atom, atom.initialY])),
    placementByAtom,
    new Map(),
    atomsById,
  );

  const visible = new Set(atoms.map((atom) => atom.atom));
  const out = new Map<string, number>();
  for (const placement of placements) {
    if (!visible.has(placement.primaryAddress)) {
      continue;
    }
    const track = placement.trackId ?? placement.primaryAddress;
    const target = targetByTrack.get(track);
    if (target !== undefined) {
      out.set(placement.primaryAddress, target);
    }
  }
  return out;
}

function reorderColumnsForStraightness(
  placements: PipelineAtomPlacement[],
  columns: readonly PipelineColumn[],
  edges: readonly PipelineAtomEdge[],
  atoms: readonly VisibleAtom[],
  primaryParent: ReadonlyMap<string, string>,
): void {
  const visible = new Set(atoms.map((atom) => atom.atom));
  const originalOrder = new Map<string, number>();
  for (const col of columns) {
    col.atoms.forEach((atom, index) => originalOrder.set(atom, index));
  }
  const neighbors = new Map<string, string[]>();
  for (const edge of edges) {
    if (!visible.has(edge.source) || !visible.has(edge.target)) {
      continue;
    }
    const out = neighbors.get(edge.source) ?? [];
    out.push(edge.target);
    neighbors.set(edge.source, out);
    const incoming = neighbors.get(edge.target) ?? [];
    incoming.push(edge.source);
    neighbors.set(edge.target, incoming);
  }
  const placementByAtom = new Map(
    placements.map((placement) => [placement.primaryAddress, placement]),
  );
  const rank = new Map<string, number>();
  for (const col of columns) {
    col.atoms.forEach((atom, index) => rank.set(atom, index));
  }

  const trackIndex = (atom: string) =>
    trackSortIndex(
      trackForAtom(atom, placementByAtom, primaryParent),
    );

  for (let sweep = 0; sweep < 8; sweep++) {
    for (const col of columns) {
      const sorted = [...col.atoms].sort((a, b) => {
        const trackDiff = trackIndex(a) - trackIndex(b);
        if (trackDiff !== 0) {
          return trackDiff;
        }
        const aNeighbors = neighbors.get(a) ?? [];
        const bNeighbors = neighbors.get(b) ?? [];
        const score = (atom: string, ns: readonly string[]) => {
          if (ns.length === 0) {
            return rank.get(atom) ?? originalOrder.get(atom) ?? 0;
          }
          return (
            ns.reduce(
              (sum, neighbor) =>
                sum + (rank.get(neighbor) ?? originalOrder.get(neighbor) ?? 0),
              0,
            ) / ns.length
          );
        };
        const diff = score(a, aNeighbors) - score(b, bNeighbors);
        if (Math.abs(diff) > 0.000001) {
          return diff;
        }
        return (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0);
      });
      col.atoms.splice(0, col.atoms.length, ...sorted);
      col.laneCount = col.atoms.length;
      sorted.forEach((atom, index) => {
        rank.set(atom, index);
        const placement = placementByAtom.get(atom);
        if (placement) {
          placement.laneIndex = index;
        }
      });
    }
  }
}

/**
 * After reordering column atoms, remap packedOffsetY per track so Y slots stay
 * with the same trackId (not with column position index).
 */
function reassignPackedOffsetYAfterReorder(
  placements: PipelineAtomPlacement[],
  columns: readonly PipelineColumn[],
  atoms: readonly VisibleAtom[],
  primaryParent: ReadonlyMap<string, string>,
): void {
  const initialYByAtom = new Map(atoms.map((a) => [a.atom, a.initialY]));
  const placementByAtom = new Map(
    placements.map((p) => [p.primaryAddress, p]),
  );
  for (const col of columns) {
    const colAtoms = col.atoms.filter((a) => initialYByAtom.has(a));
    if (colAtoms.length <= 1) {
      continue;
    }
    const ysByTrack = new Map<string, number[]>();
    for (const atom of colAtoms) {
      const track = trackForAtom(atom, placementByAtom, primaryParent);
      const list = ysByTrack.get(track) ?? [];
      list.push(initialYByAtom.get(atom)!);
      ysByTrack.set(track, list);
    }
    for (const [, ys] of ysByTrack) {
      ys.sort((a, b) => a - b);
    }
    const nextSlot = new Map<string, number>();
    for (const atom of colAtoms) {
      const track = trackForAtom(atom, placementByAtom, primaryParent);
      const pool = ysByTrack.get(track) ?? [];
      const slot = nextSlot.get(track) ?? 0;
      const p = placementByAtom.get(atom);
      if (p && pool[slot] !== undefined) {
        p.packedOffsetY = pool[slot];
      }
      nextSlot.set(track, slot + 1);
    }
  }
}

async function elkDesiredY(
  atoms: readonly VisibleAtom[],
  edges: readonly PipelineAtomEdge[],
): Promise<Map<string, number>> {
  const atomSet = new Set(atoms.map((atom) => atom.atom));
  const graph = {
    id: "pipeline-y",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.spacing.nodeNode": "80",
      "elk.layered.spacing.nodeNodeBetweenLayers": "120",
    },
    children: atoms.map((atom) => ({
      id: atom.atom,
      width: ELK_NODE_W,
      height: atom.halfHeight * 2,
    })),
    edges: edges
      .filter((edge) => atomSet.has(edge.source) && atomSet.has(edge.target))
      .map((edge, index) => ({
        id: `e${index}`,
        sources: [edge.source],
        targets: [edge.target],
      })),
  };
  const layout = await new ELK().layout(graph);
  return new Map(
    (layout.children ?? []).map((child) => [
      child.id,
      (child.y ?? 0) + (child.height ?? 0) / 2,
    ]),
  );
}

export function pipelineVerticalObjective(
  placements: readonly PipelineAtomPlacement[],
  edges: readonly PipelineAtomEdge[],
  slotHeight: ReadonlyMap<string, number>,
  options?: { anchorWeight?: number; edgeWeight?: number },
): number {
  const atomSet = new Set(
    placements
      .filter(
        (p) =>
          !isTfdHopAddress(p.primaryAddress) &&
          slotHeight.has(p.primaryAddress),
      )
      .map((p) => p.primaryAddress),
  );
  const yByAtom = new Map(
    placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]),
  );
  const initialByAtom = new Map(
    placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]),
  );
  const edgeWeight = options?.edgeWeight ?? DEFAULT_EDGE_WEIGHT;
  const anchorWeight = options?.anchorWeight ?? DEFAULT_ANCHOR_WEIGHT;
  let total = 0;
  for (const edge of edges) {
    if (!atomSet.has(edge.source) || !atomSet.has(edge.target)) {
      continue;
    }
    const d = (yByAtom.get(edge.target) ?? 0) - (yByAtom.get(edge.source) ?? 0);
    total += edgeWeight * d * d;
  }
  for (const atom of atomSet) {
    const d = (yByAtom.get(atom) ?? 0) - (initialByAtom.get(atom) ?? 0);
    total += anchorWeight * d * d;
  }
  return total;
}

/** @internal Vitest helper for track target resolution. */
export function pipelineTrackTargetYByTrackForTest(
  atoms: readonly VisibleAtom[],
  placements: readonly PipelineAtomPlacement[],
  columns: readonly PipelineColumn[],
  edges: readonly PipelineAtomEdge[],
  yByAtom: ReadonlyMap<string, number>,
  placementByAtom: ReadonlyMap<string, PipelineAtomPlacement>,
  primaryParent: ReadonlyMap<string, string>,
): Map<string, number> {
  const atomsById = new Map(atoms.map((atom) => [atom.atom, atom]));
  return computeTargetYByTrack(
    atoms,
    placements,
    columns,
    edges,
    yByAtom,
    placementByAtom,
    primaryParent,
    atomsById,
  );
}

export async function applyPipelineVerticalSolver(
  placements: PipelineAtomPlacement[],
  columns: readonly PipelineColumn[],
  edges: readonly PipelineAtomEdge[],
  slotHeight: ReadonlyMap<string, number>,
  colByAtom: ReadonlyMap<string, number>,
  options: PipelineVerticalSolverOptions,
): Promise<PipelineVerticalSolverResult> {
  if (options.mode === "none") {
    return { appliedMode: "none", warnings: [] };
  }
  const atoms = visibleAtoms(placements, slotHeight);
  if (atoms.length === 0) {
    return { appliedMode: "none", warnings: [] };
  }
  const gap = options.gap ?? DEFAULT_GAP;
  const anchorWeight =
    options.anchorWeight ??
    (isStraightMode(options.mode)
      ? STRAIGHT_ANCHOR_WEIGHT
      : DEFAULT_ANCHOR_WEIGHT);
  const edgeWeight =
    options.edgeWeight ??
    (isStraightMode(options.mode) ? STRAIGHT_EDGE_WEIGHT : DEFAULT_EDGE_WEIGHT);
  try {
    const primaryParent = options.primaryParent ?? new Map<string, string>();
    const placementByAtom = new Map(
      placements.map((p) => [p.primaryAddress, p]),
    );

    if (isTrackRowsMode(options.mode)) {
      let currentAtoms = atoms;
      if (options.mode === "track-rows-reorder") {
        reorderColumnsForStraightness(
          placements,
          columns,
          edges,
          currentAtoms,
          primaryParent,
        );
        currentAtoms = visibleAtoms(placements, slotHeight);
      }
      assignTrackRows({
        placements,
        columns,
        edges,
        slotHeight,
        primaryParent,
        gap,
        rowMode:
          options.mode === "track-rows-cascade" ? "cascade-tier" : "per-api",
      });
      return { appliedMode: options.mode, warnings: [] };
    }

    let currentAtoms = atoms;
    if (
      options.mode === "straight-reorder" ||
      options.mode === "straight-relay"
    ) {
      reorderColumnsForStraightness(
        placements,
        columns,
        edges,
        currentAtoms,
        primaryParent,
      );
      reassignPackedOffsetYAfterReorder(
        placements,
        columns,
        currentAtoms,
        primaryParent,
      );
      currentAtoms = visibleAtoms(placements, slotHeight);
    }
    const preserveOriginalSpacing = isStraightMode(options.mode);
    const desiredY = isStraightMode(options.mode)
      ? straightTrackDesiredY(currentAtoms, placements, columns)
      : options.mode === "elk"
      ? await elkDesiredY(currentAtoms, edges)
      : undefined;

    const yByAtom = isStraightMode(options.mode)
      ? solveColumnForward({
          atoms: currentAtoms,
          columns,
          edges,
          colByAtom,
          placementByAtom,
          primaryParent,
          desiredY,
          sweeps: STRAIGHT_SWEEPS,
          gap,
          anchorWeight,
          preserveOriginalSpacing,
        })
      : solveByAveraging({
          atoms: currentAtoms,
          columns,
          edges,
          colByAtom,
          desiredY,
          sweeps:
            options.mode === "exact-qp" ? EXACT_SWEEPS : CONSTRAINED_SWEEPS,
          gap,
          anchorWeight,
          edgeWeight,
          preserveOriginalSpacing,
        });

    if (isStraightMode(options.mode)) {
      applyTrackBandSnap({
        atoms: currentAtoms,
        placements,
        columns,
        edges,
        yByAtom,
        gap,
        placementByAtom,
        primaryParent,
        preserveOriginalSpacing,
      });
      pinTrunkRelayToFanoutMedian(
        placements,
        currentAtoms,
        edges,
        colByAtom,
        yByAtom,
        placementByAtom,
        primaryParent,
      );
    }

    for (const placement of placements) {
      const y = yByAtom.get(placement.primaryAddress);
      if (y !== undefined) {
        placement.packedOffsetY = y;
      }
    }
    return { appliedMode: options.mode, warnings: [] };
  } catch (err) {
    return {
      appliedMode: "none",
      warnings: [
        {
          mode: options.mode,
          message: err instanceof Error ? err.message : String(err),
        },
      ],
    };
  }
}
