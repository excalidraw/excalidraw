/**
 * AIFeatureIntegration
 *
 * Integration component for AI features.
 * Renders dialogs and handles mermaid-to-excalidraw conversion.
 */

import React from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  convertMermaidToElements,
  insertElementsIntoCanvas,
} from "../utils/mermaidToExcalidraw";

import { AIConfigurationDialog } from "./AIConfigurationDialog";
import { ImageToMermaidDialog } from "./ImageToMermaidDialog";

import type { AppState } from "../types";

interface AIFeatureIntegrationProps {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  onElementsChange: (elements: ExcalidrawElement[]) => void;
  onAppStateChange: (appState: Partial<AppState>) => void;
}

export const AIFeatureIntegration: React.FC<AIFeatureIntegrationProps> = ({
  elements,
  appState,
  onElementsChange,
  onAppStateChange,
}) => {
  const handleInsertMermaid = async (mermaidCode: string) => {
    try {
      // Convert mermaid to excalidraw elements
      const newElements = await convertMermaidToElements(mermaidCode);

      // Insert into canvas
      const { elements: updatedElements, appState: updatedAppState } =
        insertElementsIntoCanvas(newElements, appState, elements);

      // Update app
      onElementsChange(updatedElements);
      onAppStateChange(updatedAppState);
    } catch (error) {
      console.error("Failed to insert mermaid diagram:", error);
      alert(
        `Failed to insert diagram: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  };

  return (
    <>
      <AIConfigurationDialog />
      <ImageToMermaidDialog onInsertMermaid={handleInsertMermaid} />
    </>
  );
};
