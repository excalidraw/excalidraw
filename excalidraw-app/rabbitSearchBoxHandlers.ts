import { useEffect } from "react";
import { newElementWith } from "@excalidraw/element";
import { isRabbitSearchBoxElement } from "@excalidraw/element/rabbitElement";
import type { RabbitSearchBoxElement } from "@excalidraw/element/rabbitElement";
import { getSearchBoxText } from "@excalidraw/element/newRabbitElement";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

// Custom hook to handle RabbitSearchBox interactions
export const useRabbitSearchBoxHandlers = (
  excalidrawAPI: ExcalidrawImperativeAPI | null
) => {
  useEffect(() => {
    if (!excalidrawAPI) return;

    let editingSearchBoxId: string | null = null;

    let lastClickTime = 0;
    let lastClickId: string | null = null;
    
    // Function to handle clicks on search boxes
    const handlePointerUp = (event: MouseEvent) => {
      if (!excalidrawAPI) return;
      
      // Get current state and elements
      const appState = excalidrawAPI.getAppState();
      const elements = excalidrawAPI.getSceneElements();
      
      // single selected element
      const selectedIds = Object.keys(appState.selectedElementIds || {});
      if (selectedIds.length !== 1) return;
      
      const selectedId = selectedIds[0];
      const selectedElement = elements.find(el => el.id === selectedId);
      
      // Check if it's a rabbit search box
      if (!selectedElement || !isRabbitSearchBoxElement(selectedElement)) return;
      
      const currentTime = new Date().getTime();
      const isDoubleClick = currentTime - lastClickTime < 300 && lastClickId === selectedId;
      
      if (isDoubleClick) {
        const updatedElement = newElementWith(selectedElement, {
          isEditing: !selectedElement.isEditing
        });
        
        // Track which element is being edited
        if (updatedElement.isEditing) {
          editingSearchBoxId = selectedElement.id;
        //getSearchBoxText(updatedElement);
        } else {
          editingSearchBoxId = null;
        }
        
        // Update the scene
        excalidrawAPI.updateScene({
          elements: elements.map(el => 
            el.id === selectedElement.id ? updatedElement : el
          )
        });
        
        const refreshInterval = setInterval(() => {
          excalidrawAPI.refresh();
        }, 500);
        
        // Clear interval when editing stops
        if (!updatedElement.isEditing) {
          clearInterval(refreshInterval);
        }
      }
      
      //double-click detection
      lastClickTime = currentTime;
      lastClickId = selectedId;
    };
    
    // Function to handle keyboard input when editing
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!excalidrawAPI || !editingSearchBoxId) return;
      
      const elements = excalidrawAPI.getSceneElements();
      const editingElement = elements.find(el => el.id === editingSearchBoxId);
      
      if (!editingElement || !isRabbitSearchBoxElement(editingElement) || !editingElement.isEditing) return;
      
      const key = event.key;
      let updatedElement: RabbitSearchBoxElement;
      
      if (key === "Escape") {
        updatedElement = newElementWith(editingElement, {
          isEditing: false,
          currentText: editingElement.text 
        });
        editingSearchBoxId = null;
      } else if (key === "Enter") {
        // Confirm changes
        updatedElement = newElementWith(editingElement, {
          isEditing: false,
          text: editingElement.currentText // Update original text with current input
        });
        
        getSearchBoxText(updatedElement);
        editingSearchBoxId = null;
      } else if (key === "Backspace") {
        // Handle backspace
        updatedElement = newElementWith(editingElement, {
          currentText: editingElement.currentText.slice(0, -1)
        });
      } else if (key.length === 1) {
        // Add typed characters
        updatedElement = newElementWith(editingElement, {
          currentText: editingElement.currentText + key
        });
      } else {
        // Not a key we handle
        return;
      }
      
      //update the scene with the modified element
      excalidrawAPI.updateScene({
        elements: elements.map(el => 
          el.id === editingElement.id ? updatedElement : el
        )
      });
      
      event.preventDefault();
    };
    
    // Register event listeners
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("keydown", handleKeyDown);
    
    return () => {
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [excalidrawAPI]);
};