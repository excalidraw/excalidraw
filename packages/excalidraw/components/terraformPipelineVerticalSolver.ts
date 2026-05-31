/** Global vertical positioning for fixed pipeline columns. */

import ELK from "elkjs/lib/elk.bundled.js";

import { isTfdHopAddress } from "./terraformDeclaredDataFlow";

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
};

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
      const minDelta = prevAtom.halfHeight + nextAtom.halfHeight + gap;
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
      const minDelta = prevAtom.halfHeight + nextAtom.halfHeight + gap;
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
    projectColumnOrder(params.columns, atomsById, next, params.gap);
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

function straightTrackDesiredY(
  atoms: readonly VisibleAtom[],
  placements: readonly PipelineAtomPlacement[],
): Map<string, number> {
  const visible = new Set(atoms.map((atom) => atom.atom));
  const ysByTrack = new Map<string, number[]>();
  for (const placement of placements) {
    if (!visible.has(placement.primaryAddress)) {
      continue;
    }
    const track = placement.trackId ?? placement.primaryAddress;
    const ys = ysByTrack.get(track) ?? [];
    ys.push(placement.packedOffsetY ?? 0);
    ysByTrack.set(track, ys);
  }

  const targetByTrack = new Map<string, number>();
  for (const [track, ys] of ysByTrack) {
    const sorted = [...ys].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    targetByTrack.set(
      track,
      sorted.length % 2 === 1
        ? sorted[mid]!
        : (sorted[mid - 1]! + sorted[mid]!) / 2,
    );
  }

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

  for (let sweep = 0; sweep < 8; sweep++) {
    for (const col of columns) {
      const sorted = [...col.atoms].sort((a, b) => {
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
    if (
      options.mode === "straight-reorder" ||
      options.mode === "straight-relay"
    ) {
      reorderColumnsForStraightness(placements, columns, edges, atoms);
    }
    const desiredY = isStraightMode(options.mode)
      ? straightTrackDesiredY(atoms, placements)
      : options.mode === "elk"
      ? await elkDesiredY(atoms, edges)
      : undefined;
    const yByAtom = solveByAveraging({
      atoms,
      columns,
      edges,
      colByAtom,
      desiredY,
      sweeps: isStraightMode(options.mode)
        ? STRAIGHT_SWEEPS
        : options.mode === "exact-qp"
        ? EXACT_SWEEPS
        : CONSTRAINED_SWEEPS,
      gap,
      anchorWeight,
      edgeWeight,
    });
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
