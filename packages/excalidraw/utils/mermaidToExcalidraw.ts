/**
 * Utility for converting Mermaid code to Excalidraw elements
 * Wraps the @excalidraw/mermaid-to-excalidraw package
 */

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "../types";

/**
 * Convert Mermaid code to Excalidraw elements
 */
export const convertMermaidToElements = async (
  mermaidCode: string,
): Promise<ExcalidrawElement[]> => {
  try {
    // Import the mermaid-to-excalidraw package dynamically
    const { parseMermaidToExcalidraw } = await import(
      "@excalidraw/mermaid-to-excalidraw"
    );

    // Parse mermaid code
    const { elements } = await parseMermaidToExcalidraw(mermaidCode);

    return elements as ExcalidrawElement[];
  } catch (error) {
    console.error("Failed to convert mermaid to excalidraw:", error);
    throw new Error(
      `Failed to convert diagram: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Insert elements into canvas at center of viewport
 */
export const insertElementsIntoCanvas = (
  elements: ExcalidrawElement[],
  appState: AppState,
  existingElements: readonly ExcalidrawElement[],
): {
  elements: ExcalidrawElement[];
  appState: AppState;
} => {
  // Calculate center of viewport
  const viewportCenter = {
    x: appState.scrollX + appState.width / 2,
    y: appState.scrollY + appState.height / 2,
  };

  // Calculate bounding box of new elements
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const element of elements) {
    minX = Math.min(minX, element.x);
    minY = Math.min(minY, element.y);
    maxX = Math.max(maxX, element.x + element.width);
    maxY = Math.max(maxY, element.y + element.height);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Offset to center
  const offsetX = viewportCenter.x - centerX;
  const offsetY = viewportCenter.y - centerY;

  // Apply offset to all elements
  const positionedElements = elements.map((element) => ({
    ...element,
    x: element.x + offsetX,
    y: element.y + offsetY,
  }));

  // Combine with existing elements
  const allElements = [...existingElements, ...positionedElements];

  // Select newly inserted elements
  const selectedElementIds = positionedElements.reduce(
    (acc, element) => {
      acc[element.id] = true;
      return acc;
    },
    {} as Record<string, true>,
  );

  return {
    elements: allElements,
    appState: {
      ...appState,
      selectedElementIds,
    },
  };
};
