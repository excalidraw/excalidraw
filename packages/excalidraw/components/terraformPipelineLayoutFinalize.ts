import { convertToExcalidrawElements } from "@excalidraw/element";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  buildTerraformDeclaredDataFlowLineSkeletons,
  mirrorAndDetachTerraformResourceLabels,
  type TerraformDependencyLayoutBox,
} from "./terraformElkLayout";
import { collectDeclaredDataFlowEdges } from "./terraformExplodeGraph";
import { DECLARED_DATAFLOW_ORDERED_KEY } from "./terraformDeclaredDataFlow";
import { reorderTopologyElementsZStack } from "./terraformTopologyLayout";
import {
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
  TERRAFORM_IMPORT_EDGE_LAYER_PINS,
} from "./terraformVisibility";
import { injectTerraformAwsIconsIntoElements } from "./terraformAwsIcons";

import type { CollapsedPipelineEdge } from "./terraformPipelineLayoutShared";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";
import type { TerraformImportWarning } from "./terraformImportMerge";

export function pipelineCycleWarnings(depthResult: {
  hasCycle: boolean;
}): TerraformImportWarning[] {
  return depthResult.hasCycle
    ? [
        {
          code: "pipeline_cycle",
          message:
            "Pipeline view detected a cycle after collapsing .tfd endpoints; order fell back to first .tfd occurrence.",
        } as TerraformImportWarning,
      ]
    : [];
}

export function appendPipelineEdgeSkeletons(
  nodes: TerraformPlanNodesMap,
  collapsedEdges: CollapsedPipelineEdge[],
  skeleton: ExcalidrawElementSkeleton[],
  layoutBoxes: Map<string, TerraformDependencyLayoutBox>,
): void {
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
}

export async function convertPipelineSkeletonToElements(
  skeleton: ExcalidrawElementSkeleton[],
): Promise<ExcalidrawElement[]> {
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
  return elements;
}

export async function finalizePipelineScene(
  nodes: TerraformPlanNodesMap,
  collapsedEdges: CollapsedPipelineEdge[],
  skeleton: ExcalidrawElementSkeleton[],
  layoutBoxes: Map<string, TerraformDependencyLayoutBox>,
  meta: Record<string, unknown>,
  depthResult: { hasCycle: boolean },
): Promise<{
  elements: ExcalidrawElement[];
  meta: Record<string, unknown>;
  warnings: TerraformImportWarning[];
}> {
  appendPipelineEdgeSkeletons(nodes, collapsedEdges, skeleton, layoutBoxes);
  const elements = await convertPipelineSkeletonToElements(skeleton);
  return {
    elements,
    meta,
    warnings: pipelineCycleWarnings(depthResult),
  };
}
