import { useEffect } from "react";
import { newElementWith } from "@excalidraw/element";
import { isRabbitSearchBoxElement } from "@excalidraw/element/rabbitElement";
import { getSearchBoxText } from "@excalidraw/element/newRabbitElement";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { RabbitSearchBoxElement } from "@excalidraw/element/rabbitElement";

export const useRabbitSearchBoxHandlers = (
  excalidrawAPI: ExcalidrawImperativeAPI | null
) => {
  useEffect(() => {
    if (!excalidrawAPI) return;

    // Keep track of which search box is being edited
    let editingSearchBoxId: string | null = null;

    // Double-click detection helpers
    let lastClickTime = 0;
    let lastClickId: string | null = null;
    
    // Function to handle clicks on search boxes
    const handlePointerUp = (event: MouseEvent) => {
      if (!excalidrawAPI) return;
      
      // Get current state and elements
      const appState = excalidrawAPI.getAppState();
      const elements = excalidrawAPI.getSceneElements();
      
      // Check if there's a single selected element
      const selectedIds = Object.keys(appState.selectedElementIds || {});
      if (selectedIds.length !== 1) return;
      
      const selectedId = selectedIds[0];
      const selectedElement = elements.find(el => el.id === selectedId);
      
      // Check if it's a rabbit search box
      if (!selectedElement || !isRabbitSearchBoxElement(selectedElement)) return;
      
      // Double-click detection (toggle editing on double click)
      const currentTime = new Date().getTime();
      const isDoubleClick = currentTime - lastClickTime < 300 && lastClickId === selectedId;
      
      if (isDoubleClick) {
        // If currently not editing and text is the placeholder, clear it when entering edit mode
        const shouldClearPlaceholder = 
          !selectedElement.isEditing && 
          (selectedElement.currentText === "Search..." || selectedElement.currentText.trim() === "");
        
        const updatedElement = newElementWith(selectedElement, {
          isEditing: !selectedElement.isEditing,
          // Clear the currentText if it's the placeholder and we're entering edit mode
          ...(shouldClearPlaceholder ? { currentText: "" } : {})
        });
        
        if (updatedElement.isEditing) {
          editingSearchBoxId = selectedElement.id;
          if (selectedElement.currentText !== "Search..." && selectedElement.currentText.trim() !== "") {
            getSearchBoxText(updatedElement);
          }
        } else {
          editingSearchBoxId = null;
        }
        
        excalidrawAPI.updateScene({
          elements: elements.map(el => 
            el.id === selectedElement.id ? updatedElement : el
          )
        });
      }
      
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
        // Cancel editing
        const finalText = editingElement.currentText.trim() === "" ? "Search..." : editingElement.currentText;

        updatedElement = newElementWith(editingElement, {
          isEditing: false,
          currentText: editingElement.text, //restore original text
          text: finalText //placeholder text
        });
        editingSearchBoxId = null;
      } else if (key === "Enter") {
        // Confirm changes
        updatedElement = newElementWith(editingElement, {
          isEditing: false,
          text: editingElement.currentText 
        });
        
        
        getSearchBoxText(updatedElement);
        editingSearchBoxId = null;
      } else if (key === "Backspace") {
        updatedElement = newElementWith(editingElement, {
          currentText: editingElement.currentText.slice(0, -1)
        });
      } else if (key.length === 1) {
        updatedElement = newElementWith(editingElement, {
          currentText: editingElement.currentText + key
        });
      } else {
        return;
      }
      
      excalidrawAPI.updateScene({
        elements: elements.map(el => 
          el.id === editingElement.id ? updatedElement : el
        )
      });
      
      event.preventDefault();
    };
    
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("keydown", handleKeyDown);
    
    return () => {
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [excalidrawAPI]);
};