/**
 * Pipeline container instance tree: expand, fork, and fanout geographic frames.
 */

import {
  pipelineGeoInstanceKey,
  samePipelineGeoPlacement,
  type PipelineAtomGeoMap,
  type PipelineGeoPath,
} from "./terraformPipelineGeo";
import {
  barycenterSortFanoutColumns,
  buildPipelineColumnsFromTfdDepth,
  buildTfdLaneIndexMap,
  buildTfdPrimaryParentMap,
} from "./terraformPipelineTfd";

import type { PipelineAtomGraph } from "./terraformPipelineAtoms";

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

/** Assign columns from TFD depth, lanes from primary-parent chain, then geo instances. */
export function buildPipelineLayoutPlan(
  atomGraph: PipelineAtomGraph,
  geoMap: PipelineAtomGeoMap,
): PipelineLayoutPlan {
  const edges = atomGraph.edges;
  const primaryParent = buildTfdPrimaryParentMap(edges);
  let columnAtomLists = buildPipelineColumnsFromTfdDepth(atomGraph, edges);
  columnAtomLists = barycenterSortFanoutColumns(
    columnAtomLists,
    edges,
    primaryParent,
  );
  const laneByAtom = buildTfdLaneIndexMap(columnAtomLists, primaryParent);

  const placements: PipelineAtomPlacement[] = [];
  let prevGeo: PipelineGeoPath | null = null;
  let prevInstanceId = 0;
  let wasRegional = false;
  const geoInstances = new Set<string>();

  for (let colIdx = 0; colIdx < columnAtomLists.length; colIdx++) {
    const colAtoms = columnAtomLists[colIdx]!;
    for (const primaryAddress of colAtoms) {
      const geo = geoMap.get(primaryAddress);
      if (!geo) {
        continue;
      }
      const laneIndex = laneByAtom.get(primaryAddress) ?? 0;
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
        laneIndex,
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
