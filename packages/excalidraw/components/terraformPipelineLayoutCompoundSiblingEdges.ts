import { pointFrom } from "@excalidraw/math";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { LocalPoint } from "@excalidraw/math";

import {
  fixedPointForLayoutPoint,
  getCenterClippedLine,
  TERRAFORM_TOPOLOGY_FRAME_FLOW_STROKE,
  type TerraformDependencyLayoutBox,
} from "./terraformElkLayout";

import {
  lcaTopologyPath,
  topologyFrameSkeletonId,
  topologyPathForCluster,
  topologyRoleAndKeyFromPath,
  type TopologyFrameRole,
} from "./terraformPipelineTopologyFrames";

import type { PipelineCluster } from "./terraformPipelineLayoutShared";

import type { CollapsedPipelineEdge } from "./terraformPipelineLayoutShared";

export type CompoundTopologyFrameEdge = {
  sourceFrameId: string;
  targetFrameId: string;
  parentFrameId: string;
  role: TopologyFrameRole;
  sequence: number;
  /** Number of declared dataflow edges aggregated into this one connector. */
  weight: number;
};

const pathsEqual = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((segment, index) => segment === b[index]);

/**
 * When source/target diverge as sibling topology boxes (same parent role), return
 * their frame ids and the parent frame that contains both.
 */
export function resolveSiblingTopologyFramePair(
  sourcePath: readonly string[],
  targetPath: readonly string[],
): Omit<CompoundTopologyFrameEdge, "sequence" | "weight"> | null {
  if (pathsEqual(sourcePath, targetPath)) {
    return null;
  }

  const lca = lcaTopologyPath(sourcePath, targetPath);
  const divergeIdx = lca.length;

  if (
    sourcePath.length <= divergeIdx ||
    targetPath.length <= divergeIdx ||
    sourcePath[divergeIdx] === targetPath[divergeIdx]
  ) {
    return null;
  }

  const sourceSiblingPath = sourcePath.slice(0, divergeIdx + 1);
  const targetSiblingPath = targetPath.slice(0, divergeIdx + 1);
  const sourceRoleKey = topologyRoleAndKeyFromPath(sourceSiblingPath);
  const targetRoleKey = topologyRoleAndKeyFromPath(targetSiblingPath);
  if (
    !sourceRoleKey ||
    !targetRoleKey ||
    sourceRoleKey.role !== targetRoleKey.role
  ) {
    return null;
  }

  const parentRoleKey = topologyRoleAndKeyFromPath(lca);
  if (!parentRoleKey) {
    return null;
  }

  return {
    sourceFrameId: topologyFrameSkeletonId(
      sourceRoleKey.role,
      sourceRoleKey.key,
    ),
    targetFrameId: topologyFrameSkeletonId(
      targetRoleKey.role,
      targetRoleKey.key,
    ),
    parentFrameId: topologyFrameSkeletonId(
      parentRoleKey.role,
      parentRoleKey.key,
    ),
    role: sourceRoleKey.role,
  };
}

export function collectCompoundTopologyFrameEdges(
  collapsedEdges: readonly CollapsedPipelineEdge[],
  clusters: readonly PipelineCluster[],
): CompoundTopologyFrameEdge[] {
  const pathsByCluster = new Map(
    clusters.map((cluster) => [cluster.id, topologyPathForCluster(cluster)]),
  );
  const deduped = new Map<string, CompoundTopologyFrameEdge>();

  for (const edge of collapsedEdges) {
    const sourcePath = pathsByCluster.get(edge.source);
    const targetPath = pathsByCluster.get(edge.target);
    if (!sourcePath || !targetPath) {
      continue;
    }

    const pair = resolveSiblingTopologyFramePair(sourcePath, targetPath);
    if (!pair) {
      continue;
    }

    const key = `${pair.parentFrameId}|||${pair.sourceFrameId}|||${pair.targetFrameId}`;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, { ...pair, sequence: edge.sequence, weight: 1 });
    } else {
      existing.weight += 1;
      existing.sequence = Math.min(existing.sequence, edge.sequence);
    }
  }

  return [...deduped.values()].sort(
    (a, b) =>
      a.sequence - b.sequence || a.sourceFrameId.localeCompare(b.targetFrameId),
  );
}

type LayoutBox = TerraformDependencyLayoutBox;

export function appendCompoundTopologyFrameEdgeSkeletons(
  collapsedEdges: readonly CollapsedPipelineEdge[],
  clusters: readonly PipelineCluster[],
  skeleton: ExcalidrawElementSkeleton[],
  layoutBoxes: Map<string, LayoutBox>,
): number {
  const frameEdges = collectCompoundTopologyFrameEdges(
    collapsedEdges,
    clusters,
  );
  let edgeIndex = 0;

  for (const edge of frameEdges) {
    const sourceBox = layoutBoxes.get(edge.sourceFrameId);
    const targetBox = layoutBoxes.get(edge.targetFrameId);
    if (!sourceBox || !targetBox) {
      continue;
    }

    const { startPoint, endPoint } = getCenterClippedLine(sourceBox, targetBox);
    const startX = startPoint.x;
    const startY = startPoint.y;
    const endX = endPoint.x;
    const endY = endPoint.y;

    // Heavier relationships read as thicker connectors: base 4px, +1px per
    // doubling of aggregated edge count, capped so a single dial does not
    // dominate the scene.
    const strokeWidth = Math.min(
      4 + Math.round(Math.log2(Math.max(1, edge.weight)) * 1.5),
      10,
    );

    skeleton.push({
      type: "arrow",
      id: `tf-topology-frame-flow-${edgeIndex}`,
      x: startX,
      y: startY,
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(endX - startX, endY - startY),
      ],
      strokeWidth,
      strokeColor: TERRAFORM_TOPOLOGY_FRAME_FLOW_STROKE,
      strokeStyle: "dashed",
      startArrowhead: null,
      endArrowhead: "arrow",
      roundness: { type: 2 },
      startBinding: {
        elementId: edge.sourceFrameId,
        fixedPoint: fixedPointForLayoutPoint(sourceBox, startPoint),
        mode: "orbit",
      },
      endBinding: {
        elementId: edge.targetFrameId,
        fixedPoint: fixedPointForLayoutPoint(targetBox, endPoint),
        mode: "orbit",
      },
      customData: {
        terraform: true,
        terraformEdgeLayer: "topologyFrameFlow",
        terraformPipelineView: true,
        terraformSemanticOverview: true,
        relationship: {
          source: edge.sourceFrameId,
          target: edge.targetFrameId,
          directed: true,
          sequence: edge.sequence,
          topologyRole: edge.role,
          parentFrameId: edge.parentFrameId,
          aggregated: true,
          weight: edge.weight,
        },
      },
    });
    edgeIndex += 1;
  }

  return edgeIndex;
}
