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
  ANCILLARY_DEFAULT_WRAP_WIDTH,
  layoutAncillaryStrip,
  preparePipelineLayout,
  regionScopeKey,
  vpcScopeKey,
} from "./terraformPipelineLayoutShared";
import { buildCompoundFramesFromLayoutBoxes } from "./terraformPipelineTopologyFrames";
import { layoutPipelineV2Strict } from "./terraformPipelineV2Pack";

import type {
  AncillaryStrip,
  PipelineCluster,
  PipelineLayoutPrep,
} from "./terraformPipelineLayoutShared";
import type { TerraformPlanNodesMap } from "./terraformPlanParsing";
import type { TerraformImportWarning } from "./terraformImportMerge";

/**
 * Wrap each "Unconnected" ancillary strip as a pseudo-cluster carrying its own
 * laid skeleton (frame + cards) so the V2 packer positions it as the bottom band
 * of its account▸region▸vpc scope. The strip has no TFD edges, so the strict
 * packer treats it as an external sink (placed after the real clusters) — order
 * invariants are untouched. `depth` = the leftmost depth of the scope's real
 * clusters so the strip's left edge aligns with the scope; it is intentionally
 * excluded from `computeGlobalColumnX` (a wide strip must not widen the global
 * column shared by every scope).
 */
function buildV2AncillaryClusters(
  strips: readonly AncillaryStrip[],
  prep: PipelineLayoutPrep,
): PipelineCluster[] {
  const scopeDepth = (strip: AncillaryStrip): number => {
    let min = Number.POSITIVE_INFINITY;
    for (const cluster of prep.clusters) {
      const key =
        strip.scopeRole === "vpc"
          ? vpcScopeKey(cluster.placement)
          : regionScopeKey(cluster.placement);
      if (key === strip.scopeKey) {
        min = Math.min(min, cluster.depth);
      }
    }
    return Number.isFinite(min) ? min : 0;
  };
  return strips.map((strip) => {
    const laid = layoutAncillaryStrip(strip, ANCILLARY_DEFAULT_WRAP_WIDTH);
    return {
      id: `__ancillary__:${strip.scopeKey}`,
      primaryAddress: `__ancillary__:${strip.scopeKey}`,
      firstSequence: Number.MAX_SAFE_INTEGER,
      depth: scopeDepth(strip),
      placement: strip.placement,
      build: {
        skeleton: laid.skeleton,
        width: laid.width,
        height: laid.height,
        clusterFrameId: strip.stripFrameId,
      },
    };
  });
}

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
    includeAncillary?: boolean;
  },
): Promise<{
  elements: ExcalidrawElement[];
  meta: Record<string, unknown>;
  warnings: TerraformImportWarning[];
}> {
  const compact = options?.compact !== false;
  const includeAncillary = options?.includeAncillary === true;

  const prep = preparePipelineLayout(nodes, plan, compact);

  const ancillaryStrips = includeAncillary
    ? buildAncillaryStrips(nodes, plan, prep, { compact })
    : [];
  const ancillaryClusters = buildV2AncillaryClusters(ancillaryStrips, prep);
  // The packer positions and emits the strip skeletons; the frame finishers nest
  // each strip frame into its scope. All three iterate this combined list.
  const framedClusters = [...prep.clusters, ...ancillaryClusters];

  const { skeleton, layoutBoxes, sideBySideRows } = layoutPipelineV2Strict(
    prep,
    ancillaryClusters,
  );

  buildCompoundFramesFromLayoutBoxes(skeleton, framedClusters, layoutBoxes);
  applyCompoundHierarchicalLayout(skeleton, layoutBoxes, framedClusters);
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
