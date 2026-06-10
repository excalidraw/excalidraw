import type { ExcalidrawElement } from "@excalidraw/element/types";

import { finalizePipelineScene } from "./terraformPipelineLayoutFinalize";
import {
  placeClustersClassicGrid,
  preparePipelineLayout,
} from "./terraformPipelineLayoutShared";
import { emitTopologyContextFrames } from "./terraformPipelineTopologyFrames";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";
import type { TerraformImportWarning } from "./terraformImportMerge";

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
  const prep = preparePipelineLayout(nodes, plan, compact);
  const { skeleton, layoutBoxes } = placeClustersClassicGrid(prep);

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
    },
    prep.depthResult,
  );
}

export {
  collapsePipelineCluster,
  expandPipelineCluster,
} from "./terraformPipelineLayoutExpand";

export { buildTerraformCompoundPipelineExcalidrawScene } from "./terraformPipelineLayoutCompound";
