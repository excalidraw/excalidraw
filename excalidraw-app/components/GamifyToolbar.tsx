// Datei: /var/www/gamifyboard/excalidraw-app/components/GamifyToolbar.tsx

import React from "react";
import { nanoid } from "nanoid";

import { newElement } from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

interface GamifyToolbarProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

export const GamifyToolbar: React.FC<GamifyToolbarProps> = ({
  excalidrawAPI,
}) => {
  const createGameSet = () => {
    if (!excalidrawAPI) {
      return;
    }

    const cardId = `card_${nanoid()}`;
    const zoneId = `zone_${nanoid()}`;

    const cardElement = newElement({
      type: "rectangle",
      x: 400,
      y: 200,
      width: 180,
      height: 130,
      strokeColor: "#ff4757",
      backgroundColor: "transparent",
      customData: { isCard: true, id: cardId },
    });

    const zoneElement = newElement({
      type: "rectangle",
      x: 100,
      y: 200,
      width: 200,
      height: 150,
      strokeColor: "#1e90ff",
      backgroundColor: "transparent",
      strokeStyle: "dashed",
      customData: { isZone: true, accepts: cardId, id: zoneId },
    });

    const newElements = [cardElement, zoneElement];
    excalidrawAPI.updateScene({ elements: newElements });
    excalidrawAPI.scrollToContent(newElements, { fitToContent: true });
  };

  return (
    <div
      style={{
        background: "white",
        padding: "0.5rem 1rem",
        borderRadius: "8px",
        border: "1px solid #e0e0e0",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      <button onClick={createGameSet}>Neues Spiel-Set erstellen</button>
    </div>
  );
};
