import { useCallback } from "react";
import { loadTemplate, type Template } from "./templates";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * Hook to handle template loading and applying to the canvas.
 */
export const useTemplateLoader = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) => {
  const handleLoadTemplate = useCallback(
    async (template: Template) => {
      if (!excalidrawAPI) return;

      // Get the template elements
      const templateElements = loadTemplate(template.id);
      if (!templateElements) {
        console.error(`Template ${template.id} not found`);
        return;
      }

      // Get current elements
      const currentElements = excalidrawAPI.getSceneElements();
      const hydratedElements = convertToExcalidrawElements(templateElements, {
        regenerateIds: true,
      });

      // Ask user if they want to replace or append
      // For now, we'll append the template elements
      const newElements = [...currentElements, ...hydratedElements];

      // Update the scene with new elements
      excalidrawAPI.updateScene({
        elements: newElements,
      });

      // Optionally scroll to the new elements
      excalidrawAPI.scrollToContent(hydratedElements);

      console.log(`Loaded template: ${template.name}`);
    },
    [excalidrawAPI],
  );

  return handleLoadTemplate;
};
