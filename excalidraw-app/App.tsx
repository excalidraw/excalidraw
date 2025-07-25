import { Excalidraw, WelcomeScreen } from "@excalidraw/excalidraw";

import { useState, useCallback, useEffect } from "react";

import type { ExcalidrawImperativeAPI, AppState } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement, NonDeletedExcalidrawElement, StrokeStyle } from "@excalidraw/element/types";

import { PropertiesSidebar } from "./components/PropertiesSidebar";

const App = () => {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [selectedElement, setSelectedElement] =
    useState<NonDeletedExcalidrawElement | null>(null);

  const handleCanvasChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      if (!excalidrawAPI) {
        return;
      }

      // 1. Initialisiere customData für neue Elemente
      let currentElements = elements.map((el) => {
        if (el.type === "rectangle" && el.customData === undefined) {
          return {
            ...el,
            customData: {
              isCard: false,
              isZone: false,
              cardType: "",
              acceptedCardTypes: "",
            },
          };
        }
        return el;
      });

      // 2. Spielzustand prüfen (Logik von checkGameState)
      const cards = currentElements.filter((el) => el.customData?.isCard);
      let needsUpdate = false;

      const updatedElementsAfterGameStateCheck = currentElements.map((el) => {
        if (!el.customData?.isZone) {
          return el;
        }

        const acceptedTypes = (el.customData.acceptedCardTypes || "")
          .split(",")
          .filter(Boolean);
        if (acceptedTypes.length === 0) {
          return el;
        }

        const cardsInZone = cards.filter(
          (card) =>
            card.x > el.x &&
            card.x < el.x + el.width &&
            card.y > el.y &&
            card.y < el.y + el.height,
        );

        const isCorrect =
          cardsInZone.length > 0 &&
          cardsInZone.every((card) =>
            acceptedTypes.includes(card.customData?.cardType),
          );
        const newBackgroundColor = isCorrect ? "#aaffaa" : "#ffaaaa";

        if (el.backgroundColor !== newBackgroundColor) {
          needsUpdate = true;
          return { ...el, backgroundColor: newBackgroundColor };
        }
        return el;
      });

      if (needsUpdate) {
        currentElements = updatedElementsAfterGameStateCheck;
      }

      // 3. Update des ausgewählten Elements für die Sidebar
      if (
        appState.selectedElementIds &&
        Object.keys(appState.selectedElementIds).length === 1
      ) {
        const selectedId = Object.keys(appState.selectedElementIds)[0];
        const element = currentElements.find((el) => el.id === selectedId);
        if (element && (element.customData?.isCard || element.customData?.isZone)) {
          setSelectedElement(element as NonDeletedExcalidrawElement);
        } else {
          setSelectedElement(null);
        }
      } else {
        setSelectedElement(null);
      }

      // Nur updaten, wenn sich was geändert hat
      if (JSON.stringify(elements) !== JSON.stringify(currentElements)) {
        excalidrawAPI?.updateScene({ elements: currentElements });
      }
    },
    [excalidrawAPI],
  );

  const handleUpdateElement = (updatedData: any) => {
    if (!excalidrawAPI || !selectedElement) {
      return;
    }

    const sceneElements = excalidrawAPI.getSceneElements();
    const elementIndex = sceneElements.findIndex(
      (el) => el.id === selectedElement.id,
    );
    if (elementIndex === -1) {
      return;
    }

    const newCustomData = { ...selectedElement.customData, ...updatedData };

    const updatedElement = {
      ...selectedElement,
      customData: newCustomData,
      strokeStyle: (newCustomData.isZone ? "dashed" : "solid") as StrokeStyle,
      backgroundColor: selectedElement.backgroundColor, // Behalte die aktuelle Farbe bei, checkGameState kümmert sich darum
    };

    const newSceneElements = [
      ...sceneElements.slice(0, elementIndex),
      updatedElement,
      ...sceneElements.slice(elementIndex + 1),
    ];

    excalidrawAPI.updateScene({ elements: newSceneElements });
    setSelectedElement(updatedElement as NonDeletedExcalidrawElement);
    checkGameState(newSceneElements); // Spielzustand sofort prüfen
  };

  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw
        excalidrawAPI={setExcalidrawAPI}
        onChange={handleCanvasChange}
        renderTopRightUI={() => (
          <div style={{ padding: "10px" }}>
            {selectedElement && (
              <PropertiesSidebar
                element={selectedElement}
                onUpdate={handleUpdateElement}
              />
            )}
          </div>
        )}
      >
          <WelcomeScreen />
        </Excalidraw>
    </div>
  );
};

export default App;
