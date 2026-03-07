import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { selectionContextAtom } from "./atoms";
import { isTextElement } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ElementContext } from "./types";

/**
 * Hook to track selected elements from Excalidraw API and update the selection context atom.
 * This enables the chat panel to know which elements are currently selected on the canvas.
 */
export const useSelectionContext = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) => {
  const setSelectionContext = useSetAtom(selectionContextAtom);

  useEffect(() => {
    if (!excalidrawAPI) return;

    // Get the initial selection state
    const updateSelectionContext = () => {
      const appState = excalidrawAPI.getAppState();
      const selectedElementIds = appState.selectedElementIds || {};
      const selectedIds = Object.keys(selectedElementIds).filter(
        (id) => selectedElementIds[id],
      );

      setSelectionContext({
        elementIds: selectedIds,
        count: selectedIds.length,
      });
    };

    // Update on initial mount
    updateSelectionContext();

    // Subscribe to changes using the change callback
    // Note: Excalidraw API doesn't have a direct selection change event,
    // so we'll use a polling approach with a reasonable interval
    const intervalId = setInterval(updateSelectionContext, 200);

    return () => {
      clearInterval(intervalId);
    };
  }, [excalidrawAPI, setSelectionContext]);
};

/**
 * Helper function to extract element details for sending to the agent.
 * This creates a structured payload of the selected elements.
 */
export const extractElementContext = (
  elements: readonly ExcalidrawElement[],
  selectedElementIds: string[],
): ElementContext[] => {
  return selectedElementIds
    .map((id) => {
      const element = elements.find((el) => el.id === id);
      if (!element) return null;

      const baseContext: ElementContext = {
        id: element.id,
        type: element.type,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        angle: element.angle,
        strokeColor: element.strokeColor,
        backgroundColor: element.backgroundColor,
        fillStyle: element.fillStyle,
        strokeWidth: element.strokeWidth,
        frameId: element.frameId,
        groupIds: element.groupIds,
      };

      if (isTextElement(element)) {
        return {
          ...baseContext,
          text: element.text,
          fontSize: element.fontSize,
          fontFamily: element.fontFamily,
          textAlign: element.textAlign,
        };
      }

      if ("text" in element && typeof element.text === "string") {
        return {
          ...baseContext,
          text: element.text,
        };
      }

      return baseContext;
    })
    .filter((context): context is ElementContext => context !== null);
};
