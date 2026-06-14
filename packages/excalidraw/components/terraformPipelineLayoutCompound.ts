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
  buildAncillaryStrips,
  countAncillaryCards,
} from "./terraformPipelineLayoutAncillary";
import {
  placeClustersClassicGrid,
  preparePipelineLayout,
} from "./terraformPipelineLayoutShared";
import {
  applyPackedDepthShifts,
  computePackedDepthShifts,
  computePackedPullLeftShifts,
  placeClustersPackedGrid,
  pullLeftShiftsAsDepthShifts,
  EMPTY_PACKED_DEPTH_SHIFTS,
  EMPTY_PACKED_PULL_LEFT_SHIFTS,
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
  options?: {
    compact?: boolean;
    packed?: boolean;
    packedPullLeft?: boolean;
    includeAncillary?: boolean;
    semanticPlacement?: boolean;
    experimentalLayout?: boolean;
  },
): Promise<{
  elements: ExcalidrawElement[];
  meta: Record<string, unknown>;
  warnings: TerraformImportWarning[];
}> {
  const compact = options?.compact !== false;
  const packed = options?.packed === true;
  const packedPullLeft = packed && options?.packedPullLeft === true;
  const includeAncillary = options?.includeAncillary === true;
  const semanticPlacement = options?.semanticPlacement === true;
  const experimentalLayout = options?.experimentalLayout === true;
  let prep = preparePipelineLayout(nodes, plan, compact, {
    experimentalLayout,
  });
  const ancillaryStrips = includeAncillary
    ? buildAncillaryStrips(nodes, plan, prep, { compact })
    : [];
  let packedShifts = EMPTY_PACKED_DEPTH_SHIFTS;
  let pullLeftShifts = EMPTY_PACKED_PULL_LEFT_SHIFTS;
  if (packed) {
    packedShifts = computePackedDepthShifts(prep);
    prep = applyPackedDepthShifts(prep, packedShifts);
    if (packedPullLeft) {
      pullLeftShifts = computePackedPullLeftShifts(
        prep,
        ancillaryStrips,
        semanticPlacement,
      );
      prep = applyPackedDepthShifts(
        prep,
        pullLeftShiftsAsDepthShifts(pullLeftShifts),
      );
    }
  }
  const { skeleton, layoutBoxes, ancillaryClusters } = packed
    ? placeClustersPackedGrid(prep, ancillaryStrips, {
        semanticPlacement,
        experimentalLayout,
      })
    : placeClustersClassicGrid(prep, ancillaryStrips, {
        semanticPlacement,
        experimentalLayout,
      });

  buildCompoundFramesFromLayoutBoxes(
    skeleton,
    [...prep.clusters, ...ancillaryClusters],
    layoutBoxes,
  );
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
      ...(semanticPlacement ? { pipelineSemanticPlacement: true } : {}),
      ...(experimentalLayout ? { pipelineExperimentalLayout: true } : {}),
      ...(packed
        ? {
            pipelinePackedApplied: true,
            pipelinePackedDepthShiftCount: packedShifts.shiftCount,
            pipelinePackedGroupShiftCount: packedShifts.groupShiftCount,
          }
        : {}),
      ...(packedPullLeft
        ? {
            pipelinePackedPullLeftApplied: true,
            pipelinePackedPullLeftCount: pullLeftShifts.pullCount,
            ...(pullLeftShifts.evalCapReached
              ? { pipelinePackedPullLeftCapped: true }
              : {}),
          }
        : {}),
      ...(includeAncillary
        ? {
            pipelineIncludeAncillary: true,
            pipelineAncillaryApplied: ancillaryStrips.length > 0,
            pipelineAncillaryCount: countAncillaryCards(ancillaryStrips),
            pipelineAncillaryStripCount: ancillaryStrips.length,
          }
        : {}),
    },
    warnings: pipelineCycleWarnings(prep.depthResult),
  };
}
