/**
 * Pipeline-view declared TFD edges: horizontal attachment when row-aligned.
 */

import { pointFrom } from "@excalidraw/math";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { LocalPoint } from "@excalidraw/math";

import {
  fixedPointForLayoutPoint,
  getCenterClippedLine,
  resolveTerraformPlanVertexId,
  TERRAFORM_DECLARED_DATAFLOW_EDGE_STROKE,
  type TerraformDependencyLayoutBox,
} from "./terraformElkLayout";

import type { TerraformDataFlowEdgeRecord } from "./terraformExplodeGraph";
import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

const Y_ALIGN_EPS = 2;

type LayoutBox = TerraformDependencyLayoutBox;

function getPipelineClippedLine(
  sourceBox: LayoutBox,
  targetBox: LayoutBox,
): {
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
} {
  const sourceCy = sourceBox.y + sourceBox.height / 2;
  const targetCy = targetBox.y + targetBox.height / 2;

  if (Math.abs(sourceCy - targetCy) < Y_ALIGN_EPS) {
    const y = (sourceCy + targetCy) / 2;
    return {
      startPoint: { x: sourceBox.x + sourceBox.width, y },
      endPoint: { x: targetBox.x, y },
    };
  }

  return getCenterClippedLine(sourceBox, targetBox);
}

/** Declared `.tfd` arrows for pipeline layout with horizontal row-aligned attachment. */
export function buildPipelineDeclaredDataFlowLineSkeletons(
  nodes: TerraformPlanNodesMap,
  layoutBoxes: Record<string, TerraformDependencyLayoutBox>,
  declaredEdges: readonly TerraformDataFlowEdgeRecord[],
): ExcalidrawElementSkeleton[] {
  const out: ExcalidrawElementSkeleton[] = [];
  let edgeIndex = 0;

  for (const edge of declaredEdges) {
    const source = resolveTerraformPlanVertexId(nodes, edge.source);
    const target = resolveTerraformPlanVertexId(nodes, edge.target);
    if (!source || !target || source === target) {
      continue;
    }
    const sourceBox = layoutBoxes[source] as LayoutBox | undefined;
    const targetBox = layoutBoxes[target] as LayoutBox | undefined;
    if (!sourceBox || !targetBox) {
      continue;
    }

    const { startPoint, endPoint } = getPipelineClippedLine(
      sourceBox,
      targetBox,
    );
    const startX = startPoint.x;
    const startY = startPoint.y;
    const endX = endPoint.x;
    const endY = endPoint.y;
    const sequence =
      edge.detail != null && edge.detail !== ""
        ? Number(edge.detail)
        : edgeIndex;

    out.push({
      type: "arrow",
      id: `tf-pipeline-declared-dataflow-${edgeIndex}`,
      x: startX,
      y: startY,
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(endX - startX, endY - startY),
      ],
      strokeWidth: 3,
      strokeColor: TERRAFORM_DECLARED_DATAFLOW_EDGE_STROKE,
      strokeStyle: "solid",
      startArrowhead: null,
      endArrowhead: "arrow",
      roundness: null,
      startBinding: {
        elementId: source,
        fixedPoint: fixedPointForLayoutPoint(sourceBox, startPoint),
        mode: "orbit",
      },
      endBinding: {
        elementId: target,
        fixedPoint: fixedPointForLayoutPoint(targetBox, endPoint),
        mode: "orbit",
      },
      customData: {
        terraform: true,
        terraformPipelineOverview: true,
        terraformEdgeLayer: "declaredDataFlow",
        relationship: {
          source,
          target,
          type: edge.type,
          label: edge.label,
          origin: edge.origin,
          detail: edge.detail,
          sequence,
          directed: true,
          bidirectional: false,
          directions: [],
        },
      },
    });
    edgeIndex += 1;
  }

  return out;
}
