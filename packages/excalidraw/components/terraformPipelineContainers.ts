/**
 * Pipeline container instance tree: expand, fork, and fanout geographic frames.
 */

import {
  pipelineGeoInstanceKey,
  samePipelineGeoPlacement,
  type PipelineAtomGeoMap,
  type PipelineGeoPath,
} from "./terraformPipelineGeo";

import type {
  PipelineAtomEdge,
  PipelineAtomGraph,
} from "./terraformPipelineAtoms";

export type PipelineAtomPlacement = {
  primaryAddress: string;
  columnIndex: number;
  laneIndex: number;
  geo: PipelineGeoPath;
  geoInstanceId: number;
  geoInstanceKey: string;
};

export type PipelineLayoutPlan = {
  placements: PipelineAtomPlacement[];
  columns: PipelineColumn[];
  geoInstanceCount: number;
};

export type PipelineColumn = {
  columnIndex: number;
  atoms: string[];
  laneCount: number;
};

export type PipelineAccountLaneBand = {
  accountId: string;
  laneIndices: ReadonlySet<number>;
  minLane: number;
};

/** Lane indices per account for pipeline geo band wrappers (e.g. 111… lanes 0–2). */
export function buildPipelineAccountLaneBands(
  placements: readonly PipelineAtomPlacement[],
): PipelineAccountLaneBand[] {
  const byAccount = new Map<string, Set<number>>();
  for (const placement of placements) {
    const lanes = byAccount.get(placement.geo.accountId) ?? new Set<number>();
    lanes.add(placement.laneIndex);
    byAccount.set(placement.geo.accountId, lanes);
  }
  return [...byAccount.entries()]
    .map(([accountId, laneIndices]) => ({
      accountId,
      laneIndices,
      minLane: Math.min(...laneIndices),
    }))
    .sort(
      (a, b) => a.minLane - b.minLane || a.accountId.localeCompare(b.accountId),
    );
}

function geoNeedsNewInstance(
  prev: PipelineGeoPath | null,
  prevInstanceId: number,
  next: PipelineGeoPath,
  reenteringVpcAfterRegional: boolean,
): number {
  if (!prev) {
    return 0;
  }
  if (samePipelineGeoPlacement(prev, next) && !reenteringVpcAfterRegional) {
    return prevInstanceId;
  }
  if (prev.region !== next.region) {
    return prevInstanceId + 1;
  }
  if (prev.tier === "regional" && next.vpcId) {
    return prevInstanceId + 1;
  }
  if (prev.vpcId && next.tier === "regional" && prev.region === next.region) {
    return prevInstanceId;
  }
  if (
    prev.vpcId &&
    next.vpcId &&
    prev.vpcId === next.vpcId &&
    reenteringVpcAfterRegional
  ) {
    return prevInstanceId + 1;
  }
  if (
    prev.vpcId &&
    next.vpcId &&
    prev.vpcId === next.vpcId &&
    prev.tier !== next.tier
  ) {
    return prevInstanceId;
  }
  return prevInstanceId + 1;
}

function buildColumnsFromEdges(
  atomGraph: PipelineAtomGraph,
  edges: readonly PipelineAtomEdge[],
): string[][] {
  const sorted = [...edges].sort(
    (a, b) => a.sequence - b.sequence || a.source.localeCompare(b.source),
  );

  const sources = new Set(sorted.map((e) => e.source));
  const targets = new Set(sorted.map((e) => e.target));
  const roots = [...sources].filter((s) => !targets.has(s)).sort();

  const columns: string[][] = [];
  const placed = new Set<string>();

  if (roots.length > 0) {
    columns.push(roots);
    for (const r of roots) {
      placed.add(r);
    }
  } else if (atomGraph.atoms.size > 0) {
    const first = [...atomGraph.atoms.keys()].sort()[0]!;
    columns.push([first]);
    placed.add(first);
  }

  const seenSources = new Set<string>();
  for (const e of sorted) {
    if (seenSources.has(e.source)) {
      continue;
    }
    seenSources.add(e.source);
    const batchTargets = [
      ...new Set(
        sorted.filter((x) => x.source === e.source).map((x) => x.target),
      ),
    ].sort();
    const unplaced = batchTargets.filter((t) => !placed.has(t));
    if (unplaced.length === 0) {
      continue;
    }
    columns.push(unplaced);
    for (const t of unplaced) {
      placed.add(t);
    }
  }

  for (const addr of [...atomGraph.atoms.keys()].sort()) {
    if (!placed.has(addr)) {
      columns.push([addr]);
      placed.add(addr);
    }
  }

  return columns;
}

/**
 * Merge consecutive single-lane columns whose atoms are 1:1 children of lanes
 * in the previous multi-lane column (e.g. api1..5 -> lambda1..5 -> ssm1..5).
 */
export function mergeParallelFanoutColumns(
  columns: readonly string[][],
  edges: readonly PipelineAtomEdge[],
): string[][] {
  const parentOf = new Map<string, string>();
  for (const e of edges) {
    if (!parentOf.has(e.target)) {
      parentOf.set(e.target, e.source);
    }
  }

  const result: string[][] = [];

  for (let i = 0; i < columns.length; i++) {
    const prevCol = result[result.length - 1];
    const prevLaneCount = prevCol?.length ?? 0;

    if (
      prevCol &&
      prevLaneCount > 1 &&
      columns[i]?.length === 1 &&
      i + prevLaneCount <= columns.length
    ) {
      const run = columns.slice(i, i + prevLaneCount);
      const isSingleLaneRun = run.every((col) => col.length === 1);

      if (isSingleLaneRun) {
        const children = run.map((col) => col[0]!);
        const aligned = children.every(
          (child, laneIdx) => parentOf.get(child) === prevCol[laneIdx],
        );

        if (aligned) {
          result.push(children);
          i += prevLaneCount - 1;
          continue;
        }
      }
    }

    result.push([...columns[i]!]);
  }

  return result;
}

/** Sort multi-lane columns by average parent lane index (TALA-style barycenter). */
function barycenterSortFanoutColumns(
  columnAtomLists: string[][],
  edges: readonly PipelineAtomEdge[],
): string[][] {
  const parentOf = new Map<string, string>();
  for (const e of edges) {
    if (!parentOf.has(e.target)) {
      parentOf.set(e.target, e.source);
    }
  }

  const laneByAtom = new Map<string, number>();
  const result: string[][] = [];

  for (let colIdx = 0; colIdx < columnAtomLists.length; colIdx++) {
    const atoms = [...columnAtomLists[colIdx]!];

    if (atoms.length > 1) {
      const barycenter = (atom: string): number => {
        const incoming = edges.filter((e) => e.target === atom);
        const parents =
          incoming.length > 0
            ? [...new Set(incoming.map((e) => e.source))]
            : parentOf.has(atom)
            ? [parentOf.get(atom)!]
            : [];
        let sum = 0;
        let count = 0;
        for (const p of parents) {
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

/** Order atom edges into pipeline columns following TFD sequence with fanout grouping. */
export function buildPipelineLayoutPlan(
  atomGraph: PipelineAtomGraph,
  geoMap: PipelineAtomGeoMap,
): PipelineLayoutPlan {
  const columnAtomLists = barycenterSortFanoutColumns(
    mergeParallelFanoutColumns(
      buildColumnsFromEdges(atomGraph, atomGraph.edges),
      atomGraph.edges,
    ),
    atomGraph.edges,
  );

  const placements: PipelineAtomPlacement[] = [];
  let prevGeo: PipelineGeoPath | null = null;
  let prevInstanceId = 0;
  let wasRegional = false;
  const geoInstances = new Set<string>();

  for (let colIdx = 0; colIdx < columnAtomLists.length; colIdx++) {
    const colAtoms = columnAtomLists[colIdx]!;
    for (let laneIdx = 0; laneIdx < colAtoms.length; laneIdx++) {
      const primaryAddress = colAtoms[laneIdx]!;
      const geo = geoMap.get(primaryAddress);
      if (!geo) {
        continue;
      }
      const reenteringVpc = wasRegional && geo.vpcId != null;
      let instanceId = geoNeedsNewInstance(
        prevGeo,
        prevInstanceId,
        geo,
        reenteringVpc,
      );
      if (prevGeo && samePipelineGeoPlacement(prevGeo, geo) && !reenteringVpc) {
        instanceId = prevInstanceId;
      }
      if (
        prevGeo &&
        prevGeo.vpcId &&
        geo.vpcId &&
        prevGeo.vpcId === geo.vpcId &&
        wasRegional
      ) {
        instanceId = prevInstanceId + 1;
      }

      const geoInstanceKey = pipelineGeoInstanceKey(geo, instanceId);
      geoInstances.add(geoInstanceKey);

      placements.push({
        primaryAddress,
        columnIndex: colIdx,
        laneIndex: laneIdx,
        geo,
        geoInstanceId: instanceId,
        geoInstanceKey,
      });

      prevGeo = geo;
      prevInstanceId = instanceId;
      wasRegional = geo.tier === "regional";
    }
  }

  const columns: PipelineColumn[] = columnAtomLists.map(
    (atoms, columnIndex) => ({
      columnIndex,
      atoms,
      laneCount: atoms.length,
    }),
  );

  return {
    placements,
    columns,
    geoInstanceCount: geoInstances.size,
  };
}
