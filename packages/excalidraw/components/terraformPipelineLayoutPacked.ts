import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import {
  accountScopeKey,
  ancillaryStripAsPseudoCluster,
  computeGlobalColumnX,
  laneKey,
  layoutAncillaryStrip,
  layoutLaneClusters,
  measureAncillaryStrip,
  providerScopeKey,
  regionScopeKey,
  translateSkeleton,
  vpcScopeKey,
  ANCILLARY_DEFAULT_WRAP_WIDTH,
  PIPELINE_CLUSTER_GAP_Y,
  PIPELINE_FRAME_PAD,
  PIPELINE_LANE_GAP_Y,
  PIPELINE_MARGIN,
  type AncillaryStrip,
  type PipelineCluster,
  type PipelineLayoutPrep,
  type PipelinePlacement,
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
 * Pushing a unit past a wide sibling predecessor may need columns well beyond
 * the unshifted maxDepth, and fine-level shifts consume room before coarse
 * region/account shifts run. The allowance can be generous because used
 * depths are compacted to contiguous columns afterwards, so intermediate
 * spread does not translate into empty-column width.
 */
const packedMaxAllowedDepth = (maxDepth: number): number => maxDepth * 2 + 4;

/**
 * Two sibling boxes may share a Y band only when their inflated rects are
 * separated horizontally by at least this much, so emitted hull frames keep
 * visible daylight between them.
 */
const PACKED_HORIZONTAL_SHARE_CLEARANCE = PIPELINE_FRAME_PAD;

function providerKeyOf(c: PipelineCluster): string {
  return providerScopeKey(c.placement);
}

function accountKeyOf(c: PipelineCluster): string {
  return accountScopeKey(c.placement);
}

function regionKeyOf(c: PipelineCluster): string {
  return regionScopeKey(c.placement);
}

function vpcKeyOf(c: PipelineCluster): string | null {
  return vpcScopeKey(c.placement);
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

/** Max relaxation sweeps per level; intervals stabilize fast in practice. */
const PACKED_LEVEL_SWEEPS = 3;

/** Closure size guard for joint shifts across zero-slack chains. */
const PACKED_MAX_CLOSURE_UNITS = 8;

/**
 * Pass 1 — group-uniform rightward depth shifts (ALAP bounded by outgoing
 * edges). A unit with sibling predecessors (TFD edges arriving from a sibling
 * unit under the same topology parent) is pushed just past all of those
 * siblings' columns so pass 2 can place it beside them instead of below.
 * Incoming edges only gain margin; intra-unit edges shift uniformly; external
 * outgoing edges bound the shift, so `A -> B ⇒ depth(A) < depth(B)` is
 * preserved by construction.
 *
 * Levels run bottom-up (lanes → VPCs → regions → accounts) so a unit's
 * interval is final before its siblings react to it; a coarser shift moves
 * subtrees uniformly and never reshuffles finer levels. When a unit cannot
 * move because an outgoing edge has no slack (e.g. API hops ping-ponging
 * between two accounts in the same region), the target's unit is pulled into
 * a closure and the whole closure shifts together.
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
  const maxAllowedDepth = packedMaxAllowedDepth(prep.maxDepth);
  let groupShiftCount = 0;

  for (const level of [...PACKED_SHIFT_LEVELS].reverse()) {
    const unitByKey = new Map<string, PackedShiftUnit>();
    const unitKeyById = new Map<string, string>();
    const unitKeysByParent = new Map<string, string[]>();
    for (const cluster of prep.clusters) {
      const parentKey = level.parentOf(cluster);
      if (parentKey == null) {
        continue;
      }
      const unitKey = level.unitOf(cluster);
      let unit = unitByKey.get(unitKey);
      if (!unit) {
        unit = { key: unitKey, members: [], minFirstSequence: Infinity };
        unitByKey.set(unitKey, unit);
        unitKeysByParent.set(parentKey, [
          ...(unitKeysByParent.get(parentKey) ?? []),
          unitKey,
        ]);
      }
      unit.members.push(cluster);
      unit.minFirstSequence = Math.min(
        unit.minFirstSequence,
        cluster.firstSequence,
      );
      unitKeyById.set(cluster.id, unitKey);
    }

    for (let sweep = 0; sweep < PACKED_LEVEL_SWEEPS; sweep++) {
      let changed = false;
      for (const [, unitKeys] of [...unitKeysByParent.entries()].sort(
        ([a], [b]) => a.localeCompare(b),
      )) {
        if (unitKeys.length < 2) {
          continue;
        }
        const siblings = new Set(unitKeys);
        const ordered = [...unitKeys]
          .map((key) => unitByKey.get(key)!)
          .sort(
            (a, b) =>
              unitInterval(a, depths).min - unitInterval(b, depths).min ||
              a.minFirstSequence - b.minFirstSequence ||
              a.key.localeCompare(b.key),
          );

        for (const unit of ordered) {
          const memberIds = new Set(unit.members.map((m) => m.id));
          const predecessorSiblings = new Set<string>();
          for (const edge of prep.collapsedEdges) {
            if (memberIds.has(edge.target) && !memberIds.has(edge.source)) {
              const sourceUnitKey = unitKeyById.get(edge.source);
              if (
                sourceUnitKey != null &&
                sourceUnitKey !== unit.key &&
                siblings.has(sourceUnitKey)
              ) {
                predecessorSiblings.add(sourceUnitKey);
              }
            }
          }
          if (predecessorSiblings.size === 0) {
            continue;
          }
          const interval = unitInterval(unit, depths);
          let pastAllPredecessors = -Infinity;
          for (const siblingKey of predecessorSiblings) {
            pastAllPredecessors = Math.max(
              pastAllPredecessors,
              unitInterval(unitByKey.get(siblingKey)!, depths).max + 1,
            );
          }
          const desired = pastAllPredecessors - interval.min;
          if (desired <= 0) {
            continue;
          }

          // Grow a closure over outgoing edges that lack slack for the shift;
          // the closure moves as one block so those edges keep their length.
          const closure = new Set<string>([unit.key]);
          const closureMemberIds = new Set<string>(memberIds);
          let feasible = true;
          let expanded = true;
          while (feasible && expanded) {
            expanded = false;
            for (const edge of prep.collapsedEdges) {
              if (
                !closureMemberIds.has(edge.source) ||
                closureMemberIds.has(edge.target)
              ) {
                continue;
              }
              const slack =
                (depths.get(edge.target) ?? 0) -
                (depths.get(edge.source) ?? 0) -
                1;
              if (slack >= desired) {
                continue;
              }
              const targetUnitKey = unitKeyById.get(edge.target);
              if (
                targetUnitKey == null ||
                predecessorSiblings.has(targetUnitKey) ||
                closure.size >= PACKED_MAX_CLOSURE_UNITS
              ) {
                feasible = false;
                break;
              }
              closure.add(targetUnitKey);
              for (const member of unitByKey.get(targetUnitKey)!.members) {
                closureMemberIds.add(member.id);
              }
              expanded = true;
            }
          }
          if (!feasible) {
            continue;
          }
          let maxClosureDepth = -Infinity;
          for (const id of closureMemberIds) {
            maxClosureDepth = Math.max(maxClosureDepth, depths.get(id) ?? 0);
          }
          if (maxClosureDepth + desired > maxAllowedDepth) {
            continue;
          }
          for (const id of closureMemberIds) {
            depths.set(id, (depths.get(id) ?? 0) + desired);
          }
          groupShiftCount += 1;
          changed = true;
        }
      }
      if (!changed) {
        break;
      }
    }
  }

  // Compact used depths to contiguous column indices; shifts leave hollow
  // columns behind and every empty column would otherwise cost full width.
  const usedDepths = [...new Set(depths.values())].sort((a, b) => a - b);
  const depthRemap = new Map(usedDepths.map((depth, index) => [depth, index]));
  for (const [id, depth] of depths) {
    depths.set(id, depthRemap.get(depth)!);
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

/**
 * Packed scenes use a wider column gap so two region-deep hull stacks
 * (subnet + vpc + region pad on each side, plus share clearance) fit between
 * adjacent columns — otherwise sibling regions can never share a Y band.
 */
export const PACKED_COLUMN_GAP =
  2 * 3 * PIPELINE_FRAME_PAD + PACKED_HORIZONTAL_SHARE_CLEARANCE;

export function applyPackedDepthShifts(
  prep: PipelineLayoutPrep,
  shifts: PackedDepthShiftResult,
): PipelineLayoutPrep {
  const clusters =
    shifts.shiftCount === 0
      ? prep.clusters
      : prep.clusters.map((cluster) => {
          const depth = shifts.shiftedDepths.get(cluster.id);
          return depth == null ? cluster : { ...cluster, depth };
        });
  const maxDepth = Math.max(0, ...clusters.map((c) => c.depth));
  const depths = new Map(clusters.map((c) => [c.id, c.depth]));
  return {
    ...prep,
    clusters,
    maxDepth,
    columnX: computeGlobalColumnX(clusters, maxDepth, PACKED_COLUMN_GAP),
    depthResult: { depths, hasCycle: prep.depthResult.hasCycle },
  };
}

type PackRole =
  | "root"
  | "provider"
  | "account"
  | "region"
  | "vpc"
  | "lane"
  | "ancillaryStrip";

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

function groupClustersIntoLanes(
  clusters: readonly PipelineCluster[],
): [string, PipelineCluster[]][] {
  const lanes = new Map<string, PipelineCluster[]>();
  for (const cluster of clusters) {
    const key = laneKey(cluster.placement);
    lanes.set(key, [...(lanes.get(key) ?? []), cluster]);
  }
  return [...lanes.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function ensurePackChild(
  nodesByKey: Map<string, PackNode>,
  parent: PackNode,
  childKey: string,
  role: PackRole,
  pad: number,
): PackNode {
  let node = nodesByKey.get(childKey);
  if (!node) {
    node = newPackNode(childKey, role, pad);
    nodesByKey.set(childKey, node);
    parent.children.push(node);
  }
  return node;
}

/** Ensure the provider→account→region(→vpc) chain for a placement. */
function ensureScopeChain(
  root: PackNode,
  nodesByKey: Map<string, PackNode>,
  placement: PipelinePlacement,
): { region: PackNode; vpc: PackNode | null } {
  const provider = ensurePackChild(
    nodesByKey,
    root,
    providerScopeKey(placement),
    "provider",
    PIPELINE_FRAME_PAD,
  );
  const account = ensurePackChild(
    nodesByKey,
    provider,
    accountScopeKey(placement),
    "account",
    PIPELINE_FRAME_PAD,
  );
  const region = ensurePackChild(
    nodesByKey,
    account,
    regionScopeKey(placement),
    "region",
    PIPELINE_FRAME_PAD,
  );
  const vKey = vpcScopeKey(placement);
  const vpc = vKey
    ? ensurePackChild(nodesByKey, region, vKey, "vpc", PIPELINE_FRAME_PAD)
    : null;
  return { region, vpc };
}

/** Insert the provider→account→region→vpc→lane chain for one lane key. */
function insertLanePackNode(
  root: PackNode,
  nodesByKey: Map<string, PackNode>,
  key: string,
  sample: PipelineCluster,
): PackNode {
  const { region, vpc } = ensureScopeChain(root, nodesByKey, sample.placement);
  const laneParent = vpc ?? region;
  const hasSubnetFrame =
    sample.placement.vpcId != null &&
    sample.placement.vpcId !== "" &&
    sample.placement.subnetSignature != null;
  return ensurePackChild(
    nodesByKey,
    laneParent,
    `lane:${key}`,
    "lane",
    hasSubnetFrame ? PIPELINE_FRAME_PAD : 0,
  );
}

/** Min/max X over a pack subtree's already-sized leaves (lanes, strips). */
function packSubtreeLeafSpan(
  node: PackNode,
): { x0: number; x1: number } | null {
  let x0 = Infinity;
  let x1 = -Infinity;
  const visit = (n: PackNode): void => {
    if (n.children.length === 0) {
      if (Number.isFinite(n.x0)) {
        x0 = Math.min(x0, n.x0);
        x1 = Math.max(x1, n.x1);
      }
      return;
    }
    for (const child of n.children) {
      visit(child);
    }
  };
  visit(node);
  return Number.isFinite(x0) ? { x0, x1 } : null;
}

/**
 * Attach ancillary strips as extra pack-node children of their vpc/region
 * scope node, sized to the scope's current lane span. `minDepth: Infinity`
 * makes `packSiblings` place a strip last, and the overlapping X span forces
 * it below the scope's lanes — bottom of the hull, overlap-free. VPC strips
 * attach before region strips so a region strip spans its vpc strips too.
 * The node key set depends only on scope membership (never depths), keeping
 * pull-left's per-node baseline comparison sound.
 */
function attachAncillaryStripNodes(
  root: PackNode,
  nodesByKey: Map<string, PackNode>,
  ancillaryStrips: readonly AncillaryStrip[],
  sizeStrip: (
    node: PackNode,
    strip: AncillaryStrip,
    stripX: number,
    wrapWidth: number,
  ) => void,
): void {
  const ordered = [...ancillaryStrips].sort(
    (a, b) =>
      (a.scopeRole === "vpc" ? 0 : 1) - (b.scopeRole === "vpc" ? 0 : 1) ||
      a.scopeKey.localeCompare(b.scopeKey),
  );
  for (const strip of ordered) {
    const { region, vpc } = ensureScopeChain(root, nodesByKey, strip.placement);
    const parent = strip.scopeRole === "vpc" ? vpc ?? region : region;
    const span = packSubtreeLeafSpan(parent);
    const stripX = span ? span.x0 : PIPELINE_MARGIN + PIPELINE_FRAME_PAD * 5;
    const wrapWidth = span ? span.x1 - span.x0 : ANCILLARY_DEFAULT_WRAP_WIDTH;
    const node = newPackNode(strip.stripFrameId, "ancillaryStrip", 0);
    sizeStrip(node, strip, stripX, wrapWidth);
    nodesByKey.set(strip.stripFrameId, node);
    parent.children.push(node);
  }
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
export function placeClustersPackedGrid(
  prep: PipelineLayoutPrep,
  ancillaryStrips?: readonly AncillaryStrip[],
): {
  skeleton: ExcalidrawElementSkeleton[];
  layoutBoxes: Map<string, TerraformDependencyLayoutBox>;
  laneEntries: [string, PipelineCluster[]][];
  ancillaryClusters: PipelineCluster[];
} {
  const laneEntries = groupClustersIntoLanes(prep.clusters);

  const root = newPackNode("__root__", "root", 0);
  const nodesByKey = new Map<string, PackNode>();

  for (const [key, laneClusters] of laneEntries) {
    const lane = insertLanePackNode(root, nodesByKey, key, laneClusters[0]!);

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

  if (ancillaryStrips && ancillaryStrips.length > 0) {
    attachAncillaryStripNodes(
      root,
      nodesByKey,
      ancillaryStrips,
      (node, strip, stripX, wrapWidth) => {
        const laid = layoutAncillaryStrip(strip, wrapWidth);
        node.laneSkeleton = translateSkeleton(laid.skeleton, stripX, 0);
        node.laneBoxes = new Map(
          [...laid.boxes].map(([id, box]) => [
            id,
            { ...box, x: box.x + stripX },
          ]),
        );
        node.x0 = stripX;
        node.x1 = stripX + laid.width;
        node.height = laid.height;
      },
    );
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

  const ancillaryClusters = (ancillaryStrips ?? []).map((strip) =>
    ancillaryStripAsPseudoCluster(strip, layoutBoxes.get(strip.stripFrameId)!),
  );

  return { skeleton, layoutBoxes, laneEntries, ancillaryClusters };
}

export type PackedPullLeftResult = {
  /** clusterId -> new depth, only for clusters whose depth changed. */
  shiftedDepths: Map<string, number>;
  pullCount: number;
  evalCapReached: boolean;
};

export const EMPTY_PACKED_PULL_LEFT_SHIFTS: PackedPullLeftResult = {
  shiftedDepths: new Map(),
  pullCount: 0,
  evalCapReached: false,
};

/** Feasibility re-sweeps; bound cascades already converge within one sweep. */
const PACKED_PULL_LEFT_SWEEPS = 4;

/**
 * Floor for the measure-evaluation budget. The effective budget scales with
 * clusterCount × columnCount so deep pull cascades are not truncated on large
 * presets; hitting the cap is reported via meta rather than failing silently.
 */
const PACKED_PULL_LEFT_MIN_EVAL_BUDGET = 2000;

type PackedSceneMeasure = {
  width: number;
  height: number;
  /** Inflated height per pack node (lane/vpc/region/account/provider/root). */
  nodeHeights: Map<string, number>;
};

/**
 * Measure the packed scene for a candidate depth assignment without
 * materializing skeletons. Mirrors `layoutLaneClusters` per-column cursor
 * math and the `placeClustersPackedGrid` pack tree exactly; candidate depths
 * are compacted to contiguous columns first, like the shift passes. Per-node
 * heights are reported so callers can detect local regressions: the node set
 * depends only on lane membership (`laneKey`), never on depths, so candidate
 * and baseline measures always cover identical keys.
 */
function measurePackedSceneForDepths(
  prep: PipelineLayoutPrep,
  depths: ReadonlyMap<string, number>,
  ancillaryStrips?: readonly AncillaryStrip[],
): PackedSceneMeasure {
  const usedDepths = [...new Set(depths.values())].sort((a, b) => a - b);
  const depthRemap = new Map(usedDepths.map((depth, index) => [depth, index]));
  const depthOf = (c: PipelineCluster): number =>
    depthRemap.get(depths.get(c.id) ?? c.depth) ?? 0;
  const maxDepth = usedDepths.length - 1;

  const columnWidths = Array.from({ length: maxDepth + 1 }, () => 260);
  for (const cluster of prep.clusters) {
    const d = depthOf(cluster);
    columnWidths[d] = Math.max(columnWidths[d]!, cluster.build.width);
  }
  const columnX: number[] = [];
  let x = PIPELINE_MARGIN + PIPELINE_FRAME_PAD * 5;
  for (let i = 0; i <= maxDepth; i++) {
    columnX[i] = x;
    x += columnWidths[i]! + PACKED_COLUMN_GAP;
  }

  const root = newPackNode("__root__", "root", 0);
  const nodesByKey = new Map<string, PackNode>();
  for (const [key, laneClusters] of groupClustersIntoLanes(prep.clusters)) {
    const lane = insertLanePackNode(root, nodesByKey, key, laneClusters[0]!);
    const colY = new Map<number, number>();
    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = 0;
    const ordered = [...laneClusters].sort(
      (a, b) =>
        depthOf(a) - depthOf(b) ||
        a.firstSequence - b.firstSequence ||
        a.id.localeCompare(b.id),
    );
    for (const cluster of ordered) {
      const d = depthOf(cluster);
      const cx = columnX[d]!;
      const cy = colY.get(d) ?? 0;
      minX = Math.min(minX, cx);
      maxX = Math.max(maxX, cx + cluster.build.width);
      maxY = Math.max(maxY, cy + cluster.build.height);
      colY.set(d, cy + cluster.build.height + PIPELINE_CLUSTER_GAP_Y);
      lane.minDepth = Math.min(lane.minDepth, d);
      lane.minFirstSequence = Math.min(
        lane.minFirstSequence,
        cluster.firstSequence,
      );
    }
    lane.x0 = minX - lane.pad;
    lane.x1 = maxX + lane.pad;
    lane.height = maxY + 2 * lane.pad;
  }
  if (ancillaryStrips && ancillaryStrips.length > 0) {
    attachAncillaryStripNodes(
      root,
      nodesByKey,
      ancillaryStrips,
      (node, strip, stripX, wrapWidth) => {
        const measured = measureAncillaryStrip(strip, wrapWidth);
        node.x0 = stripX;
        node.x1 = stripX + measured.width;
        node.height = measured.height;
      },
    );
  }
  packNode(root);
  const nodeHeights = new Map<string, number>([[root.key, root.height]]);
  for (const node of nodesByKey.values()) {
    nodeHeights.set(node.key, node.height);
  }
  return { width: root.x1 - root.x0, height: root.height, nodeHeights };
}

/**
 * Never-regress acceptance for a pull candidate. The height check is
 * hierarchical — every pack node, not just the root — because a root-only
 * guard lets local regressions hide inside band slack: a region whose
 * sibling pins the account band can double in height (receiver lanes pulled
 * back over their sibling lanes' spans and stacked) without moving the
 * global bounds at all.
 */
function fitsWithinBaseline(
  measured: PackedSceneMeasure,
  baseline: PackedSceneMeasure,
): boolean {
  if (measured.width > baseline.width) {
    return false;
  }
  for (const [key, height] of measured.nodeHeights) {
    const baselineHeight = baseline.nodeHeights.get(key);
    if (baselineHeight == null || height > baselineHeight) {
      return false;
    }
  }
  return true;
}

/**
 * Pass 1.5 (opt-in) — per-cluster leftward compaction after the group-uniform
 * depth shifts. Group shifts move whole units, so members whose own TFD
 * predecessors are shallow end up far right of their lower bound
 * (`max(depth(pred)) + 1`). This pass greedily pulls each such cluster to its
 * leftmost feasible column: a pull is kept only if the re-measured packed
 * scene does not grow in global width and **no pack node grows in height**
 * (see `fitsWithinBaseline`), which protects the side-by-side banding the
 * group shifts bought at every topology level (pulling a receiver lane back
 * over its sibling's span would stack them and grow their region, even when
 * the global bounds — pinned by some other band — would not move).
 *
 * Sweeps visit clusters in ascending depth with bounds computed at visit
 * time, so pulls cascade through chains and fan-outs within one sweep;
 * additional sweeps only catch pulls that become feasible after earlier
 * accepts free space. `A -> B ⇒ depth(A) < depth(B)` holds by construction
 * and is re-verified before returning.
 */
export function computePackedPullLeftShifts(
  prep: PipelineLayoutPrep,
  ancillaryStrips?: readonly AncillaryStrip[],
): PackedPullLeftResult {
  if (prep.depthResult.hasCycle || prep.clusters.length === 0) {
    return EMPTY_PACKED_PULL_LEFT_SHIFTS;
  }

  const depths = new Map(prep.clusters.map((c) => [c.id, c.depth]));
  const predsByTarget = new Map<string, string[]>();
  for (const edge of prep.collapsedEdges) {
    predsByTarget.set(edge.target, [
      ...(predsByTarget.get(edge.target) ?? []),
      edge.source,
    ]);
  }
  const boundOf = (id: string): number => {
    let bound = 0;
    for (const pred of predsByTarget.get(id) ?? []) {
      bound = Math.max(bound, (depths.get(pred) ?? 0) + 1);
    }
    return bound;
  };

  const evalBudget = Math.max(
    PACKED_PULL_LEFT_MIN_EVAL_BUDGET,
    prep.clusters.length * (prep.maxDepth + 1) * 2,
  );
  let evals = 0;
  let evalCapReached = false;
  let baseline = measurePackedSceneForDepths(prep, depths, ancillaryStrips);
  let pullCount = 0;

  for (let sweep = 0; sweep < PACKED_PULL_LEFT_SWEEPS; sweep++) {
    let accepted = false;
    const ordered = [...prep.clusters].sort(
      (a, b) =>
        (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0) ||
        a.firstSequence - b.firstSequence ||
        a.id.localeCompare(b.id),
    );
    for (const cluster of ordered) {
      const current = depths.get(cluster.id) ?? 0;
      const bound = boundOf(cluster.id);
      // Scan leftmost-first so the cluster lands as far left as feasible.
      for (let candidate = bound; candidate < current; candidate++) {
        if (evals >= evalBudget) {
          evalCapReached = true;
          break;
        }
        const trial = new Map(depths);
        trial.set(cluster.id, candidate);
        evals += 1;
        const measured = measurePackedSceneForDepths(
          prep,
          trial,
          ancillaryStrips,
        );
        if (fitsWithinBaseline(measured, baseline)) {
          depths.set(cluster.id, candidate);
          baseline = measured;
          pullCount += 1;
          accepted = true;
          break;
        }
      }
      if (evalCapReached) {
        break;
      }
    }
    if (!accepted || evalCapReached) {
      break;
    }
  }

  if (pullCount === 0) {
    return { ...EMPTY_PACKED_PULL_LEFT_SHIFTS, evalCapReached };
  }

  // Compact used depths to contiguous columns (pulls can empty columns).
  const usedDepths = [...new Set(depths.values())].sort((a, b) => a - b);
  const depthRemap = new Map(usedDepths.map((depth, index) => [depth, index]));
  for (const [id, depth] of depths) {
    depths.set(id, depthRemap.get(depth)!);
  }

  const shiftedDepths = new Map<string, number>();
  for (const cluster of prep.clusters) {
    const depth = depths.get(cluster.id)!;
    if (depth !== cluster.depth) {
      shiftedDepths.set(cluster.id, depth);
    }
  }
  if (shiftedDepths.size === 0) {
    return { ...EMPTY_PACKED_PULL_LEFT_SHIFTS, evalCapReached };
  }
  for (const edge of prep.collapsedEdges) {
    if ((depths.get(edge.source) ?? 0) >= (depths.get(edge.target) ?? 0)) {
      return { ...EMPTY_PACKED_PULL_LEFT_SHIFTS, evalCapReached };
    }
  }

  return { shiftedDepths, pullCount, evalCapReached };
}

/** Adapt a pull-left result for `applyPackedDepthShifts`. */
export function pullLeftShiftsAsDepthShifts(
  pull: PackedPullLeftResult,
): PackedDepthShiftResult {
  return {
    shiftedDepths: pull.shiftedDepths,
    shiftCount: pull.shiftedDepths.size,
    groupShiftCount: 0,
  };
}
