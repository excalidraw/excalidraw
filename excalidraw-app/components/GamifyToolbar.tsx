import React from "react";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { newElementWith } from "@excalidraw/element";
import { nanoid } from "nanoid";

export const GamifyToolbar = () => {
  const excalidrawAPI = useExcalidrawAPI();

  const createGameSet = () => {
    const cardId = nanoid();
    const zoneId = nanoid();

    const card = newElementWith({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 50,
      strokeColor: "#000000",
      backgroundColor: "#FFC0CB", // Pink
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 1,
      opacity: 100,
      angle: 0,
      groupIds: [],
      frameId: null,
      roundness: null,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      customData: { isCard: true, id: cardId },
    });

    const zone = newElementWith({
      type: "rectangle",
      x: 300,
      y: 100,
      width: 120,
      height: 70,
      strokeColor: "#000000",
      backgroundColor: "#ADD8E6", // Light Blue
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 1,
      opacity: 100,
      angle: 0,
      groupIds: [],
      frameId: null,
      roundness: null,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      customData: { isZone: true, accepts: cardId },
    });

    excalidrawAPI.updateScene({ elements: [card, zone] });
  };

  return (
    <div style={{ position: "absolute", top: "10px", left: "10px", zIndex: 10 }}>
      <button onClick={createGameSet}>Create Game Set</button>
    </div>
  );
};
