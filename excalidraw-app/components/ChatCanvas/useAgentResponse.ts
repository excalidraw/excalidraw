import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { chatMessagesAtom, isAgentLoadingAtom, agentErrorAtom } from "./atoms";
import { mockAgent } from "./mockAgent";
import { extractElementContext } from "./useSelectionContext";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { newElementWith } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type {
  AgentAction,
  AgentRequest,
  SelectionContextPayload,
} from "./types";

/**
 * Hook to handle agent responses and apply them to the canvas.
 */
export const useAgentResponse = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) => {
  const setMessages = useSetAtom(chatMessagesAtom);
  const setIsAgentLoading = useSetAtom(isAgentLoadingAtom);
  const setAgentError = useSetAtom(agentErrorAtom);

  const applyAgentActions = useCallback(
    async (actions: AgentAction[]) => {
      if (!excalidrawAPI || actions.length === 0) return;

      let currentElements = excalidrawAPI.getSceneElements();

      for (const action of actions) {
        currentElements = applyAction(action, excalidrawAPI, currentElements);
      }
    },
    [excalidrawAPI],
  );

  const handleAgentResponse = useCallback(
    async (message: string, context: SelectionContextPayload) => {
      if (!excalidrawAPI) return;

      setIsAgentLoading(true);
      setAgentError(null);

      try {
        const elements = excalidrawAPI.getSceneElements();
        const selectedElementIds = context.selectedElements || [];

        // Extract element details for the agent
        const elementDetails = extractElementContext(elements, selectedElementIds);

        // Prepare agent request
        const agentRequest: AgentRequest = {
          message,
          selectedElements: selectedElementIds,
          elementCount: selectedElementIds.length,
          elementDetails,
        };

        // Call the mock agent
        const response = await mockAgent(agentRequest);

        // Add assistant message to chat
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: response.message,
            timestamp: Date.now(),
            contextElements: selectedElementIds,
            actions: response.actions ?? [],
            applied: false,
          },
        ]);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An error occurred";
        setAgentError(errorMessage);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: `Error: ${errorMessage}`,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsAgentLoading(false);
      }
    },
    [excalidrawAPI, setMessages, setIsAgentLoading, setAgentError],
  );

  return { handleAgentResponse, applyAgentActions };
};

/**
 * Apply an agent action to the canvas.
 */
function applyAction(
  action: AgentAction,
  excalidrawAPI: ExcalidrawImperativeAPI,
  currentElements: readonly ExcalidrawElement[],
): ExcalidrawElement[] {
  const appState = excalidrawAPI.getAppState();
  const selectedElementIds = appState.selectedElementIds || {};
  const selectedIds = Object.keys(selectedElementIds).filter(
    (id) => selectedElementIds[id],
  );

  switch (action.type) {
    case "updateSelected": {
      // Update the selected elements with new properties
      const updatedElements = currentElements.map((el) => {
        if (selectedIds.includes(el.id)) {
          return newElementWith(el, action.payload);
        }
        return el;
      });

      excalidrawAPI.updateScene({
        elements: updatedElements,
      });
      return updatedElements;
    }

    case "addElements": {
      // Add new elements to the canvas
      const newElements = convertToExcalidrawElements(
        action.payload.elements,
        { regenerateIds: true },
      );
      const allElements = [...currentElements, ...newElements];

      excalidrawAPI.updateScene({
        elements: allElements,
      });
      return allElements;
    }

    case "deleteElements": {
      // Delete elements by ID
      const idsToDelete = action.payload.elementIds;
      const filteredElements = currentElements.filter(
        (el) => !idsToDelete.includes(el.id),
      );

      excalidrawAPI.updateScene({
        elements: filteredElements,
      });
      return filteredElements;
    }

    case "applyStyle": {
      // Apply style to selected elements
      const updatedElements = currentElements.map((el) => {
        if (selectedIds.includes(el.id)) {
          return newElementWith(el, action.payload.style);
        }
        return el;
      });

      excalidrawAPI.updateScene({
        elements: updatedElements,
      });
      return updatedElements;
    }

  }

  return [...currentElements];
}
