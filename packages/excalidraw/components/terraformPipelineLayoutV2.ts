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
import { preparePipelineLayout } from "./terraformPipelineLayoutShared";
import { buildCompoundFramesFromLayoutBoxes } from "./terraformPipelineTopologyFrames";
import { layoutPipelineV2Strict } from "./terraformPipelineV2Pack";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";
import type { TerraformImportWarning } from "./terraformImportMerge";

/**
 * Pipeline view v2: hybrid layout. The semantic prep (clusters, TFD edges,
 * topology hulls, compact cards) and the compound finishing passes (hull frames,
 * hierarchical drag-grouping, TFD + sibling-frame edges) are reused verbatim from
 * v1/compound; only **placement** is replaced by the strict column-aware skyline
 * packer (`layoutPipelineV2Strict`) — global TFD depth columns (zero backward
 * edges by construction) + 2-D packing of column-disjoint hulls (square where the
 * ordering allows). This supersedes the packed / pull-left / semantic-placement
 * heuristics rather than adding to them.
 */
export async function buildTerraformPipelineV2ExcalidrawScene(
  nodes: TerraformPlanNodesMap,
  plan: unknown,
  options?: {
    compact?: boolean;
  },
): Promise<{
  elements: ExcalidrawElement[];
  meta: Record<string, unknown>;
  warnings: TerraformImportWarning[];
}> {
  const compact = options?.compact !== false;

  const prep = preparePipelineLayout(nodes, plan, compact);

  const { skeleton, layoutBoxes, sideBySideRows } =
    layoutPipelineV2Strict(prep);

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
      pipelineVariant: "v2",
      pipelineCompoundHierarchical: true,
      pipelineCompact: compact,
      pipelineClusterCount: prep.clusters.length,
      pipelineEdgeCount: prep.collapsedEdges.length,
      pipelineTopologyFrameEdgeCount,
      pipelineColumnCount: prep.maxDepth + 1,
      pipelineV2SideBySideRows: sideBySideRows,
    },
    warnings: pipelineCycleWarnings(prep.depthResult),
  };
}
