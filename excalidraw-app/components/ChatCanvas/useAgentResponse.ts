import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { chatMessagesAtom, isAgentLoadingAtom, agentErrorAtom } from "./atoms";
import { mockAgent, type AgentRequest, type AgentResponse } from "./mockAgent";
import { extractElementContext } from "./useSelectionContext";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * Hook to handle agent responses and apply them to the canvas.
 */
export const useAgentResponse = (excalidrawAPI: ExcalidrawImperativeAPI | null) => {
  const setMessages = useSetAtom(chatMessagesAtom);
  const setIsAgentLoading = useSetAtom(isAgentLoadingAtom);
  const setAgentError = useSetAtom(agentErrorAtom);

  const handleAgentResponse = useCallback(
    async (message: string, context: any) => {
      if (!excalidrawAPI) return;

      setIsAgentLoading(true);
      setAgentError(null);

      try {
        const appState = excalidrawAPI.getAppState();
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
          },
        ]);

        // Apply actions to the canvas
        if (response.actions && response.actions.length > 0) {
          for (const action of response.actions) {
            await applyAction(action, excalidrawAPI, elements);
          }
        }
      } catch (error: any) {
        const errorMessage = error?.message || "An error occurred";
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
    [excalidrawAPI, setMessages, setIsAgentLoading, setAgentError]
  );

  return handleAgentResponse;
};

/**
 * Apply an agent action to the canvas.
 */
async function applyAction(
  action: any,
  excalidrawAPI: ExcalidrawImperativeAPI,
  currentElements: any[]
) {
  const appState = excalidrawAPI.getAppState();
  const selectedElementIds = appState.selectedElementIds || {};
  const selectedIds = Object.keys(selectedElementIds).filter(
    (id) => selectedElementIds[id]
  );

  switch (action.type) {
    case "updateSelected": {
      // Update the selected elements with new properties
      const updatedElements = currentElements.map((el) => {
        if (selectedIds.includes(el.id)) {
          return {
            ...el,
            ...action.payload,
            versionTag: el.versionTag ? el.versionTag + 1 : 1,
          };
        }
        return el;
      });

      excalidrawAPI.updateScene({
        elements: updatedElements,
      });
      break;
    }

    case "addElements": {
      // Add new elements to the canvas
      const newElements = action.payload.elements || [];
      const allElements = [...currentElements, ...newElements];

      excalidrawAPI.updateScene({
        elements: allElements,
      });
      break;
    }

    case "deleteElements": {
      // Delete elements by ID
      const idsToDelete = action.payload.elementIds || [];
      const filteredElements = currentElements.filter(
        (el) => !idsToDelete.includes(el.id)
      );

      excalidrawAPI.updateScene({
        elements: filteredElements,
      });
      break;
    }

    case "applyStyle": {
      // Apply style to selected elements
      const updatedElements = currentElements.map((el) => {
        if (selectedIds.includes(el.id)) {
          return {
            ...el,
            ...action.payload.style,
            versionTag: el.versionTag ? el.versionTag + 1 : 1,
          };
        }
        return el;
      });

      excalidrawAPI.updateScene({
        elements: updatedElements,
      });
      break;
    }

    default:
      console.warn(`Unknown action type: ${action.type}`);
  }
}
