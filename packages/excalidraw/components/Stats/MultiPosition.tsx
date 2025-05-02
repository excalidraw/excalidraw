import { pointFrom, pointRotateRads } from "@excalidraw/math";
import { useMemo } from "react";

import { getCommonBounds } from "@excalidraw/element/bounds";

import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

import type Scene from "@excalidraw/element/Scene";

import StatsDragInput from "./DragInput";
import { handlePositionChange } from "./utils";

import type { AppState } from "../../types";
import type { AtomicUnit } from "./utils";

interface MultiPositionProps {
  property: "x" | "y";
  elements: readonly ExcalidrawElement[];
  elementsMap: ElementsMap;
  atomicUnits: AtomicUnit[];
  scene: Scene;
  appState: AppState;
}

const MultiPosition = ({
  property,
  elements,
  elementsMap,
  atomicUnits,
  scene,
  appState,
}: MultiPositionProps) => {
  const positions = useMemo(
    () =>
      atomicUnits.map((atomicUnit) => {
        const elementsInUnit = Object.keys(atomicUnit)
          .map((id) => elementsMap.get(id))
          .filter((el) => el !== undefined) as ExcalidrawElement[];

        // we're dealing with a group
        if (elementsInUnit.length > 1) {
          const [x1, y1] = getCommonBounds(elementsInUnit);
          return Math.round((property === "x" ? x1 : y1) * 100) / 100;
        }

        const [el] = elementsInUnit;
        const [cx, cy] = [el.x + el.width / 2, el.y + el.height / 2];

        const [topLeftX, topLeftY] = pointRotateRads(
          pointFrom(el.x, el.y),
          pointFrom(cx, cy),
          el.angle,
        );

        return Math.round((property === "x" ? topLeftX : topLeftY) * 100) / 100;
      }),
    [atomicUnits, elementsMap, property],
  );

  const value = new Set(positions).size === 1 ? positions[0] : "Mixed";

  return (
    <StatsDragInput
      label={property === "x" ? "X" : "Y"}
      elements={elements}
      dragInputCallback={handlePositionChange}
      value={value}
      property={property}
      scene={scene}
      appState={appState}
    />
  );
};

export default MultiPosition;
