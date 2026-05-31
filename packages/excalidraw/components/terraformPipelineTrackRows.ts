/**
 * Track-row vertical layout: one global Y per API/trunk track, optional cascade
 * row merging, column-local overlap resolution only.
 */

import { isTfdHopAddress } from "./terraformDeclaredDataFlow";
import {
  derivePipelineTrackId,
  trackSortIndex,
} from "./terraformPipelineColumnPack";

import type { PipelineAtomEdge } from "./terraformPipelineAtoms";
import type {
  PipelineAtomPlacement,
  PipelineColumn,
} from "./terraformPipelineContainers";

const TRACK_GAP = 32;
const DEFAULT_GAP = 24;
const DEFAULT_SLOT = 96;

export type PipelineTrackRowMode = "per-api" | "cascade-tier";

export type AssignTrackRowsOptions = {
  placements: PipelineAtomPlacement[];
  columns: readonly PipelineColumn[];
  edges: readonly PipelineAtomEdge[];
  slotHeight: ReadonlyMap<string, number>;
  primaryParent: ReadonlyMap<string, string>;
  gap?: number;
  trackGap?: number;
  rowMode?: PipelineTrackRowMode;
};

type PipelineEdgeClass = "backbone" | "handoff" | "ssm" | "other";

class UnionFind {
  private readonly parent = new Map<string, string>();

  find(x: string): string {
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    let current = x;
    while (current !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) {
      this.parent.set(rb, ra);
    }
  }

  ensure(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
    }
  }
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

/** Center Y for a track before cascade merging. */
export function baseRowCenterYForTrack(
  trackId: string,
  rowPitch: number,
  slotHeight: number,
): number {
  const half = slotHeight / 2;
  if (trackId === "trunk") {
    return half;
  }
  const idx = trackSortIndex(trackId);
  if (/^api\d+$/i.test(trackId)) {
    return half + Math.max(0, idx - 1) * rowPitch;
  }
  return half + idx * rowPitch;
}

function mergeTrackRows(
  tracks: readonly string[],
  edges: readonly PipelineAtomEdge[],
  placementByAtom: ReadonlyMap<string, PipelineAtomPlacement>,
  primaryParent: ReadonlyMap<string, string>,
  baseRowByTrack: Map<string, number>,
  rowMode: PipelineTrackRowMode,
): Map<string, number> {
  const uf = new UnionFind();
  for (const track of tracks) {
    uf.ensure(track);
  }

  if (rowMode === "cascade-tier") {
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
      const st = trackForAtom(edge.source, placementByAtom, primaryParent);
      const tt = trackForAtom(edge.target, placementByAtom, primaryParent);
      uf.ensure(st);
      uf.ensure(tt);
      uf.union(st, tt);
    }
  }

  const rowByTrack = new Map<string, number>();
  const componentTracks = new Map<string, string[]>();
  for (const track of tracks) {
    const root = uf.find(track);
    const list = componentTracks.get(root) ?? [];
    list.push(track);
    componentTracks.set(root, list);
  }

  for (const [, members] of componentTracks) {
    const anchor = members.reduce(
      (best, track) =>
        trackSortIndex(track) < trackSortIndex(best) ? track : best,
      members[0]!,
    );
    const rowY = baseRowByTrack.get(anchor) ?? baseRowByTrack.get(members[0]!)!;
    for (const track of members) {
      rowByTrack.set(track, rowY);
    }
  }

  return rowByTrack;
}

function pinTrunkRowToFanoutMedian(
  placements: readonly PipelineAtomPlacement[],
  edges: readonly PipelineAtomEdge[],
  colByAtom: ReadonlyMap<string, number>,
  yByAtom: Map<string, number>,
  placementByAtom: ReadonlyMap<string, PipelineAtomPlacement>,
  primaryParent: ReadonlyMap<string, string>,
): void {
  const edgeClass = new Map<PipelineAtomEdge, PipelineEdgeClass>();
  for (const edge of edges) {
    edgeClass.set(
      edge,
      classifyPipelineEdge(edge, placementByAtom, primaryParent),
    );
  }

  for (const placement of placements) {
    if (placement.trackId !== "trunk") {
      continue;
    }
    const source = placement.primaryAddress;
    const sourceCol = colByAtom.get(source);
    if (sourceCol === undefined) {
      continue;
    }
    const childYs: number[] = [];
    for (const edge of edges) {
      if (edge.source !== source) {
        continue;
      }
      const cls = edgeClass.get(edge) ?? "other";
      if (cls === "ssm") {
        continue;
      }
      const targetCol = colByAtom.get(edge.target);
      if (targetCol === undefined || targetCol <= sourceCol) {
        continue;
      }
      const ty = yByAtom.get(edge.target);
      if (ty !== undefined) {
        childYs.push(ty);
      }
    }
    const m = median(childYs);
    if (!Number.isNaN(m)) {
      yByAtom.set(source, m);
    }
  }
}

function resolveColumnOverlaps(
  columns: readonly PipelineColumn[],
  placementByAtom: ReadonlyMap<string, PipelineAtomPlacement>,
  slotHeight: ReadonlyMap<string, number>,
  yByAtom: Map<string, number>,
  gap: number,
  primaryParent: ReadonlyMap<string, string>,
): void {
  for (const col of columns) {
    const atoms = col.atoms.filter(
      (atom) =>
        !isTfdHopAddress(atom) &&
        placementByAtom.has(atom) &&
        yByAtom.has(atom),
    );
    if (atoms.length <= 1) {
      continue;
    }
    const sorted = [...atoms].sort(
      (a, b) =>
        trackSortIndex(trackForAtom(a, placementByAtom, primaryParent)) -
        trackSortIndex(trackForAtom(b, placementByAtom, primaryParent)),
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const next = sorted[i]!;
      const prevH = slotHeight.get(prev) ?? DEFAULT_SLOT;
      const nextH = slotHeight.get(next) ?? DEFAULT_SLOT;
      const minDelta = prevH / 2 + nextH / 2 + gap;
      const prevY = yByAtom.get(prev)!;
      const nextY = yByAtom.get(next)!;
      if (nextY < prevY + minDelta) {
        yByAtom.set(next, prevY + minDelta);
      }
    }
  }
}

/**
 * Assign packedOffsetY from track rows (single source of truth for straight layout).
 */
export function assignTrackRows(options: AssignTrackRowsOptions): Map<string, number> {
  const gap = options.gap ?? DEFAULT_GAP;
  const trackGap = options.trackGap ?? TRACK_GAP;
  const rowMode = options.rowMode ?? "per-api";
  const placementByAtom = new Map(
    options.placements.map((p) => [p.primaryAddress, p]),
  );
  const colByAtom = new Map<string, number>();
  for (const col of options.columns) {
    for (const atom of col.atoms) {
      colByAtom.set(atom, col.columnIndex);
    }
  }
  for (const p of options.placements) {
    colByAtom.set(p.primaryAddress, p.columnIndex);
  }

  const visible = options.placements.filter(
    (p) =>
      !isTfdHopAddress(p.primaryAddress) &&
      options.slotHeight.has(p.primaryAddress),
  );
  if (visible.length === 0) {
    return new Map();
  }

  const tracks = new Set<string>();
  for (const p of visible) {
    tracks.add(trackForAtom(p.primaryAddress, placementByAtom, options.primaryParent));
  }

  const maxSlot =
    Math.max(
      ...visible.map(
        (p) => options.slotHeight.get(p.primaryAddress) ?? DEFAULT_SLOT,
      ),
    ) || DEFAULT_SLOT;
  const rowPitch = maxSlot + gap + trackGap;

  const baseRowByTrack = new Map<string, number>();
  for (const track of tracks) {
    baseRowByTrack.set(
      track,
      baseRowCenterYForTrack(track, rowPitch, maxSlot),
    );
  }

  const rowByTrack = mergeTrackRows(
    [...tracks],
    options.edges,
    placementByAtom,
    options.primaryParent,
    baseRowByTrack,
    rowMode,
  );

  const yByAtom = new Map<string, number>();
  for (const p of visible) {
    const track = trackForAtom(
      p.primaryAddress,
      placementByAtom,
      options.primaryParent,
    );
    const rowY = rowByTrack.get(track);
    if (rowY !== undefined) {
      yByAtom.set(p.primaryAddress, rowY);
    }
  }

  resolveColumnOverlaps(
    options.columns,
    placementByAtom,
    options.slotHeight,
    yByAtom,
    gap,
    options.primaryParent,
  );

  pinTrunkRowToFanoutMedian(
    visible,
    options.edges,
    colByAtom,
    yByAtom,
    placementByAtom,
    options.primaryParent,
  );

  for (const p of options.placements) {
    const y = yByAtom.get(p.primaryAddress);
    if (y !== undefined) {
      p.packedOffsetY = y;
    }
  }

  return yByAtom;
}
