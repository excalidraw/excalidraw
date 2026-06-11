import type { ExcalidrawElement } from "@excalidraw/element/types";

import { finalizePipelineScene } from "./terraformPipelineLayoutFinalize";
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
import { emitTopologyContextFrames } from "./terraformPipelineTopologyFrames";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";
import type { TerraformImportWarning } from "./terraformImportMerge";

export async function buildTerraformPipelineExcalidrawScene(
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

  emitTopologyContextFrames(skeleton, prep.clusters, layoutBoxes);

  return finalizePipelineScene(
    nodes,
    prep.collapsedEdges,
    skeleton,
    layoutBoxes,
    {
      layoutEngine: "pipeline",
      pipelineVariant: "classic",
      pipelineCompact: compact,
      pipelineClusterCount: prep.clusters.length,
      pipelineEdgeCount: prep.collapsedEdges.length,
      pipelineColumnCount: prep.maxDepth + 1,
      ...(packed
        ? {
            pipelinePackedApplied: true,
            pipelinePackedDepthShiftCount: packedShifts.shiftCount,
            pipelinePackedGroupShiftCount: packedShifts.groupShiftCount,
          }
        : {}),
    },
    prep.depthResult,
  );
}

export {
  collapsePipelineCluster,
  expandPipelineCluster,
} from "./terraformPipelineLayoutExpand";

export { buildTerraformCompoundPipelineExcalidrawScene } from "./terraformPipelineLayoutCompound";
