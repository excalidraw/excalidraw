import { convertToExcalidrawElements } from "@excalidraw/element";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  buildTerraformDeclaredDataFlowLineSkeletons,
  buildTerraformResourceCardCustomData,
  mirrorAndDetachTerraformResourceLabels,
  shortTerraformResourceLabel,
  type TerraformDependencyLayoutBox,
} from "./terraformElkLayout";
import { collectDeclaredDataFlowEdges } from "./terraformExplodeGraph";
import {
  isPrimaryVisibleResourceType,
  spreadClusterFrameColors,
  spreadContextFrameColors,
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
  reorderTopologyElementsZStack,
  type PipelinePrimaryClusterBuildResult,
} from "./terraformTopologyLayout";
import { resolveAlbCompanionParentLbAddressFromPlan } from "./terraformTopologyAlbLinks";
import { collectTopologySatelliteAddressesFromRegistry } from "./terraformTopologySatelliteRegistry";
import {
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
  TERRAFORM_IMPORT_EDGE_LAYER_PINS,
} from "./terraformVisibility";
import { injectTerraformAwsIconsIntoElements } from "./terraformAwsIcons";

import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";
import type { TerraformImportWarning } from "./terraformImportMerge";

type ResourceChange = {
  address?: string;
  type?: string;
};

type PipelinePlacement = TopologyAddressPlacement;

type PipelineCluster = {
  id: string;
  primaryAddress: string;
  firstSequence: number;
  depth: number;
  placement: PipelinePlacement;
  build: PipelinePrimaryClusterBuildResult;
};

const MARGIN = 50;
const FRAME_PAD = 28;
const COLUMN_GAP = 150;
const CLUSTER_GAP_Y = 36;
const LANE_GAP_Y = 96;
const FALLBACK_W = 220;
const FALLBACK_H = 96;

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

function resourceTypeFor(
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

function buildPlacementMap(
  nodes: TerraformPlanNodesMap,
  plan: unknown,
  enrichedOverride?: EnrichedTopologyPlacements,
): Map<string, PipelinePlacement> {
  const awsPlan = filterPlanByProviderFamily(plan as any, "aws");
  const cache = getTerraformImportPrepCache();
  let enriched = enrichedOverride ?? cache?.enrichedPlacements;
  if (!enriched) {
    enriched = buildEnrichedTopologyPlacements(awsPlan, nodes);
    // Memoize back so a semantic→pipeline switch (same prep fingerprint) reuses it.
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

function buildFallbackCluster(
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

function computeDepths(
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

function laneKey(p: PipelinePlacement): string {
  return [
    p.providerFamily,
    p.accountId,
    p.region,
    p.vpcId ?? "",
    p.subnetSignature ?? "",
  ].join("\0");
}

function translateSkeleton(
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

function boundsOf(
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

function pipelineFrameCustomData(
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

function pushContextFrames(
  skeleton: ExcalidrawElementSkeleton[],
  clusters: readonly PipelineCluster[],
  boxes: Map<string, TerraformDependencyLayoutBox>,
) {
  const levels: Array<{
    role: "subnetZone" | "vpc" | "region" | "account" | "provider";
    keyOf: (c: PipelineCluster) => string | null;
  }> = [
    {
      role: "subnetZone",
      keyOf: (c) =>
        c.placement.vpcId && c.placement.subnetSignature != null
          ? laneKey(c.placement)
          : null,
    },
    {
      role: "vpc",
      keyOf: (c) =>
        c.placement.vpcId
          ? [
              c.placement.providerFamily,
              c.placement.accountId,
              c.placement.region,
              c.placement.vpcId,
            ].join("\0")
          : null,
    },
    {
      role: "region",
      keyOf: (c) =>
        [
          c.placement.providerFamily,
          c.placement.accountId,
          c.placement.region,
        ].join("\0"),
    },
    {
      role: "account",
      keyOf: (c) =>
        [c.placement.providerFamily, c.placement.accountId].join("\0"),
    },
    {
      role: "provider",
      keyOf: (c) => c.placement.providerFamily,
    },
  ];

  const childIdsByKey = new Map<string, string[]>();
  for (const cluster of clusters) {
    childIdsByKey.set(cluster.id, [cluster.build.clusterFrameId]);
  }

  for (const level of levels) {
    const groups = new Map<string, PipelineCluster[]>();
    for (const cluster of clusters) {
      const key = level.keyOf(cluster);
      if (!key) {
        continue;
      }
      groups.set(key, [...(groups.get(key) ?? []), cluster]);
    }
    for (const [key, group] of groups) {
      const childIds = group.map((c) => {
        const lower =
          level.role === "subnetZone"
            ? c.id
            : level.role === "vpc"
            ? laneKey(c.placement)
            : level.role === "region"
            ? c.placement.vpcId
              ? [
                  c.placement.providerFamily,
                  c.placement.accountId,
                  c.placement.region,
                  c.placement.vpcId,
                ].join("\0")
              : c.id
            : level.role === "account"
            ? [
                c.placement.providerFamily,
                c.placement.accountId,
                c.placement.region,
              ].join("\0")
            : [c.placement.providerFamily, c.placement.accountId].join("\0");
        return childIdsByKey.get(lower)?.[0] ?? c.build.clusterFrameId;
      });
      const uniqueChildIds = [...new Set(childIds)];
      const b = boundsOf(uniqueChildIds, boxes);
      if (!b) {
        continue;
      }
      const placement = group[0]!.placement;
      const id = `tf-pipeline:${level.role}:${encodeURIComponent(key)}`;
      const pad = FRAME_PAD;
      skeleton.push({
        type: "frame",
        id,
        name:
          level.role === "provider"
            ? placement.providerFamily
            : level.role === "account"
            ? `Account ${placement.accountId}`
            : level.role === "region"
            ? `Region ${placement.region}`
            : level.role === "vpc"
            ? `VPC ${placement.vpcId}`
            : placement.subnetTier
            ? `${placement.subnetTier} subnet zone`
            : "subnet zone",
        x: b.x - pad,
        y: b.y - pad,
        width: b.width + 2 * pad,
        height: b.height + 2 * pad,
        children: uniqueChildIds,
        ...spreadContextFrameColors(level.role, {
          subnetTier:
            level.role === "subnetZone" ? placement.subnetTier : undefined,
        }),
        customData: pipelineFrameCustomData(level.role, placement, id, {
          terraformSubnetSignature: placement.subnetSignature,
          terraformSubnetTier: placement.subnetTier,
        }),
      });
      boxes.set(id, {
        x: b.x - pad,
        y: b.y - pad,
        width: b.width + 2 * pad,
        height: b.height + 2 * pad,
      });
      childIdsByKey.set(key, [id]);
    }
  }
}

export async function buildTerraformPipelineExcalidrawScene(
  nodes: TerraformPlanNodesMap,
  plan: unknown,
  options?: { compact?: boolean },
): Promise<{
  elements: ExcalidrawElement[];
  meta: Record<string, unknown>;
  warnings: TerraformImportWarning[];
}> {
  const compact = options?.compact !== false;
  const declared = nodes[DECLARED_DATAFLOW_ORDERED_KEY];
  if (!Array.isArray(declared) || declared.length === 0) {
    throw new Error(
      "Pipeline view requires at least one resolved .tfd dataflow edge.",
    );
  }

  const satelliteOwners = buildSatelliteOwnerMap(nodes, plan);
  const placementByAddress = buildPlacementMap(nodes, plan);
  const firstSequence = new Map<string, number>();
  const collapsedEdges: Array<{
    source: string;
    target: string;
    sequence: number;
    original: DeclaredDataFlowEdge;
  }> = [];
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

  const maxDepth = Math.max(0, ...clusters.map((c) => c.depth));
  const columnWidths = Array.from({ length: maxDepth + 1 }, (_, depth) =>
    Math.max(
      260,
      ...clusters.filter((c) => c.depth === depth).map((c) => c.build.width),
    ),
  );
  const columnX: number[] = [];
  let x = MARGIN + FRAME_PAD * 5;
  for (let i = 0; i < columnWidths.length; i++) {
    columnX[i] = x;
    x += columnWidths[i]! + COLUMN_GAP;
  }

  const lanes = new Map<string, PipelineCluster[]>();
  for (const cluster of clusters) {
    const key = laneKey(cluster.placement);
    lanes.set(key, [...(lanes.get(key) ?? []), cluster]);
  }
  const laneEntries = [...lanes.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const skeleton: ExcalidrawElementSkeleton[] = [];
  const layoutBoxes = new Map<string, TerraformDependencyLayoutBox>();

  let laneY = MARGIN + FRAME_PAD * 5;
  for (const [, laneClusters] of laneEntries) {
    const colY = new Map<number, number>();
    for (let d = 0; d <= maxDepth; d++) {
      colY.set(d, laneY);
    }
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
          typeof frame?.height === "number"
            ? frame.height
            : cluster.build.height,
      };
      layoutBoxes.set(cluster.build.clusterFrameId, {
        ...frameBox,
      });
      layoutBoxes.set(cluster.id, {
        ...frameBox,
      });
      colY.set(cluster.depth, frameBox.y + frameBox.height + CLUSTER_GAP_Y);
    }
    laneY =
      Math.max(...Array.from(colY.values()), laneY + 1) +
      LANE_GAP_Y +
      FRAME_PAD * 4;
  }

  pushContextFrames(skeleton, clusters, layoutBoxes);

  const pipelineNodes = { ...nodes } as TerraformPlanNodesMap;
  pipelineNodes[DECLARED_DATAFLOW_ORDERED_KEY] = collapsedEdges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    sequence: edge.sequence,
    origin: "tfd",
  }));
  const originalBySequence = new Map(
    collapsedEdges.map((edge) => [edge.sequence, edge.original]),
  );
  skeleton.push(
    ...buildTerraformDeclaredDataFlowLineSkeletons(
      pipelineNodes,
      Object.fromEntries(layoutBoxes.entries()),
      collectDeclaredDataFlowEdges(pipelineNodes),
      new Set(),
      { terraformSemanticOverview: true },
    ).map((line) => ({
      ...line,
      customData: {
        ...(line.customData ?? {}),
        terraformPipelineView: true,
        relationship: {
          ...((line.customData as { relationship?: Record<string, unknown> })
            ?.relationship ?? {}),
          ...(() => {
            const sequence = (
              line.customData as {
                relationship?: { sequence?: unknown };
              }
            )?.relationship?.sequence;
            const original =
              typeof sequence === "number"
                ? originalBySequence.get(sequence)
                : undefined;
            return original
              ? {
                  terraformPipelineOriginalSource: original.source,
                  terraformPipelineOriginalTarget: original.target,
                  terraformPipelineOriginalSequence: original.sequence,
                }
              : {};
          })(),
        },
      },
    })),
  );

  let elements = convertToExcalidrawElements(skeleton, {
    regenerateIds: true,
  }) as ExcalidrawElement[];
  elements = mirrorAndDetachTerraformResourceLabels(elements);
  elements = await injectTerraformAwsIconsIntoElements(elements);
  elements = reconcileTerraformVisibility(
    repairTerraformEdgeBindings(elements),
    {
      pins: TERRAFORM_IMPORT_EDGE_LAYER_PINS,
      hoverPeekKey: null,
    },
  );
  elements = reorderTopologyElementsZStack(elements);

  return {
    elements,
    meta: {
      layoutEngine: "pipeline",
      pipelineCompact: compact,
      pipelineClusterCount: clusters.length,
      pipelineEdgeCount: collapsedEdges.length,
      pipelineColumnCount: maxDepth + 1,
    },
    warnings: depthResult.hasCycle
      ? [
          {
            code: "pipeline_cycle",
            message:
              "Pipeline view detected a cycle after collapsing .tfd endpoints; order fell back to first .tfd occurrence.",
          } as TerraformImportWarning,
        ]
      : [],
  };
}

export {
  collapsePipelineCluster,
  expandPipelineCluster,
} from "./terraformPipelineLayoutExpand";
