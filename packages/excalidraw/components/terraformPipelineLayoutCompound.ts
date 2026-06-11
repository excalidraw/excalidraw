import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  appendPipelineEdgeSkeletons,
  convertPipelineSkeletonToElements,
  pipelineCycleWarnings,
} from "./terraformPipelineLayoutFinalize";
import {
  applyCompoundHierarchicalLayout,
  assignCompoundEdgeFrameParents,
} from "./terraformPipelineLayoutCompoundHierarchy";
import { appendCompoundTopologyFrameEdgeSkeletons } from "./terraformPipelineLayoutCompoundSiblingEdges";
import {
  placeClustersClassicGrid,
  preparePipelineLayout,
} from "./terraformPipelineLayoutShared";
import {
  applyPackedDepthShifts,
  computePackedDepthShifts,
  placeClustersPackedGrid,
  EMPTY_PACKED_DEPTH_SHIFTS,
} from "./terraformPipelineLayoutPacked";
import { buildCompoundFramesFromLayoutBoxes } from "./terraformPipelineTopologyFrames";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";
import type { TerraformImportWarning } from "./terraformImportMerge";

/**
 * Compound pipeline layout: TFD-first global grid, topology hull frames, then
 * hierarchical re-anchor + local metadata so topology groups drag together.
 */
export async function buildTerraformCompoundPipelineExcalidrawScene(
  nodes: TerraformPlanNodesMap,
  plan: unknown,
  options?: { compact?: boolean; packed?: boolean },
): Promise<{
  elements: ExcalidrawElement[];
  meta: Record<string, unknown>;
  warnings: TerraformImportWarning[];
}> {
  const compact = options?.compact !== false;
  const packed = options?.packed === true;
  let prep = preparePipelineLayout(nodes, plan, compact);
  let packedShifts = EMPTY_PACKED_DEPTH_SHIFTS;
  if (packed) {
    packedShifts = computePackedDepthShifts(prep);
    prep = applyPackedDepthShifts(prep, packedShifts);
  }
  const { skeleton, layoutBoxes } = packed
    ? placeClustersPackedGrid(prep)
    : placeClustersClassicGrid(prep);

  buildCompoundFramesFromLayoutBoxes(skeleton, prep.clusters, layoutBoxes);
  applyCompoundHierarchicalLayout(skeleton, layoutBoxes, prep.clusters);
  appendPipelineEdgeSkeletons(
    nodes,
    prep.collapsedEdges,
    skeleton,
    layoutBoxes,
  );
  const pipelineTopologyFrameEdgeCount =
    appendCompoundTopologyFrameEdgeSkeletons(
      prep.collapsedEdges,
      prep.clusters,
      skeleton,
      layoutBoxes,
    );
  assignCompoundEdgeFrameParents(skeleton, prep.clusters);

  const elements = await convertPipelineSkeletonToElements(skeleton);

  return {
    elements,
    meta: {
      layoutEngine: "pipeline",
      pipelineVariant: "compound",
      pipelineCompoundHierarchical: true,
      pipelineCompact: compact,
      pipelineClusterCount: prep.clusters.length,
      pipelineEdgeCount: prep.collapsedEdges.length,
      pipelineTopologyFrameEdgeCount,
      pipelineColumnCount: prep.maxDepth + 1,
      ...(packed
        ? {
            pipelinePackedApplied: true,
            pipelinePackedDepthShiftCount: packedShifts.shiftCount,
            pipelinePackedGroupShiftCount: packedShifts.groupShiftCount,
          }
        : {}),
    },
    warnings: pipelineCycleWarnings(prep.depthResult),
  };
}
