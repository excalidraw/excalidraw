import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import {
  PIPELINE_FRAME_PAD,
  PIPELINE_LANE_GAP_Y,
  PIPELINE_MARGIN,
  type PipelineCluster,
} from "./terraformPipelineLayoutShared";
import {
  lcaTopologyPath,
  topologyFrameSkeletonId,
  topologyPathForCluster,
  topologyRoleAndKeyFromPath,
  type TopologyFrameRole,
} from "./terraformPipelineTopologyFrames";

import type { TerraformDependencyLayoutBox } from "./terraformElkLayout";

type FrameSkeleton = Extract<
  ExcalidrawElementSkeleton,
  { type: "frame" } | { type: "magicframe" }
>;

type SkeletonCustomData = {
  terraformTopologyRole?: string;
  terraformTopologyKey?: string;
  terraformCompoundLayout?: boolean;
  terraformCompoundParentKey?: string;
  terraformCompoundLocal?: { x: number; y: number };
  relationship?: { source?: string; target?: string };
  terraformEdgeLayer?: string;
};

function skeletonCustomData(
  el: ExcalidrawElementSkeleton,
): SkeletonCustomData | undefined {
  return el.customData as SkeletonCustomData | undefined;
}

function isFrameSkeleton(
  el: ExcalidrawElementSkeleton | undefined,
): el is FrameSkeleton {
  return el?.type === "frame" || el?.type === "magicframe";
}

function frameChildIds(el: ExcalidrawElementSkeleton | undefined): string[] {
  if (!isFrameSkeleton(el)) {
    return [];
  }
  return el.children.filter((id): id is string => typeof id === "string");
}

function collectDescendantIds(
  rootId: string,
  skeletonById: Map<string, ExcalidrawElementSkeleton>,
): Set<string> {
  const out = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (out.has(id)) {
      continue;
    }
    out.add(id);
    const el = skeletonById.get(id);
    for (const childId of frameChildIds(el)) {
      queue.push(childId);
    }
  }
  return out;
}

function translateSkeletonElement(
  el: ExcalidrawElementSkeleton,
  dx: number,
  dy: number,
): ExcalidrawElementSkeleton {
  const next = { ...el };
  if (typeof next.x === "number") {
    next.x += dx;
  }
  if (typeof next.y === "number") {
    next.y += dy;
  }
  if (next.type === "arrow" || next.type === "line") {
    const points = next.points;
    if (Array.isArray(points) && points.length >= 2) {
      const end = points[points.length - 1] as { x?: number; y?: number };
      if (typeof end?.x === "number" && typeof end?.y === "number") {
        next.width = Math.abs(end.x);
        next.height = Math.abs(end.y);
      }
    }
  }
  return next;
}

function translateLayoutBox(
  box: TerraformDependencyLayoutBox,
  dx: number,
  dy: number,
): TerraformDependencyLayoutBox {
  return { ...box, x: box.x + dx, y: box.y + dy };
}

function stampCompoundLocalOnSubtree(
  frameId: string,
  skeletonById: Map<string, ExcalidrawElementSkeleton>,
  skeleton: ExcalidrawElementSkeleton[],
  parentKey: string | null,
  contentOriginX: number,
  contentOriginY: number,
): void {
  const frame = skeletonById.get(frameId);
  if (!isFrameSkeleton(frame)) {
    return;
  }
  const frameKey = skeletonCustomData(frame)?.terraformTopologyKey ?? frameId;
  const pad = PIPELINE_FRAME_PAD;
  const originX =
    (typeof frame.x === "number" ? frame.x : contentOriginX) + pad;
  const originY =
    (typeof frame.y === "number" ? frame.y : contentOriginY) + pad;

  const idx = skeleton.findIndex((el) => el.id === frameId);
  if (idx >= 0) {
    skeleton[idx] = {
      ...frame,
      customData: {
        ...(frame.customData ?? {}),
        terraformCompoundLayout: true,
        ...(parentKey
          ? {
              terraformCompoundParentKey: parentKey,
              terraformCompoundLocal: {
                x:
                  (typeof frame.x === "number" ? frame.x : originX) -
                  contentOriginX,
                y:
                  (typeof frame.y === "number" ? frame.y : originY) -
                  contentOriginY,
              },
            }
          : {}),
      },
    };
    skeletonById.set(frameId, skeleton[idx]!);
  }

  for (const childId of frame.children) {
    const child = skeletonById.get(childId);
    if (!child) {
      continue;
    }
    const childIdx = skeleton.findIndex((el) => el.id === childId);
    if (childIdx < 0) {
      continue;
    }
    const childX = typeof child.x === "number" ? child.x : originX;
    const childY = typeof child.y === "number" ? child.y : originY;
    skeleton[childIdx] = {
      ...child,
      customData: {
        ...(child.customData ?? {}),
        terraformCompoundLayout: true,
        terraformCompoundParentKey: frameKey,
        terraformCompoundLocal: {
          x: childX - originX,
          y: childY - originY,
        },
      },
    };
    skeletonById.set(childId, skeleton[childIdx]!);

    if (child.type === "frame" || child.type === "magicframe") {
      stampCompoundLocalOnSubtree(
        childId,
        skeletonById,
        skeleton,
        frameKey,
        originX,
        originY,
      );
    }
  }
}

/**
 * Re-anchor provider subtrees at PIPELINE_MARGIN and stamp parent-relative coords.
 */
export function applyCompoundHierarchicalLayout(
  skeleton: ExcalidrawElementSkeleton[],
  layoutBoxes: Map<string, TerraformDependencyLayoutBox>,
  _clusters: readonly PipelineCluster[],
): void {
  const skeletonById = new Map(
    skeleton
      .filter((el) => typeof el.id === "string")
      .map((el) => [el.id as string, el]),
  );

  const providerFrames = skeleton.filter(
    (el) =>
      el.type === "frame" &&
      skeletonCustomData(el)?.terraformTopologyRole === "provider",
  );

  let providerY = PIPELINE_MARGIN;
  for (const providerFrame of providerFrames) {
    const providerId = providerFrame.id as string;
    const oldX = typeof providerFrame.x === "number" ? providerFrame.x : 0;
    const oldY = typeof providerFrame.y === "number" ? providerFrame.y : 0;
    const dx = PIPELINE_MARGIN - oldX;
    const dy = providerY - oldY;

    const descendantIds = collectDescendantIds(providerId, skeletonById);
    for (let i = 0; i < skeleton.length; i++) {
      const el = skeleton[i]!;
      if (!el.id || !descendantIds.has(el.id)) {
        continue;
      }
      skeleton[i] = translateSkeletonElement(el, dx, dy);
      skeletonById.set(el.id, skeleton[i]!);
    }

    for (const [boxId, box] of layoutBoxes.entries()) {
      if (descendantIds.has(boxId)) {
        layoutBoxes.set(boxId, translateLayoutBox(box, dx, dy));
      }
    }

    const updatedProvider = skeletonById.get(providerId);
    const providerHeight =
      typeof updatedProvider?.height === "number" ? updatedProvider.height : 0;
    stampCompoundLocalOnSubtree(
      providerId,
      skeletonById,
      skeleton,
      null,
      PIPELINE_MARGIN,
      providerY,
    );

    providerY += providerHeight + PIPELINE_LANE_GAP_Y;
  }
}

function frameSkeletonForTopologyPath(path: readonly string[]): string | null {
  const roleAndKey = topologyRoleAndKeyFromPath(path);
  if (!roleAndKey) {
    return null;
  }
  return topologyFrameSkeletonId(roleAndKey.role, roleAndKey.key);
}

function clusterPathById(
  clusters: readonly PipelineCluster[],
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const cluster of clusters) {
    out.set(cluster.id, topologyPathForCluster(cluster));
  }
  return out;
}

/**
 * Parent TFD arrows into the lowest common topology frame so they move with group drag.
 */
export function assignCompoundEdgeFrameParents(
  skeleton: ExcalidrawElementSkeleton[],
  clusters: readonly PipelineCluster[],
): void {
  const pathsByCluster = clusterPathById(clusters);
  const skeletonById = new Map(
    skeleton
      .filter((el) => typeof el.id === "string")
      .map((el) => [el.id as string, el]),
  );

  for (const arrow of skeleton) {
    if (arrow.type !== "arrow" && arrow.type !== "line") {
      continue;
    }
    const cd = skeletonCustomData(arrow);
    if (cd?.terraformEdgeLayer !== "declaredDataFlow") {
      continue;
    }
    const source = cd.relationship?.source;
    const target = cd.relationship?.target;
    if (!source || !target) {
      continue;
    }
    const sourcePath = pathsByCluster.get(source);
    const targetPath = pathsByCluster.get(target);
    if (!sourcePath || !targetPath) {
      continue;
    }
    const lca = lcaTopologyPath(sourcePath, targetPath);
    const parentFrameId = frameSkeletonForTopologyPath(lca);
    if (!parentFrameId) {
      continue;
    }
    const parentIdx = skeleton.findIndex((el) => el.id === parentFrameId);
    if (parentIdx < 0) {
      continue;
    }
    const parent = skeleton[parentIdx];
    if (!isFrameSkeleton(parent)) {
      continue;
    }
    const arrowId = arrow.id as string;
    const children = [...parent.children];
    if (!children.includes(arrowId)) {
      children.push(arrowId);
      const nextParent: FrameSkeleton = { ...parent, children };
      skeleton[parentIdx] = nextParent;
      skeletonById.set(parentFrameId, nextParent);
    }
  }
}

export type { TopologyFrameRole };
