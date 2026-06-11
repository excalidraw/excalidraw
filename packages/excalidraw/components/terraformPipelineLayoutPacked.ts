import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import {
  computeGlobalColumnX,
  laneKey,
  layoutLaneClusters,
  PIPELINE_FRAME_PAD,
  PIPELINE_LANE_GAP_Y,
  PIPELINE_MARGIN,
  type PipelineCluster,
  type PipelineLayoutPrep,
} from "./terraformPipelineLayoutShared";

import type { TerraformDependencyLayoutBox } from "./terraformElkLayout";

export type PackedDepthShiftResult = {
  /** clusterId -> new depth, only for clusters whose depth changed. */
  shiftedDepths: Map<string, number>;
  shiftCount: number;
  groupShiftCount: number;
};

export const EMPTY_PACKED_DEPTH_SHIFTS: PackedDepthShiftResult = {
  shiftedDepths: new Map(),
  shiftCount: 0,
  groupShiftCount: 0,
};

/**
 * Pushing a unit past a wide sibling predecessor may need columns beyond the
 * unshifted maxDepth; allow bounded growth so width stays sane while height
 * (the packing objective) can shrink.
 */
const PACKED_EXTRA_COLUMN_ALLOWANCE = 6;

/**
 * Two sibling boxes may share a Y band only when their inflated rects are
 * separated horizontally by at least this much, so emitted hull frames keep
 * visible daylight between them.
 */
const PACKED_HORIZONTAL_SHARE_CLEARANCE = PIPELINE_FRAME_PAD;

function providerKeyOf(c: PipelineCluster): string {
  return c.placement.providerFamily;
}

function accountKeyOf(c: PipelineCluster): string {
  return [c.placement.providerFamily, c.placement.accountId].join("\0");
}

function regionKeyOf(c: PipelineCluster): string {
  return [
    c.placement.providerFamily,
    c.placement.accountId,
    c.placement.region,
  ].join("\0");
}

function vpcKeyOf(c: PipelineCluster): string | null {
  return c.placement.vpcId
    ? [
        c.placement.providerFamily,
        c.placement.accountId,
        c.placement.region,
        c.placement.vpcId,
      ].join("\0")
    : null;
}

/**
 * Sibling unit levels eligible for uniform rightward depth shifts, coarse to
 * fine: accounts under a provider, regions under an account, VPCs (or
 * VPC-less lanes) under a region, lanes under a VPC.
 */
const PACKED_SHIFT_LEVELS: Array<{
  parentOf: (c: PipelineCluster) => string | null;
  unitOf: (c: PipelineCluster) => string;
}> = [
  { parentOf: providerKeyOf, unitOf: accountKeyOf },
  { parentOf: accountKeyOf, unitOf: regionKeyOf },
  {
    parentOf: regionKeyOf,
    unitOf: (c) => vpcKeyOf(c) ?? laneKey(c.placement),
  },
  { parentOf: vpcKeyOf, unitOf: (c) => laneKey(c.placement) },
];

type PackedShiftUnit = {
  key: string;
  members: PipelineCluster[];
  minFirstSequence: number;
};

function unitInterval(
  unit: PackedShiftUnit,
  depths: ReadonlyMap<string, number>,
): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const member of unit.members) {
    const d = depths.get(member.id) ?? member.depth;
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  return { min, max };
}

/**
 * Pass 1 — group-uniform rightward depth shifts (ALAP bounded by outgoing
 * edges). A unit with sibling predecessors (TFD edges arriving from a sibling
 * unit under the same topology parent) is pushed just past all of those
 * siblings' columns so pass 2 can place it beside them instead of below.
 * Incoming edges only gain margin; intra-unit edges shift uniformly; external
 * outgoing edges bound the shift, so `A -> B ⇒ depth(A) < depth(B)` is
 * preserved by construction.
 */
export function computePackedDepthShifts(
  prep: PipelineLayoutPrep,
): PackedDepthShiftResult {
  if (prep.depthResult.hasCycle) {
    return EMPTY_PACKED_DEPTH_SHIFTS;
  }

  const depths = new Map<string, number>(
    prep.clusters.map((c) => [c.id, c.depth]),
  );
  const clusterById = new Map(prep.clusters.map((c) => [c.id, c]));
  const maxAllowedDepth = prep.maxDepth + PACKED_EXTRA_COLUMN_ALLOWANCE;
  let groupShiftCount = 0;

  for (const level of PACKED_SHIFT_LEVELS) {
    const byParent = new Map<string, Map<string, PackedShiftUnit>>();
    for (const cluster of prep.clusters) {
      const parentKey = level.parentOf(cluster);
      if (parentKey == null) {
        continue;
      }
      const unitKey = level.unitOf(cluster);
      const units = byParent.get(parentKey) ?? new Map();
      byParent.set(parentKey, units);
      const unit = units.get(unitKey) ?? {
        key: unitKey,
        members: [],
        minFirstSequence: Infinity,
      };
      unit.members.push(cluster);
      unit.minFirstSequence = Math.min(
        unit.minFirstSequence,
        cluster.firstSequence,
      );
      units.set(unitKey, unit);
    }

    for (const [, unitMap] of [...byParent.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const units = [...unitMap.values()];
      if (units.length < 2) {
        continue;
      }
      const unitKeyById = new Map<string, string>();
      for (const unit of units) {
        for (const member of unit.members) {
          unitKeyById.set(member.id, unit.key);
        }
      }
      units.sort(
        (a, b) =>
          unitInterval(a, depths).min - unitInterval(b, depths).min ||
          a.minFirstSequence - b.minFirstSequence ||
          a.key.localeCompare(b.key),
      );

      for (const unit of units) {
        const memberIds = new Set(unit.members.map((m) => m.id));
        const predecessorSiblings = new Set<string>();
        let outgoingSlack = Infinity;
        for (const edge of prep.collapsedEdges) {
          const sourceInUnit = memberIds.has(edge.source);
          const targetInUnit = memberIds.has(edge.target);
          if (sourceInUnit && !targetInUnit) {
            const sourceDepth = depths.get(edge.source);
            const targetDepth = depths.get(edge.target);
            if (sourceDepth != null && targetDepth != null) {
              outgoingSlack = Math.min(
                outgoingSlack,
                targetDepth - sourceDepth - 1,
              );
            }
          } else if (targetInUnit && !sourceInUnit) {
            const siblingKey = unitKeyById.get(edge.source);
            if (siblingKey != null && siblingKey !== unit.key) {
              predecessorSiblings.add(siblingKey);
            }
          }
        }
        if (predecessorSiblings.size === 0) {
          continue;
        }
        const interval = unitInterval(unit, depths);
        let pastAllPredecessors = -Infinity;
        for (const siblingKey of predecessorSiblings) {
          const sibling = unitMap.get(siblingKey);
          if (sibling) {
            pastAllPredecessors = Math.max(
              pastAllPredecessors,
              unitInterval(sibling, depths).max + 1,
            );
          }
        }
        const desired = pastAllPredecessors - interval.min;
        if (desired <= 0 || desired > outgoingSlack) {
          continue;
        }
        if (interval.max + desired > maxAllowedDepth) {
          continue;
        }
        for (const member of unit.members) {
          depths.set(
            member.id,
            (depths.get(member.id) ?? member.depth) + desired,
          );
        }
        groupShiftCount += 1;
      }
    }
  }

  const shiftedDepths = new Map<string, number>();
  for (const [id, depth] of depths) {
    if (depth !== clusterById.get(id)?.depth) {
      shiftedDepths.set(id, depth);
    }
  }
  if (shiftedDepths.size === 0) {
    return EMPTY_PACKED_DEPTH_SHIFTS;
  }

  for (const edge of prep.collapsedEdges) {
    const sourceDepth = depths.get(edge.source) ?? 0;
    const targetDepth = depths.get(edge.target) ?? 0;
    if (sourceDepth >= targetDepth) {
      return EMPTY_PACKED_DEPTH_SHIFTS;
    }
  }

  return {
    shiftedDepths,
    shiftCount: shiftedDepths.size,
    groupShiftCount,
  };
}

export function applyPackedDepthShifts(
  prep: PipelineLayoutPrep,
  shifts: PackedDepthShiftResult,
): PipelineLayoutPrep {
  if (shifts.shiftCount === 0) {
    return prep;
  }
  const clusters = prep.clusters.map((cluster) => {
    const depth = shifts.shiftedDepths.get(cluster.id);
    return depth == null ? cluster : { ...cluster, depth };
  });
  const maxDepth = Math.max(0, ...clusters.map((c) => c.depth));
  const depths = new Map(clusters.map((c) => [c.id, c.depth]));
  return {
    ...prep,
    clusters,
    maxDepth,
    columnX: computeGlobalColumnX(clusters, maxDepth),
    depthResult: { depths, hasCycle: prep.depthResult.hasCycle },
  };
}

type PackRole = "root" | "provider" | "account" | "region" | "vpc" | "lane";

type PackNode = {
  key: string;
  role: PackRole;
  /** Hull-frame inflation applied around this node's content. */
  pad: number;
  children: PackNode[];
  laneClusters?: PipelineCluster[];
  laneSkeleton?: ExcalidrawElementSkeleton[];
  laneBoxes?: Map<string, TerraformDependencyLayoutBox>;
  minDepth: number;
  minFirstSequence: number;
  /** Inflated rect; x fixed globally, height fixed, top assigned by packing. */
  x0: number;
  x1: number;
  height: number;
  /** Rect top offset relative to parent content origin. */
  localY: number;
};

function newPackNode(key: string, role: PackRole, pad: number): PackNode {
  return {
    key,
    role,
    pad,
    children: [],
    minDepth: Infinity,
    minFirstSequence: Infinity,
    x0: Infinity,
    x1: -Infinity,
    height: 0,
    localY: 0,
  };
}

function packSiblings(children: PackNode[]): number {
  const ordered = [...children].sort(
    (a, b) =>
      a.minDepth - b.minDepth ||
      a.minFirstSequence - b.minFirstSequence ||
      a.key.localeCompare(b.key),
  );
  const placed: PackNode[] = [];
  for (const child of ordered) {
    const candidates = [0];
    for (const other of placed) {
      candidates.push(other.localY + other.height + PIPELINE_LANE_GAP_Y);
    }
    candidates.sort((a, b) => a - b);
    let chosen = candidates[candidates.length - 1]!;
    for (const y of candidates) {
      let feasible = true;
      for (const other of placed) {
        const xClear =
          child.x1 + PACKED_HORIZONTAL_SHARE_CLEARANCE <= other.x0 ||
          other.x1 + PACKED_HORIZONTAL_SHARE_CLEARANCE <= child.x0;
        if (xClear) {
          continue;
        }
        const yClear =
          y + child.height + PIPELINE_LANE_GAP_Y <= other.localY ||
          other.localY + other.height + PIPELINE_LANE_GAP_Y <= y;
        if (!yClear) {
          feasible = false;
          break;
        }
      }
      if (feasible) {
        chosen = y;
        break;
      }
    }
    child.localY = chosen;
    placed.push(child);
  }
  let bottom = 0;
  for (const child of placed) {
    bottom = Math.max(bottom, child.localY + child.height);
  }
  return bottom;
}

function packNode(node: PackNode): void {
  if (node.children.length === 0) {
    return;
  }
  for (const child of node.children) {
    packNode(child);
    node.minDepth = Math.min(node.minDepth, child.minDepth);
    node.minFirstSequence = Math.min(
      node.minFirstSequence,
      child.minFirstSequence,
    );
  }
  const contentBottom = packSiblings(node.children);
  for (const child of node.children) {
    node.x0 = Math.min(node.x0, child.x0);
    node.x1 = Math.max(node.x1, child.x1);
  }
  node.x0 -= node.pad;
  node.x1 += node.pad;
  node.height = contentBottom + 2 * node.pad;
}

/**
 * Pass 2 — hierarchical Y re-packing. Lanes keep their classic intra-lane
 * placement and global column X; sibling boxes at every topology level are
 * packed bottom-up with a skyline scan so boxes whose inflated column spans
 * are horizontally disjoint share a Y band instead of stacking. Rects are
 * inflated by the hull-frame pad at each level that emits a frame, so the
 * frames drawn afterwards by `emitTopologyContextFrames` cannot overlap.
 */
export function placeClustersPackedGrid(prep: PipelineLayoutPrep): {
  skeleton: ExcalidrawElementSkeleton[];
  layoutBoxes: Map<string, TerraformDependencyLayoutBox>;
  laneEntries: [string, PipelineCluster[]][];
} {
  const lanes = new Map<string, PipelineCluster[]>();
  for (const cluster of prep.clusters) {
    const key = laneKey(cluster.placement);
    lanes.set(key, [...(lanes.get(key) ?? []), cluster]);
  }
  const laneEntries = [...lanes.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  const root = newPackNode("__root__", "root", 0);
  const nodesByKey = new Map<string, PackNode>();
  const ensureChild = (
    parent: PackNode,
    key: string,
    role: PackRole,
    pad: number,
  ): PackNode => {
    let node = nodesByKey.get(key);
    if (!node) {
      node = newPackNode(key, role, pad);
      nodesByKey.set(key, node);
      parent.children.push(node);
    }
    return node;
  };

  for (const [key, laneClusters] of laneEntries) {
    const sample = laneClusters[0]!;
    const provider = ensureChild(
      root,
      providerKeyOf(sample),
      "provider",
      PIPELINE_FRAME_PAD,
    );
    const account = ensureChild(
      provider,
      accountKeyOf(sample),
      "account",
      PIPELINE_FRAME_PAD,
    );
    const region = ensureChild(
      account,
      regionKeyOf(sample),
      "region",
      PIPELINE_FRAME_PAD,
    );
    const vpcKey = vpcKeyOf(sample);
    const laneParent = vpcKey
      ? ensureChild(region, vpcKey, "vpc", PIPELINE_FRAME_PAD)
      : region;
    const hasSubnetFrame =
      sample.placement.vpcId != null &&
      sample.placement.vpcId !== "" &&
      sample.placement.subnetSignature != null;
    const lane = ensureChild(
      laneParent,
      `lane:${key}`,
      "lane",
      hasSubnetFrame ? PIPELINE_FRAME_PAD : 0,
    );

    const laneLayout = layoutLaneClusters(
      laneClusters,
      prep.columnX,
      prep.maxDepth,
      0,
    );
    lane.laneClusters = laneClusters;
    lane.laneSkeleton = laneLayout.skeleton;
    lane.laneBoxes = laneLayout.layoutBoxes;
    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = 0;
    for (const box of laneLayout.layoutBoxes.values()) {
      minX = Math.min(minX, box.x);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    }
    lane.x0 = minX - lane.pad;
    lane.x1 = maxX + lane.pad;
    lane.height = maxY + 2 * lane.pad;
    for (const cluster of laneClusters) {
      lane.minDepth = Math.min(lane.minDepth, cluster.depth);
      lane.minFirstSequence = Math.min(
        lane.minFirstSequence,
        cluster.firstSequence,
      );
    }
  }

  packNode(root);

  const skeleton: ExcalidrawElementSkeleton[] = [];
  const layoutBoxes = new Map<string, TerraformDependencyLayoutBox>();
  const materialize = (node: PackNode, rectTop: number): void => {
    if (node.laneSkeleton && node.laneBoxes) {
      const dy = rectTop + node.pad;
      for (const el of node.laneSkeleton) {
        skeleton.push({
          ...el,
          y: (typeof el.y === "number" ? el.y : 0) + dy,
        });
      }
      for (const [id, box] of node.laneBoxes) {
        layoutBoxes.set(id, { ...box, y: box.y + dy });
      }
      return;
    }
    for (const child of node.children) {
      materialize(child, rectTop + node.pad + child.localY);
    }
  };
  materialize(root, PIPELINE_MARGIN);

  return { skeleton, layoutBoxes, laneEntries };
}
