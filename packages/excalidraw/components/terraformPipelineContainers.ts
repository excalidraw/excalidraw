/**
 * Pipeline container instance tree: expand, fork, and fanout geographic frames.
 */

import {
  pipelineGeoInstanceKey,
  samePipelineGeoPlacement,
  type PipelineAtomGeoMap,
  type PipelineGeoPath,
} from "./terraformPipelineGeo";

import type { PipelineAtomEdge, PipelineAtomGraph } from "./terraformPipelineAtoms";

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
  if (prev.tier === "regional" && next.vpcId) {
    return prevInstanceId + 1;
  }
  if (prev.vpcId && next.tier === "regional") {
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

/** Order atom edges into pipeline columns following TFD sequence with fanout grouping. */
export function buildPipelineLayoutPlan(
  atomGraph: PipelineAtomGraph,
  geoMap: PipelineAtomGeoMap,
): PipelineLayoutPlan {
  const columnAtomLists = buildColumnsFromEdges(atomGraph, atomGraph.edges);

  const placements: PipelineAtomPlacement[] = [];
  let prevGeo: PipelineGeoPath | null = null;
  let prevInstanceId = 0;
  let wasRegional = false;
  const geoInstances = new Set<string>();

  for (let colIdx = 0; colIdx < columnAtomLists.length; colIdx++) {
    const colAtoms = columnAtomLists[colIdx]!;
    colAtoms.forEach((primaryAddress, laneIdx) => {
      const geo = geoMap.get(primaryAddress);
      if (!geo) {
        return;
      }
      const reenteringVpc = wasRegional && geo.vpcId != null;
      let instanceId = geoNeedsNewInstance(
        prevGeo,
        prevInstanceId,
        geo,
        reenteringVpc,
      );
      if (
        prevGeo &&
        samePipelineGeoPlacement(prevGeo, geo) &&
        !reenteringVpc
      ) {
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
    });
  }

  const columns: PipelineColumn[] = columnAtomLists.map((atoms, columnIndex) => ({
    columnIndex,
    atoms,
    laneCount: atoms.length,
  }));

  return {
    placements,
    columns,
    geoInstanceCount: geoInstances.size,
  };
}
