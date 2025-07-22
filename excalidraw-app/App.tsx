// Datei: /var/www/gamifyboard/excalidraw-app/App.tsx

import React, { useState, useCallback } from "react";

import { Excalidraw, MainMenu, WelcomeScreen } from "@excalidraw/excalidraw";

import type {
  NonDeletedExcalidrawElement,
  ExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  ExcalidrawImperativeAPI,
  AppState,
} from "@excalidraw/excalidraw/types";

// Importieren Sie Ihre GamifyToolbar-Komponente
import { GamifyToolbar } from "./components/GamifyToolbar";
import { TopErrorBoundary } from "./components/TopErrorBoundary";
import PropertiesSidebar from "./components/PropertiesSidebar";

// Hilfsfunktion, um zu prüfen, ob sich zwei GameState-Objekte unterscheiden.
const areGameStatesDifferent = (
  oldState: Record<string, boolean>,
  newState: Record<string, boolean>,
): boolean => {
  const oldKeys = Object.keys(oldState);
  const newKeys = Object.keys(newState);

  if (oldKeys.length !== newKeys.length) {
    return true;
  }

  for (const key of oldKeys) {
    if (oldState[key] !== newState[key]) {
      return true;
    }
  }

  return false;
};

const App = () => {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [gameState, setGameState] = useState<Record<string, boolean>>({});
  const [selectedElement, setSelectedElement] =
    useState<NonDeletedExcalidrawElement | null>(null);

  const checkGameState = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }

    const elements = excalidrawAPI.getSceneElements();
    const newGameState: Record<string, boolean> = {};
    let sceneUpdated = false;

    const updatedElements = elements.map((element) => {
      if (element.customData?.isZone) {
        const zone = element;
        if (!zone.customData?.id || !zone.customData?.accepts) {
          return element;
        }

        const zoneId = zone.customData.id;
        const acceptedCardId = zone.customData.accepts;
        const card = elements.find(
          (el: NonDeletedExcalidrawElement) =>
            el.customData?.id === acceptedCardId,
        );
        let isSolved = false;

        if (card) {
          isSolved =
            card.x >= zone.x &&
            card.x + card.width <= zone.x + zone.width &&
            card.y >= zone.y &&
            card.y + card.height <= zone.y + zone.height;
        }

        newGameState[zoneId] = isSolved;

        const newBackgroundColor = isSolved ? "#d4edda" : "transparent";

        if (zone.backgroundColor !== newBackgroundColor) {
          sceneUpdated = true;
          return {
            ...zone,
            backgroundColor: newBackgroundColor,
          };
        }
      }
      return element;
    });

    setGameState((prevGameState) => {
      if (areGameStatesDifferent(prevGameState, newGameState)) {
        return newGameState;
      }
      return prevGameState;
    });

    if (sceneUpdated) {
      excalidrawAPI.updateScene({
        elements: updatedElements,
      });
    }
  }, [excalidrawAPI, setGameState]);

  const handleCanvasChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      if (
        appState.selectedElementIds &&
        Object.keys(appState.selectedElementIds).length === 1
      ) {
        const selectedId = Object.keys(appState.selectedElementIds)[0];
        const element = elements.find((el) => el.id === selectedId);
        if (
          element &&
          (element.customData?.isCard || element.customData?.isZone)
        ) {
          setSelectedElement(element as NonDeletedExcalidrawElement);
        } else {
          setSelectedElement(null);
        }
      } else {
        setSelectedElement(null);
      }
    },
    [],
  );

  const handleUpdateElement = (updatedData: any) => {
    if (!excalidrawAPI || !selectedElement) return;

    const updatedElement = {
      ...selectedElement,
      customData: { ...selectedElement.customData, ...updatedData },
    };
    excalidrawAPI.updateScene({
      elements: [updatedElement],
      commitToHistory: true,
    });
    setSelectedElement(updatedElement as NonDeletedExcalidrawElement);
  };

  return (
    <TopErrorBoundary>
      <div style={{ height: "100vh" }}>
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          onPointerUp={checkGameState}
          onChange={handleCanvasChange}
          renderTopRightUI={() => (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "0.5rem",
                padding: "0.5rem",
              }}
            >
              {excalidrawAPI && <GamifyToolbar excalidrawAPI={excalidrawAPI} />}
              <div
                style={{
                  background: "rgba(255, 255, 240, 0.9)",
                  padding: "0.5rem 1rem",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                  minWidth: "150px",
                }}
              >
                <strong>Spielstatus:</strong>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "0.5rem 0 0 0",
                  }}
                >
                  {Object.entries(gameState).map(([zoneId, isSolved]) => (
                    <li key={zoneId}>
                      {zoneId.substring(0, 8)}...:{" "}
                      {isSolved ? "✅ Gelöst" : "❌ Offen"}
                    </li>
                  ))}
                </ul>
              </div>
              <PropertiesSidebar
                selectedElement={selectedElement}
                onUpdateElement={handleUpdateElement}
              />
            </div>
          )}
        >
          <MainMenu>
            <MainMenu.DefaultItems.LoadScene />
            <MainMenu.DefaultItems.SaveToActiveFile />
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.Help />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.Socials />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.ToggleTheme />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
          <WelcomeScreen />
        </Excalidraw>
      </div>
    </TopErrorBoundary>
  );
};

export default App;
