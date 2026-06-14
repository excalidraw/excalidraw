import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import {
  buildTerraformResourceCardCustomData,
  shortTerraformResourceLabel,
  type TerraformDependencyLayoutBox,
} from "./terraformElkLayout";
import {
  isPrimaryVisibleResourceType,
  spreadClusterFrameColors,
} from "./terraformPrimaryVisibility";
import {
  getTerraformCardResourceType,
  getTerraformResourceShortDisplayName,
} from "./terraformResourceCardLabel";
import {
  DECLARED_DATAFLOW_ORDERED_KEY,
  type DeclaredDataFlowEdge,
} from "./terraformDeclaredDataFlow";
import { buildArnIndexForTopology } from "./terraformTopologyIamLinks";
import { filterPlanByProviderFamily } from "./terraformProviderClassification";
import { getTerraformImportPrepCache } from "./terraformImportPrepCache";
import {
  buildEnrichedTopologyPlacements,
  topologyAddressPlacementMap,
  type EnrichedTopologyPlacements,
  type TopologyAddressPlacement,
} from "./terraformTopologyPlacementBuild";
import {
  buildCompactPipelinePrimaryCluster,
  buildTopologyPrimaryClusterSkeletonForPipeline,
  type PipelinePrimaryClusterBuildResult,
} from "./terraformTopologyLayout";
import { resolveAlbCompanionParentLbAddressFromPlan } from "./terraformTopologyAlbLinks";
import { collectTopologySatelliteAddressesFromRegistry } from "./terraformTopologySatelliteRegistry";

import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

export type PipelinePlacement = TopologyAddressPlacement;

export type PipelineCluster = {
  id: string;
  primaryAddress: string;
  firstSequence: number;
  depth: number;
  placement: PipelinePlacement;
  build: PipelinePrimaryClusterBuildResult;
};

export type CollapsedPipelineEdge = {
  source: string;
  target: string;
  sequence: number;
  original: DeclaredDataFlowEdge;
};

export type PipelineLayoutPrep = {
  clusters: PipelineCluster[];
  collapsedEdges: CollapsedPipelineEdge[];
  maxDepth: number;
  columnX: number[];
  depthResult: { depths: Map<string, number>; hasCycle: boolean };
  /** satellite address -> owning primary address (all plan primaries). */
  satelliteOwners: ReadonlyMap<string, string>;
  /** Every plan address -> topology placement (unknown-* fallbacks included). */
  placementByAddress: ReadonlyMap<string, PipelinePlacement>;
};

export type AncillaryCard = {
  address: string;
  /** True placement incl. subnet info (kept on the card for expand-on-click). */
  placement: PipelinePlacement;
  build: PipelinePrimaryClusterBuildResult;
};

/**
 * One "Unconnected" strip of non-TFD resources, hosted at the bottom of its
 * deepest topology hull (VPC when the resources have a vpcId, else region).
 */
export type AncillaryStrip = {
  scopeRole: "vpc" | "region";
  scopeKey: string;
  /** Scope-level placement — subnet info dropped so no subnetZone frame forms. */
  placement: PipelinePlacement;
  stripFrameId: string;
  cards: AncillaryCard[];
};

export const PIPELINE_MARGIN = 50;
export const PIPELINE_FRAME_PAD = 28;
export const PIPELINE_COLUMN_GAP = 150;
export const PIPELINE_CLUSTER_GAP_Y = 36;
export const PIPELINE_LANE_GAP_Y = 96;
const FALLBACK_W = 220;
const FALLBACK_H = 96;

type ResourceChange = {
  address?: string;
  type?: string;
};

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

export function resourceTypeFor(
  nodes: TerraformPlanNodesMap,
  address: string,
): string {
  const node = nodes[address] as TerraformPlanGraphNode | undefined;
  return getTerraformCardResourceType(address, getPrimaryResource(node));
}

function providerFamilyForType(type: string): string {
  const i = type.indexOf("_");
  return i > 0 ? type.slice(0, i) : "terraform";
}

function planChanges(plan: unknown): ResourceChange[] {
  const changes = (plan as { resource_changes?: unknown[] })?.resource_changes;
  return Array.isArray(changes) ? (changes as ResourceChange[]) : [];
}

function buildSatelliteOwnerMap(
  nodes: TerraformPlanNodesMap,
  plan: unknown,
): Map<string, string> {
  const arnIndex = buildArnIndexForTopology(nodes);
  const primaryAddresses = Object.keys(nodes)
    .filter((key) => !key.startsWith("__"))
    .filter((addr) =>
      isPrimaryVisibleResourceType(resourceTypeFor(nodes, addr)),
    )
    .sort();
  const out = new Map<string, string>();

  for (const primaryAddress of primaryAddresses) {
    for (const sat of collectTopologySatelliteAddressesFromRegistry(
      nodes,
      arnIndex,
      [primaryAddress],
      plan,
    )) {
      if (!out.has(sat)) {
        out.set(sat, primaryAddress);
      }
    }
  }

  const changes = planChanges(plan);
  for (const rc of changes) {
    if (!rc.address) {
      continue;
    }
    const parent = resolveAlbCompanionParentLbAddressFromPlan(
      rc as any,
      changes as any,
    );
    if (parent) {
      out.set(rc.address, parent);
    }
  }
  return out;
}

function collapseEndpoint(
  nodes: TerraformPlanNodesMap,
  satelliteOwners: ReadonlyMap<string, string>,
  address: string,
): string {
  const owner = satelliteOwners.get(address);
  if (owner && nodes[owner]) {
    return owner;
  }
  const type = resourceTypeFor(nodes, address);
  if (isPrimaryVisibleResourceType(type)) {
    return address;
  }
  return address;
}

export function buildPlacementMap(
  nodes: TerraformPlanNodesMap,
  plan: unknown,
  enrichedOverride?: EnrichedTopologyPlacements,
): Map<string, PipelinePlacement> {
  const awsPlan = filterPlanByProviderFamily(plan as any, "aws");
  const cache = getTerraformImportPrepCache();
  let enriched = enrichedOverride ?? cache?.enrichedPlacements;
  if (!enriched) {
    enriched = buildEnrichedTopologyPlacements(awsPlan, nodes);
    if (cache) {
      cache.enrichedPlacements = enriched;
    }
  }
  const out = topologyAddressPlacementMap(enriched, awsPlan);

  for (const address of Object.keys(nodes)) {
    if (address.startsWith("__") || out.has(address)) {
      continue;
    }
    const type = resourceTypeFor(nodes, address);
    out.set(address, {
      providerFamily: providerFamilyForType(type),
      accountId: "unknown-account",
      region: "unknown-region",
      vpcId: null,
    });
  }
  return out;
}

export function pipelineFrameCustomData(
  role: string,
  p: PipelinePlacement,
  key: string,
  extras?: Record<string, unknown>,
) {
  return {
    terraform: true,
    terraformSemanticOverview: true,
    terraformPipelineView: true,
    terraformTopologyRole: role,
    terraformTopologyKey: key,
    terraformTopologyPath:
      role === "provider"
        ? [p.providerFamily]
        : role === "account"
        ? [p.providerFamily, p.accountId]
        : role === "region"
        ? [p.providerFamily, p.accountId, p.region]
        : role === "vpc"
        ? [p.providerFamily, p.accountId, p.region, p.vpcId]
        : [
            p.providerFamily,
            p.accountId,
            p.region,
            p.vpcId,
            p.subnetSignature,
          ].filter(Boolean),
    ...(p.subnetIds ? { terraformSubnetIds: p.subnetIds } : {}),
    ...(extras ?? {}),
  };
}

export function buildFallbackCluster(
  address: string,
  nodes: TerraformPlanNodesMap,
  plan: unknown,
  placement: PipelinePlacement,
): PipelinePrimaryClusterBuildResult {
  const frameId = `tf-pipeline:cluster:${encodeURIComponent(address)}`;
  const node = nodes[address] as TerraformPlanGraphNode | undefined;
  const resource = getPrimaryResource(node);
  const fallbackResourceType = resourceTypeFor(nodes, address);
  const fallbackSubtitle =
    getTerraformResourceShortDisplayName(fallbackResourceType);
  const skeleton: ExcalidrawElementSkeleton[] = [
    {
      type: "rectangle",
      id: address,
      x: 10,
      y: 10,
      width: FALLBACK_W,
      height: FALLBACK_H,
      strokeWidth: 1.5,
      strokeColor: "#64748b",
      backgroundColor: "#f8fafc",
      roundness: { type: 3, value: 8 },
      label: {
        text: `${shortTerraformResourceLabel(address)}\n${fallbackSubtitle}`,
        fontSize: 12,
        strokeColor: "#0f172a",
      },
      customData: {
        terraform: true,
        terraformSemanticOverview: true,
        terraformVisibilityRole: "resource",
        terraformVisibilityKey: address,
        terraformNodeKind: "resource",
        terraformInitiallyVisible: true,
        terraformSatelliteTier: 0,
        terraformExplodeParentKeys: [],
        terraformExplodeParent: null,
        terraformExpandAllView: false,
        ...buildTerraformResourceCardCustomData(address, resource, node, plan),
      },
    },
    {
      type: "frame",
      id: frameId,
      name: shortTerraformResourceLabel(address).slice(0, 48),
      x: 0,
      y: 0,
      width: FALLBACK_W + 20,
      height: FALLBACK_H + 20,
      ...spreadClusterFrameColors(fallbackResourceType),
      children: [address],
      customData: pipelineFrameCustomData(
        "primaryCluster",
        placement,
        frameId,
        {
          terraformPrimaryAddress: address,
        },
      ),
    },
  ];
  return {
    skeleton,
    width: FALLBACK_W + 20,
    height: FALLBACK_H + 20,
    clusterFrameId: frameId,
  };
}

export function computeDepths(
  clusterEdges: Array<{ source: string; target: string; sequence: number }>,
  clusterIds: readonly string[],
): { depths: Map<string, number>; hasCycle: boolean } {
  const indegree = new Map(clusterIds.map((id) => [id, 0]));
  const outgoing = new Map<
    string,
    Array<{ target: string; sequence: number }>
  >();
  for (const edge of clusterEdges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  const firstSeq = new Map<string, number>();
  for (const edge of clusterEdges) {
    firstSeq.set(
      edge.source,
      Math.min(firstSeq.get(edge.source) ?? edge.sequence, edge.sequence),
    );
    firstSeq.set(
      edge.target,
      Math.min(firstSeq.get(edge.target) ?? edge.sequence, edge.sequence),
    );
  }
  const ready = clusterIds
    .filter((id) => (indegree.get(id) ?? 0) === 0)
    .sort(
      (a, b) =>
        (firstSeq.get(a) ?? 0) - (firstSeq.get(b) ?? 0) || a.localeCompare(b),
    );
  const depths = new Map(clusterIds.map((id) => [id, 0]));
  let visited = 0;
  while (ready.length > 0) {
    const id = ready.shift()!;
    visited += 1;
    for (const edge of (outgoing.get(id) ?? []).sort(
      (a, b) => a.sequence - b.sequence,
    )) {
      depths.set(
        edge.target,
        Math.max(depths.get(edge.target) ?? 0, (depths.get(id) ?? 0) + 1),
      );
      const nextIn = (indegree.get(edge.target) ?? 0) - 1;
      indegree.set(edge.target, nextIn);
      if (nextIn === 0) {
        ready.push(edge.target);
        ready.sort(
          (a, b) =>
            (firstSeq.get(a) ?? 0) - (firstSeq.get(b) ?? 0) ||
            a.localeCompare(b),
        );
      }
    }
  }
  if (visited === clusterIds.length) {
    return { depths, hasCycle: false };
  }
  for (const id of clusterIds) {
    if ((indegree.get(id) ?? 0) > 0) {
      depths.set(id, firstSeq.get(id) ?? 0);
    }
  }
  return { depths, hasCycle: true };
}

/**
 * Experimental width-budgeted column assignment (Phase A).
 *
 * The pipeline's natural longest-path layering is ASAP — every cluster sits as
 * far LEFT as its TFD predecessors allow, which crowds early columns and crams
 * receivers next to their producers. Phase A instead pushes each cluster as far
 * RIGHT as it can go without crossing a successor (ALAP within its slack window),
 * so a chain spreads across columns and each cluster sits adjacent to the
 * consumers it feeds — the "push nodes deeper than they strictly need to be"
 * intuition that reads wider / flatter and keeps the left-to-right flow honest.
 *
 * `dL(v) = maxDepth − (longest path in edges from v to any sink)` is the latest
 * column `v` can occupy while every edge still satisfies `depth(src) < depth(tgt)`
 * — so the result is order-safe by construction. Deterministic: pure function of
 * the longest-path depths. Critical-path clusters (zero slack) do not move, so
 * `maxDepth` is preserved.
 */
export function computeWidthBudgetedDepths(
  collapsedEdges: readonly { source: string; target: string }[],
  clusters: readonly PipelineCluster[],
  longestPathDepths: ReadonlyMap<string, number>,
): Map<string, number> {
  const ids = clusters.map((c) => c.id);
  const d0 = new Map(ids.map((id) => [id, longestPathDepths.get(id) ?? 0]));
  if (ids.length === 0) {
    return d0;
  }
  const maxDepth = Math.max(0, ...d0.values());

  const succs = new Map<string, string[]>();
  for (const e of collapsedEdges) {
    succs.set(e.source, [...(succs.get(e.source) ?? []), e.target]);
  }

  // Longest path (in edges) from each node to a sink. Process in descending d0
  // order so every successor is resolved before the node itself (d0 is a valid
  // topological layering: d0(src) < d0(tgt)).
  const toSink = new Map<string, number>(ids.map((id) => [id, 0]));
  const byDepthDesc = [...ids].sort(
    (a, b) => d0.get(b)! - d0.get(a)! || a.localeCompare(b),
  );
  for (const id of byDepthDesc) {
    let best = 0;
    for (const s of succs.get(id) ?? []) {
      best = Math.max(best, 1 + (toSink.get(s) ?? 0));
    }
    toSink.set(id, best);
  }

  // Center each cluster within its order-safe slack window [d0, dL]. This
  // spreads chains rightward (wider/flatter than pure ASAP) without collapsing
  // them onto their successors the way pure ALAP does — which keeps edges short
  // and avoids the crossing blow-up ALAP causes. Zero-slack (critical-path)
  // clusters stay put, preserving maxDepth.
  const depths = new Map<string, number>();
  for (const id of ids) {
    const lo = d0.get(id)!;
    const hi = maxDepth - (toSink.get(id) ?? 0);
    depths.set(id, Math.round((lo + hi) / 2));
  }
  return depths;
}

export function laneKey(p: PipelinePlacement): string {
  return [
    p.providerFamily,
    p.accountId,
    p.region,
    p.vpcId ?? "",
    p.subnetSignature ?? "",
  ].join("\0");
}

export function providerScopeKey(p: PipelinePlacement): string {
  return p.providerFamily;
}

export function accountScopeKey(p: PipelinePlacement): string {
  return [p.providerFamily, p.accountId].join("\0");
}

export function regionScopeKey(p: PipelinePlacement): string {
  return [p.providerFamily, p.accountId, p.region].join("\0");
}

export function vpcScopeKey(p: PipelinePlacement): string | null {
  return p.vpcId
    ? [p.providerFamily, p.accountId, p.region, p.vpcId].join("\0")
    : null;
}

export function translateSkeleton(
  skeleton: ExcalidrawElementSkeleton[],
  dx: number,
  dy: number,
): ExcalidrawElementSkeleton[] {
  return skeleton.map((el) => ({
    ...el,
    x: (typeof el.x === "number" ? el.x : 0) + dx,
    y: (typeof el.y === "number" ? el.y : 0) + dy,
  }));
}

export function boundsOf(
  ids: readonly string[],
  boxes: ReadonlyMap<string, TerraformDependencyLayoutBox>,
) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of ids) {
    const b = boxes.get(id);
    if (!b) {
      continue;
    }
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  if (!Number.isFinite(minX)) {
    return null;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function computeGlobalColumnX(
  clusters: readonly PipelineCluster[],
  maxDepth: number,
  columnGap: number = PIPELINE_COLUMN_GAP,
): number[] {
  const columnWidths = Array.from({ length: maxDepth + 1 }, (_, depth) =>
    Math.max(
      260,
      ...clusters.filter((c) => c.depth === depth).map((c) => c.build.width),
    ),
  );
  const columnX: number[] = [];
  let x = PIPELINE_MARGIN + PIPELINE_FRAME_PAD * 5;
  for (let i = 0; i < columnWidths.length; i++) {
    columnX[i] = x;
    x += columnWidths[i]! + columnGap;
  }
  return columnX;
}

export function layoutLaneClusters(
  laneClusters: readonly PipelineCluster[],
  columnX: readonly number[],
  maxDepth: number,
  originY: number,
): {
  skeleton: ExcalidrawElementSkeleton[];
  layoutBoxes: Map<string, TerraformDependencyLayoutBox>;
  laneBottomY: number;
} {
  const colY = new Map<number, number>();
  for (let d = 0; d <= maxDepth; d++) {
    colY.set(d, originY);
  }
  const skeleton: ExcalidrawElementSkeleton[] = [];
  const layoutBoxes = new Map<string, TerraformDependencyLayoutBox>();
  const ordered = [...laneClusters].sort(
    (a, b) =>
      a.depth - b.depth ||
      a.firstSequence - b.firstSequence ||
      a.id.localeCompare(b.id),
  );
  for (const cluster of ordered) {
    const cx = columnX[cluster.depth]!;
    const cy = colY.get(cluster.depth)!;
    const translated = translateSkeleton(cluster.build.skeleton, cx, cy);
    skeleton.push(...translated);
    const frame = translated.find(
      (el) => el.id === cluster.build.clusterFrameId,
    );
    const frameBox = {
      x: typeof frame?.x === "number" ? frame.x : cx,
      y: typeof frame?.y === "number" ? frame.y : cy,
      width:
        typeof frame?.width === "number" ? frame.width : cluster.build.width,
      height:
        typeof frame?.height === "number" ? frame.height : cluster.build.height,
    };
    layoutBoxes.set(cluster.build.clusterFrameId, { ...frameBox });
    layoutBoxes.set(cluster.id, { ...frameBox });
    colY.set(
      cluster.depth,
      frameBox.y + frameBox.height + PIPELINE_CLUSTER_GAP_Y,
    );
  }
  const laneBottomY =
    Math.max(...Array.from(colY.values()), originY + 1) +
    PIPELINE_LANE_GAP_Y +
    PIPELINE_FRAME_PAD * 4;
  return { skeleton, layoutBoxes, laneBottomY };
}

export const ANCILLARY_STRIP_STROKE = "#94a3b8";
/** Default wrap for strips whose scope has no TFD lanes (~4 compact cards). */
export const ANCILLARY_DEFAULT_WRAP_WIDTH =
  4 * 276 + 3 * PIPELINE_CLUSTER_GAP_Y + 2 * PIPELINE_FRAME_PAD;

export function ancillaryStripFrameId(scopeKey: string): string {
  return `tf-pipeline:ancillaryStrip:${encodeURIComponent(scopeKey)}`;
}

function ancillaryStripRows(
  strip: AncillaryStrip,
  wrapWidth: number,
): {
  effectiveWrap: number;
  positions: { card: AncillaryCard; x: number; y: number }[];
  width: number;
  height: number;
} {
  const pad = PIPELINE_FRAME_PAD;
  const gap = PIPELINE_CLUSTER_GAP_Y;
  const maxCardWidth = Math.max(0, ...strip.cards.map((c) => c.build.width));
  const effectiveWrap = Math.max(wrapWidth, maxCardWidth + 2 * pad);
  const positions: { card: AncillaryCard; x: number; y: number }[] = [];
  let x = pad;
  let y = pad;
  let rowHeight = 0;
  let usedWidth = 0;
  for (const card of strip.cards) {
    if (x > pad && x + card.build.width > effectiveWrap - pad) {
      x = pad;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    positions.push({ card, x, y });
    usedWidth = Math.max(usedWidth, x + card.build.width);
    rowHeight = Math.max(rowHeight, card.build.height);
    x += card.build.width + gap;
  }
  return {
    effectiveWrap,
    positions,
    width: Math.min(effectiveWrap, usedWidth + pad),
    height: y + rowHeight + pad,
  };
}

/**
 * Wrapping flow grid of ancillary cluster cards inside a muted "Unconnected"
 * frame, built at origin. Rows wrap at the host scope's content width so the
 * strip grows the hull downward, not sideways (a single card wider than the
 * scope is the only case that can widen it).
 */
export function layoutAncillaryStrip(
  strip: AncillaryStrip,
  wrapWidth: number,
): {
  skeleton: ExcalidrawElementSkeleton[];
  width: number;
  height: number;
  boxes: Map<string, TerraformDependencyLayoutBox>;
} {
  const rows = ancillaryStripRows(strip, wrapWidth);
  const skeleton: ExcalidrawElementSkeleton[] = [];
  const boxes = new Map<string, TerraformDependencyLayoutBox>();
  for (const { card, x, y } of rows.positions) {
    skeleton.push(...translateSkeleton(card.build.skeleton, x, y));
    boxes.set(card.build.clusterFrameId, {
      x,
      y,
      width: card.build.width,
      height: card.build.height,
    });
  }
  skeleton.push({
    type: "frame",
    id: strip.stripFrameId,
    name: "Unconnected",
    x: 0,
    y: 0,
    width: rows.width,
    height: rows.height,
    strokeColor: ANCILLARY_STRIP_STROKE,
    backgroundColor: "transparent",
    children: strip.cards.map((c) => c.build.clusterFrameId),
    customData: pipelineFrameCustomData(
      "ancillaryStrip",
      strip.placement,
      strip.stripFrameId,
      { terraformPipelineAncillary: true },
    ),
  });
  boxes.set(strip.stripFrameId, {
    x: 0,
    y: 0,
    width: rows.width,
    height: rows.height,
  });
  return { skeleton, width: rows.width, height: rows.height, boxes };
}

/** Height/width-only mirror of `layoutAncillaryStrip` for packed measuring. */
export function measureAncillaryStrip(
  strip: AncillaryStrip,
  wrapWidth: number,
): { width: number; height: number } {
  const rows = ancillaryStripRows(strip, wrapWidth);
  return { width: rows.width, height: rows.height };
}

/**
 * Wrap a placed strip as a pseudo-cluster so `emitTopologyContextFrames`
 * hulls the strip frame into its vpc/region frame like any cluster frame.
 */
export function ancillaryStripAsPseudoCluster(
  strip: AncillaryStrip,
  placedBox: TerraformDependencyLayoutBox,
): PipelineCluster {
  const id = `__ancillary__:${strip.scopeKey}`;
  return {
    id,
    primaryAddress: id,
    firstSequence: Number.MAX_SAFE_INTEGER,
    depth: 0,
    placement: strip.placement,
    build: {
      skeleton: [],
      width: placedBox.width,
      height: placedBox.height,
      clusterFrameId: strip.stripFrameId,
    },
  };
}

export type PlaceClustersOptions = {
  /** Opt-in nesting-aware semantic placement (forced bands + straightening). */
  semanticPlacement?: boolean;
  /** Experimental view: width-budgeted columns (Phase A) + barycenter order (Phase B). */
  experimentalLayout?: boolean;
};

export function placeClustersClassicGrid(
  prep: PipelineLayoutPrep,
  ancillaryStrips?: readonly AncillaryStrip[],
  _options?: PlaceClustersOptions,
): {
  skeleton: ExcalidrawElementSkeleton[];
  layoutBoxes: Map<string, TerraformDependencyLayoutBox>;
  laneEntries: [string, PipelineCluster[]][];
  ancillaryClusters: PipelineCluster[];
} {
  const lanes = new Map<string, PipelineCluster[]>();
  for (const cluster of prep.clusters) {
    const key = laneKey(cluster.placement);
    lanes.set(key, [...(lanes.get(key) ?? []), cluster]);
  }
  const laneEntries = [...lanes.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const skeleton: ExcalidrawElementSkeleton[] = [];
  const layoutBoxes = new Map<string, TerraformDependencyLayoutBox>();
  const ancillaryClusters: PipelineCluster[] = [];

  const pendingStrips = new Map(
    (ancillaryStrips ?? []).map((strip) => [strip.scopeKey, strip]),
  );
  const scopeSpans = new Map<string, { minX: number; maxX: number }>();

  let laneY = PIPELINE_MARGIN + PIPELINE_FRAME_PAD * 5;

  // Strips are emitted at scope boundaries of the untouched lane order, so a
  // strip lands as the bottom band of its vpc/region hull and the no-strip
  // output stays byte-identical.
  const placeStrip = (scopeKey: string | null): void => {
    if (scopeKey == null) {
      return;
    }
    const strip = pendingStrips.get(scopeKey);
    if (!strip) {
      return;
    }
    pendingStrips.delete(scopeKey);
    const span = scopeSpans.get(scopeKey);
    const stripX = span ? span.minX : PIPELINE_MARGIN + PIPELINE_FRAME_PAD * 5;
    const wrapWidth = span
      ? span.maxX - span.minX
      : ANCILLARY_DEFAULT_WRAP_WIDTH;
    const laid = layoutAncillaryStrip(strip, wrapWidth);
    skeleton.push(...translateSkeleton(laid.skeleton, stripX, laneY));
    for (const [id, box] of laid.boxes) {
      layoutBoxes.set(id, { ...box, x: box.x + stripX, y: box.y + laneY });
    }
    ancillaryClusters.push(
      ancillaryStripAsPseudoCluster(
        strip,
        layoutBoxes.get(strip.stripFrameId)!,
      ),
    );
    laneY += laid.height + PIPELINE_LANE_GAP_Y + PIPELINE_FRAME_PAD * 4;
  };

  let currentVpcKey: string | null = null;
  let currentRegionKey: string | null = null;
  for (const [, laneClusters] of laneEntries) {
    const placement = laneClusters[0]!.placement;
    const vpcKey = vpcScopeKey(placement);
    const regionKey = regionScopeKey(placement);
    if (currentVpcKey !== vpcKey) {
      placeStrip(currentVpcKey);
    }
    if (currentRegionKey !== regionKey) {
      placeStrip(currentRegionKey);
    }
    currentVpcKey = vpcKey;
    currentRegionKey = regionKey;

    const laneLayout = layoutLaneClusters(
      laneClusters,
      prep.columnX,
      prep.maxDepth,
      laneY,
    );
    skeleton.push(...laneLayout.skeleton);
    for (const [id, box] of laneLayout.layoutBoxes) {
      layoutBoxes.set(id, box);
    }
    if (pendingStrips.size > 0) {
      for (const scopeKey of vpcKey ? [vpcKey, regionKey] : [regionKey]) {
        let span = scopeSpans.get(scopeKey);
        if (!span) {
          span = { minX: Infinity, maxX: -Infinity };
          scopeSpans.set(scopeKey, span);
        }
        for (const box of laneLayout.layoutBoxes.values()) {
          span.minX = Math.min(span.minX, box.x);
          span.maxX = Math.max(span.maxX, box.x + box.width);
        }
      }
    }
    laneY = laneLayout.laneBottomY;
  }
  placeStrip(currentVpcKey);
  placeStrip(currentRegionKey);
  for (const scopeKey of [...pendingStrips.keys()].sort((a, b) =>
    a.localeCompare(b),
  )) {
    placeStrip(scopeKey);
  }

  return { skeleton, layoutBoxes, laneEntries, ancillaryClusters };
}

export type PreparePipelineLayoutOptions = {
  /** Experimental Phase A: width-budgeted column assignment in place of longest-path. */
  experimentalLayout?: boolean;
};

export function preparePipelineLayout(
  nodes: TerraformPlanNodesMap,
  plan: unknown,
  compact: boolean,
  options?: PreparePipelineLayoutOptions,
): PipelineLayoutPrep {
  const declared = nodes[DECLARED_DATAFLOW_ORDERED_KEY];
  if (!Array.isArray(declared) || declared.length === 0) {
    throw new Error(
      "Pipeline view requires at least one resolved .tfd dataflow edge.",
    );
  }

  const satelliteOwners = buildSatelliteOwnerMap(nodes, plan);
  const placementByAddress = buildPlacementMap(nodes, plan);
  const firstSequence = new Map<string, number>();
  const collapsedEdges: CollapsedPipelineEdge[] = [];
  for (const edge of [...declared].sort((a, b) => a.sequence - b.sequence)) {
    const source = collapseEndpoint(nodes, satelliteOwners, edge.source);
    const target = collapseEndpoint(nodes, satelliteOwners, edge.target);
    firstSequence.set(
      source,
      Math.min(firstSequence.get(source) ?? edge.sequence, edge.sequence),
    );
    firstSequence.set(
      target,
      Math.min(firstSequence.get(target) ?? edge.sequence, edge.sequence),
    );
    if (source !== target) {
      collapsedEdges.push({
        source,
        target,
        sequence: edge.sequence,
        original: edge,
      });
    }
  }

  const clusterIds = [...firstSequence.keys()].sort(
    (a, b) =>
      (firstSequence.get(a) ?? 0) - (firstSequence.get(b) ?? 0) ||
      a.localeCompare(b),
  );
  const depthResult = computeDepths(collapsedEdges, clusterIds);

  const clusters: PipelineCluster[] = clusterIds.map((address) => {
    const placement = placementByAddress.get(address) ?? {
      providerFamily: providerFamilyForType(resourceTypeFor(nodes, address)),
      accountId: "unknown-account",
      region: "unknown-region",
      vpcId: null,
    };
    const clusterPlacement = {
      accountId: placement.accountId,
      region: placement.region,
      vpcId: placement.vpcId,
      subnetTier: placement.subnetTier,
      subnetSignature: placement.subnetSignature,
    };
    let build = compact
      ? buildCompactPipelinePrimaryCluster(
          address,
          nodes,
          plan,
          clusterPlacement,
        )
      : buildTopologyPrimaryClusterSkeletonForPipeline(
          address,
          nodes,
          plan,
          clusterPlacement,
        );
    if (build.skeleton.length === 0 || build.width <= 0 || build.height <= 0) {
      build = buildFallbackCluster(address, nodes, plan, placement);
    }
    return {
      id: address,
      primaryAddress: address,
      firstSequence: firstSequence.get(address) ?? 0,
      depth: depthResult.depths.get(address) ?? 0,
      placement,
      build,
    };
  });

  // Phase A (experimental): re-assign columns with a per-column height budget so
  // tall TFD columns spill deeper and the scene reads wider/flatter. Needs the
  // built cluster heights, so it runs after the cluster map. Order-safe by
  // construction, with a verify-or-abort guard that falls back to longest-path.
  let effectiveDepthResult = depthResult;
  if (options?.experimentalLayout && !depthResult.hasCycle) {
    const budgeted = computeWidthBudgetedDepths(
      collapsedEdges,
      clusters,
      depthResult.depths,
    );
    const valid = collapsedEdges.every(
      (edge) =>
        (budgeted.get(edge.source) ?? 0) < (budgeted.get(edge.target) ?? 0),
    );
    if (valid) {
      for (const cluster of clusters) {
        cluster.depth = budgeted.get(cluster.id) ?? cluster.depth;
      }
      effectiveDepthResult = { depths: budgeted, hasCycle: false };
    }
  }

  const maxDepth = Math.max(0, ...clusters.map((c) => c.depth));
  const columnX = computeGlobalColumnX(clusters, maxDepth);

  return {
    clusters,
    collapsedEdges,
    maxDepth,
    columnX,
    depthResult: effectiveDepthResult,
    satelliteOwners,
    placementByAddress,
  };
}
