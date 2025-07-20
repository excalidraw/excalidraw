import React from "react";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { nanoid } from "nanoid";

interface GamifyToolbarProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

export const GamifyToolbar: React.FC<GamifyToolbarProps> = ({ excalidrawAPI }) => {
  const createGameSet = () => {
    const cardId = `card_${nanoid()}`;
    const zoneId = `zone_${nanoid()}`;

    const cardElement = { 
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      customData: { isCard: true, id: cardId },
    };
    const zoneElement = { 
      type: "rectangle",
      x: 300,
      y: 100,
      width: 150,
      height: 150,
      customData: { isZone: true, accepts: cardId, id: zoneId },
    };

    excalidrawAPI.addElements([cardElement, zoneElement]);
  };

  return (
    <div style={{ position: "absolute", top: "10px", left: "10px", zIndex: 10 }}>
      <h3>Gamify-Tools</h3>
      <button onClick={createGameSet}>Neues Spiel-Set erstellen</button>
    </div>
  );
};