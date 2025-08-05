import { Excalidraw, WelcomeScreen } from "@excalidraw/excalidraw";

import { useState, useCallback, useEffect } from "react";

import type {
  ExcalidrawImperativeAPI,
  AppState,
} from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  StrokeStyle,
} from "@excalidraw/excalidraw/types";

import { PropertiesSidebar } from "./components/PropertiesSidebar";
import { GamifyToolbar } from "./components/GamifyToolbar";
const App = () => {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [selectedElement, setSelectedElement] =
    useState<NonDeletedExcalidrawElement | null>(null);

  const checkGameState = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      if (!excalidrawAPI) {
        return;
      }

      const cards = elements.filter((el) => el.customData?.isCard);
      let needsUpdate = false;

      const updatedElements = elements.map((el) => {
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
        excalidrawAPI.updateScene({ elements: updatedElements });
      }
    },
    [excalidrawAPI],
  );

  const handleCanvasChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      if (!excalidrawAPI) {
        return;
      }

      // Update des ausgewählten Elements für die Sidebar
      if (
        appState.selectedElementIds &&
        Object.keys(appState.selectedElementIds).length === 1
      ) {
        const selectedId = Object.keys(appState.selectedElementIds)[0];
        const element = elements.find((el) => el.id === selectedId);
        if (element) {
          setSelectedElement(element as NonDeletedExcalidrawElement);
        } else {
          setSelectedElement(null);
        }
      } else {
        setSelectedElement(null);
      }
    },
    [excalidrawAPI],
  );

  const handlePointerUp = useCallback(() => {
    if (excalidrawAPI) {
      checkGameState(excalidrawAPI.getSceneElements());
    }
  }, [excalidrawAPI, checkGameState]);

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
  };

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    const elements = excalidrawAPI.getSceneElements();
    const elementsToUpdate: ExcalidrawElement[] = [];

    elements.forEach((el) => {
      if (
        (el.type === "rectangle" || el.type === "diamond") &&
        el.customData === undefined
      ) {
        elementsToUpdate.push({
          ...el,
          customData: {
            isCard: false,
            isZone: false,
            cardType: "",
            acceptedCardTypes: "",
          },
        });
      }
    });

    if (elementsToUpdate.length > 0) {
      excalidrawAPI.updateScene({ elements: elementsToUpdate });
    }
  }, [excalidrawAPI]);

  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw
        excalidrawAPI={setExcalidrawAPI}
        onChange={handleCanvasChange}
        onPointerUp={handlePointerUp}
        renderTopRightUI={() => (
          <div style={{ padding: "10px" }}>
            {excalidrawAPI && <GamifyToolbar excalidrawAPI={excalidrawAPI} />}
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