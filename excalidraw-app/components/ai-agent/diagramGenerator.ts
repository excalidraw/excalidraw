import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  getNonDeletedElements,
} from "@excalidraw/excalidraw";
import { getCommonBounds } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import type { AgentCursorController } from "./agentCursorController";
import type { DiagramInsertionResult } from "./types";

export interface ParsedDiagram {
  elements: readonly NonDeletedExcalidrawElement[];
  files?: any;
}

/**
 * Parses Mermaid code into Excalidraw elements using @excalidraw/mermaid-to-excalidraw
 */
export const parseMermaidCode = async (
  rawCode: string,
): Promise<ParsedDiagram> => {
  let cleanCode = rawCode.trim();
  // Strip ```mermaid or ``` if included
  if (cleanCode.startsWith("```")) {
    cleanCode = cleanCode
      .replace(/^```(?:mermaid)?\s*\n?/i, "")
      .replace(/\n?```$/i, "");
  }

  const { parseMermaidToExcalidraw } = await import(
    "@excalidraw/mermaid-to-excalidraw"
  );

  let result;
  try {
    result = await parseMermaidToExcalidraw(cleanCode, {
      elbow: { flowchart: true },
    });
  } catch (firstErr) {
    // Retry with single-quote replacement if quotes caused a parsing syntax error
    if (cleanCode.includes('"')) {
      try {
        result = await parseMermaidToExcalidraw(cleanCode.replace(/"/g, "'"), {
          elbow: { flowchart: true },
        });
      } catch {
        throw firstErr;
      }
    } else {
      throw firstErr;
    }
  }

  const converted = convertToExcalidrawElements(result.elements, {
    regenerateIds: true,
  });

  return {
    elements: converted,
    files: result.files,
  };
};

/**
 * Calculates optimal scene coordinates to insert the diagram
 */
const calculatePlacementCoordinates = (
  api: ExcalidrawImperativeAPI,
  diagramWidth: number,
  diagramHeight: number,
): { x: number; y: number } => {
  const appState = api.getAppState();
  const zoom = appState.zoom.value || 1;
  const viewCenterX = -appState.scrollX + appState.width / 2 / zoom;
  const viewCenterY = -appState.scrollY + appState.height / 2 / zoom;

  const existingElements = getNonDeletedElements(api.getSceneElements());

  if (existingElements.length === 0) {
    return {
      x: Math.round(viewCenterX - diagramWidth / 2),
      y: Math.round(viewCenterY - diagramHeight / 2),
    };
  }

  const [minX, minY, maxX, maxY] = getCommonBounds(existingElements);

  // Check if viewport center is sufficiently outside the existing elements bounds
  const margin = 120;
  const isOutsideExisting =
    viewCenterX + diagramWidth / 2 < minX - margin ||
    viewCenterX - diagramWidth / 2 > maxX + margin ||
    viewCenterY + diagramHeight / 2 < minY - margin ||
    viewCenterY - diagramHeight / 2 > maxY + margin;

  if (isOutsideExisting) {
    return {
      x: Math.round(viewCenterX - diagramWidth / 2),
      y: Math.round(viewCenterY - diagramHeight / 2),
    };
  }

  // Otherwise, place to the right of the existing diagram
  return {
    x: Math.round(maxX + 100),
    y: Math.round(minY),
  };
};

/**
 * Repositions elements to the target scene coordinates
 */
const repositionElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  targetX: number,
  targetY: number,
): readonly NonDeletedExcalidrawElement[] => {
  const [minX, minY] = getCommonBounds(elements);
  const deltaX = targetX - minX;
  const deltaY = targetY - minY;

  return elements.map((element) => {
    const updated = {
      ...element,
      x: Math.round(element.x + deltaX),
      y: Math.round(element.y + deltaY),
    } as any;

    if (element.boundElements) {
      updated.boundElements = [...element.boundElements];
    }
    return updated;
  });
};

/**
 * Inserts the parsed diagram into Excalidraw, choreographing the AI collaborator cursor
 * to glide across the canvas, trace the outline, add elements, and highlight selection.
 */
export const insertDiagramWithAgentCursor = async ({
  api,
  cursorController,
  parsed,
}: {
  api: ExcalidrawImperativeAPI;
  cursorController: AgentCursorController;
  parsed: ParsedDiagram;
}): Promise<DiagramInsertionResult> => {
  const elements = parsed.elements;
  if (!elements || elements.length === 0) {
    throw new Error("No elements generated from diagram");
  }

  const [origMinX, origMinY, origMaxX, origMaxY] = getCommonBounds(elements);
  const diagramWidth = Math.max(origMaxX - origMinX, 100);
  const diagramHeight = Math.max(origMaxY - origMinY, 100);

  // Determine target coordinates
  const { x: targetX, y: targetY } = calculatePlacementCoordinates(
    api,
    diagramWidth,
    diagramHeight,
  );

  // Offset elements to new target position
  const positionedElements = repositionElements(elements, targetX, targetY);
  const [newMinX, newMinY, newMaxX, newMaxY] =
    getCommonBounds(positionedElements);

  // Choreograph cursor drawing gesture:
  // 1. Move to start position
  await cursorController.animateMoveTo(newMinX - 20, newMinY - 20, 350);

  // 2. Trace the bounding frame with laser
  const drawingPath = [
    { x: newMinX, y: newMinY },
    { x: newMaxX, y: newMinY },
    { x: newMaxX, y: newMaxY },
    { x: newMinX, y: newMaxY },
    { x: newMinX, y: newMinY },
  ];
  await cursorController.animateDrawingGesture(drawingPath, 650);

  // 3. Commit elements to Excalidraw scene with immediate undo history capture
  const currentElements = api.getSceneElements();
  api.updateScene({
    elements: [...currentElements, ...positionedElements],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });

  if (parsed.files) {
    api.addFiles(parsed.files);
  }

  const createdIds = positionedElements.map((el) => el.id);

  // 4. Highlight elements with the agent's collaborator cursor selection
  cursorController.selectElements(createdIds);

  // 5. Navigate viewport smoothly to frame the new diagram
  api.setViewport({
    target: positionedElements as unknown as readonly ExcalidrawElement[],
    fit: "scale-down",
    animation: true,
  });

  // 6. After a short highlight period, move cursor to idle position near top-right
  cursorController.scheduleTimeout(() => {
    cursorController.clearSelection();
    cursorController.animateMoveTo(newMaxX + 40, newMinY - 20, 300);
  }, 1200);

  return {
    elementIds: createdIds,
    bounds: [newMinX, newMinY, newMaxX, newMaxY],
  };
};
