import React from "react";
import { nanoid } from "nanoid";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawRectangleElement,
  FractionalIndex,
} from "@excalidraw/element/types";
import type { Radians } from "@excalidraw/math";

interface GamifyToolbarProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

export const GamifyToolbar: React.FC<GamifyToolbarProps> = ({
  excalidrawAPI,
}) => {
  const createBaseElement = (): ExcalidrawRectangleElement => ({
    id: `element_${nanoid()}`,
    type: "rectangle",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    angle: 0 as Radians,
    index: "" as unknown as FractionalIndex,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    boundElements: [],
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    updated: Date.now(),
    link: null,
    locked: false,
    customData: {},
    roundness: null,
  });

  const createGameSet = () => {
    const card = {
      ...(createBaseElement() as ExcalidrawRectangleElement),
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      backgroundColor: "#ffffff",
      customData: { isCard: true },
    };

    const zone = {
      ...(createBaseElement() as ExcalidrawRectangleElement),
      x: 300,
      y: 100,
      width: 150,
      height: 150,
      strokeColor: "#666666",
      backgroundColor: "#f0f0f0",
      customData: { isZone: true, accepts: card.id },
    };

    excalidrawAPI.updateScene({
      elements: [...excalidrawAPI.getSceneElements(), card, zone],
    });
  };

  return (
    <div
      style={{ position: "absolute", top: "10px", left: "10px", zIndex: 10 }}
    >
      <h3>Gamify-Tools</h3>
      <button onClick={createGameSet}>Neues Spiel-Set erstellen</button>
    </div>
  );
};
