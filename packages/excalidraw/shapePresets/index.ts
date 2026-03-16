import { pointFrom, pointDistance } from "@excalidraw/math";
import { isLineElement } from "@excalidraw/element/typeChecks";
import { LinearElementEditor } from "@excalidraw/element/linearElementEditor";

import type { GlobalPoint } from "@excalidraw/math";
import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ElementsMap,
} from "@excalidraw/element/types";

import type { AppState } from "../types";

export {
  isPolyPresetType,
  POLY_PRESET_TYPES,
} from "@excalidraw/element/polyPresets";

export const SOLID_PRESET_TYPES = new Set([
  "prism",
  "pyramid",
  "tetrahedron",
  "cylinder",
  "sphere",
]);

export const isSolidPresetType = (type: string): boolean =>
  SOLID_PRESET_TYPES.has(type);

// ─── Wireframe group utilities ─────────────────────────────────────

export interface WireframeVertex {
  vertexId: string;
  globalPoint: GlobalPoint;
  elementId: string;
  pointIndex: number;
}

/** Check if all elements sharing a groupId are wireframe lines (have sharedVertices) */
export const isWireframeGroup = (
  groupId: string,
  allElements: readonly ExcalidrawElement[],
): boolean => {
  const members = allElements.filter((el) => el.groupIds?.includes(groupId));
  if (members.length === 0) {
    return false;
  }
  // At least some line elements must have sharedVertices
  return members.some((el) => isLineElement(el) && (el as any).sharedVertices);
};

/** Collect unique vertices from all wireframe elements in a group */
export const getWireframeVertices = (
  groupId: string,
  allElements: readonly ExcalidrawElement[],
  elementsMap: ElementsMap,
): Map<string, WireframeVertex> => {
  const vertices = new Map<string, WireframeVertex>();
  for (const el of allElements) {
    if (
      !el.groupIds?.includes(groupId) ||
      !isLineElement(el) ||
      !(el as any).sharedVertices
    ) {
      continue;
    }
    const linEl = el as ExcalidrawLinearElement;
    const sv = (el as any).sharedVertices as Record<number, string>;
    const globalPts = LinearElementEditor.getPointsGlobalCoordinates(
      linEl,
      elementsMap,
    );
    for (const [idxStr, vertexId] of Object.entries(sv)) {
      const idx = Number(idxStr);
      if (idx < globalPts.length && !vertices.has(vertexId)) {
        vertices.set(vertexId, {
          vertexId,
          globalPoint: globalPts[idx],
          elementId: el.id,
          pointIndex: idx,
        });
      }
    }
  }
  return vertices;
};

/** Hit test: find wireframe vertex near a scene position */
export const getWireframeVertexAtPosition = (
  groupId: string,
  allElements: readonly ExcalidrawElement[],
  elementsMap: ElementsMap,
  sceneX: number,
  sceneY: number,
  zoom: AppState["zoom"],
): WireframeVertex | null => {
  const vertices = getWireframeVertices(groupId, allElements, elementsMap);
  // Use vertex handle visual radius + small padding as threshold
  const handleRadius = LinearElementEditor.POINT_HANDLE_SIZE / 2;
  const threshold = (handleRadius + 2) / zoom.value;

  let closest: WireframeVertex | null = null;
  let closestDist = Infinity;

  for (const vertex of vertices.values()) {
    const dist = pointDistance(
      pointFrom<GlobalPoint>(sceneX, sceneY),
      vertex.globalPoint,
    );
    if (dist < threshold && dist < closestDist) {
      closest = vertex;
      closestDist = dist;
    }
  }
  return closest;
};
