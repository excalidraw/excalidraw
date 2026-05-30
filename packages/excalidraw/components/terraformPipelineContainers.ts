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
  derivePipelineTrackId,
  minimizePipelineCrossingsByTrack,
} from "./terraformPipelineColumnPack";
import { minimizePipelineCrossings } from "./terraformPipelineCrossing";
import {
  buildPipelineColumnsFromTfdDepth,
  buildTfdEdgeAdvances,
  buildTfdEdgeAdvancesV2,
  buildTfdLaneIndexMap,
  buildTfdPrimaryParentMap,
} from "./terraformPipelineTfd";

import type { PipelineAtomGraph } from "./terraformPipelineAtoms";
import type { TerraformPipelineLayoutMode } from "./terraformPipelineLayoutMode";

export type PipelineAtomPlacement = {
  primaryAddress: string;
  columnIndex: number;
  laneIndex: number;
  /** Column-local Y of primary cluster center (before canvas offset). */
  packedOffsetY?: number;
  /** API chain band for dense columns (api6, trunk, …). */
  trackId?: string;
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

type HierarchyColumnAtom = {
  atom: string;
  originalColumn: number;
  originalLane: number;
  groupKey: string;
};

function hierarchyGroupKey(geo: PipelineGeoPath | undefined): string {
  if (!geo) {
    return "__unknown";
  }
  const networkKey = geo.vpcId ? `vpc:${geo.vpcId}` : `regional:${geo.region}`;
  return [
    geo.accountId || "account",
    geo.region || "region",
    networkKey,
    geo.tier || "tier",
    geo.subnetSignature || "subnet",
  ].join("|");
}

function columnHasFragmentedHierarchyRuns(
  atoms: readonly string[],
  geoMap: PipelineAtomGeoMap,
): boolean {
  const seen = new Set<string>();
  let prevKey: string | null = null;
  for (const atom of atoms) {
    const key = hierarchyGroupKey(geoMap.get(atom));
    if (key === prevKey) {
      continue;
    }
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
    prevKey = key;
  }
  return false;
}

function compactColumnIndexes(colByAtom: Map<string, number>): void {
  const sorted = [...new Set(colByAtom.values())].sort((a, b) => a - b);
  const compact = new Map(sorted.map((col, index) => [col, index]));
  for (const [atom, col] of colByAtom) {
    colByAtom.set(atom, compact.get(col) ?? col);
  }
}

function relaxColumnIndexesForEdges(
  atomGraph: PipelineAtomGraph,
  colByAtom: Map<string, number>,
): void {
  const advances =
    atomGraph.tfdVersion === 2
      ? buildTfdEdgeAdvancesV2(atomGraph.edges)
      : buildTfdEdgeAdvances(atomGraph.edges);
  for (let pass = 0; pass < advances.length + atomGraph.atoms.size; pass++) {
    let changed = false;
    for (const { source, target, advance } of advances) {
      const sourceCol = colByAtom.get(source);
      if (sourceCol === undefined) {
        continue;
      }
      const required = sourceCol + advance;
      const current = colByAtom.get(target) ?? 0;
      if (required > current) {
        colByAtom.set(target, required);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
}

function rebuildColumnsFromIndexMap(
  atoms: readonly HierarchyColumnAtom[],
  colByAtom: ReadonlyMap<string, number>,
): string[][] {
  const byCol = new Map<number, HierarchyColumnAtom[]>();
  for (const item of atoms) {
    const col = colByAtom.get(item.atom) ?? item.originalColumn;
    const list = byCol.get(col) ?? [];
    list.push(item);
    byCol.set(col, list);
  }
  return [...byCol.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, list]) =>
      list
        .sort(
          (a, b) =>
            a.originalColumn - b.originalColumn ||
            a.originalLane - b.originalLane ||
            a.atom.localeCompare(b.atom),
        )
        .map((item) => item.atom),
    );
}

export function normalizePipelineColumnsForHierarchy(
  columnAtomLists: readonly string[][],
  atomGraph: PipelineAtomGraph,
  geoMap: PipelineAtomGeoMap,
  mode: TerraformPipelineLayoutMode = "legacy",
): string[][] {
  if (mode === "legacy") {
    return columnAtomLists.map((col) => [...col]);
  }

  const atoms: HierarchyColumnAtom[] = [];
  const colByAtom = new Map<string, number>();
  let globalColumnOffset = 0;

  for (let colIdx = 0; colIdx < columnAtomLists.length; colIdx++) {
    const columnAtoms = columnAtomLists[colIdx]!;
    const fragmented =
      mode === "global-relayer" ||
      columnHasFragmentedHierarchyRuns(columnAtoms, geoMap);
    const groupOrder = new Map<string, number>();

    for (let lane = 0; lane < columnAtoms.length; lane++) {
      const atom = columnAtoms[lane]!;
      const groupKey = hierarchyGroupKey(geoMap.get(atom));
      if (!groupOrder.has(groupKey)) {
        groupOrder.set(groupKey, groupOrder.size);
      }
      const item = {
        atom,
        originalColumn: colIdx,
        originalLane: lane,
        groupKey,
      };
      atoms.push(item);
      const subColumn = fragmented ? groupOrder.get(groupKey)! : 0;
      colByAtom.set(atom, globalColumnOffset + subColumn);
    }

    globalColumnOffset += fragmented ? Math.max(1, groupOrder.size) : 1;
  }

  relaxColumnIndexesForEdges(atomGraph, colByAtom);
  compactColumnIndexes(colByAtom);
  return rebuildColumnsFromIndexMap(atoms, colByAtom);
}

/** Track-band indices per account for pipeline geo band wrappers. */
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
  mode: TerraformPipelineLayoutMode = "legacy",
): PipelineLayoutPlan {
  const edges = atomGraph.edges;
  const primaryParent = buildTfdPrimaryParentMap(edges);
  let columnAtomLists = buildPipelineColumnsFromTfdDepth(atomGraph, edges);
  columnAtomLists = minimizePipelineCrossings(columnAtomLists, edges, {
    maxIterations: 12,
    useMedian: false,
    enableSifting: true,
  });
  columnAtomLists = minimizePipelineCrossingsByTrack(
    columnAtomLists,
    edges,
    primaryParent,
    {
      maxIterations: 8,
      useMedian: false,
      enableSifting: true,
    },
  );
  columnAtomLists = normalizePipelineColumnsForHierarchy(
    columnAtomLists,
    atomGraph,
    geoMap,
    mode,
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
      const trackId = derivePipelineTrackId(primaryAddress, primaryParent);
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
        trackId,
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
