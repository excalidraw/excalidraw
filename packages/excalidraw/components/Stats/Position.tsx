import { pointFrom, pointRotateRads, round } from "@excalidraw/math";

import {
  getFlipAdjustedCropPosition,
} from "@excalidraw/element/cropElement";
import { isFrameLikeElement, isImageElement } from "@excalidraw/element/typeChecks";

import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

import type Scene from "@excalidraw/element/Scene";

import StatsDragInput from "./DragInput";
import { handlePositionChange } from "./utils";

import type { AppState } from "../../types";
import { getFrameChildren } from "@excalidraw/element/frame";

interface PositionProps {
  property: "x" | "y";
  element: ExcalidrawElement;
  elementsMap: ElementsMap;
  scene: Scene;
  appState: AppState;
}

const Position = ({
  property,
  element,
  elementsMap,
  scene,
  appState,
}: PositionProps) => {
  const [topLeftX, topLeftY] = pointRotateRads(
    pointFrom(element.x, element.y),
    pointFrom(element.x + element.width / 2, element.y + element.height / 2),
    element.angle,
  );
  const children = isFrameLikeElement(element) ? getFrameChildren(elementsMap, element.id) : [];
  const elements = children.length > 0 ? [element, ...children] : [element];
  let value = round(property === "x" ? topLeftX : topLeftY, 2);

  if (
    appState.croppingElementId === element.id &&
    isImageElement(element) &&
    element.crop
  ) {
    const flipAdjustedPosition = getFlipAdjustedCropPosition(element);

    if (flipAdjustedPosition) {
      value = round(
        property === "x" ? flipAdjustedPosition.x : flipAdjustedPosition.y,
        2,
      );
    }
  }

  return (
    <StatsDragInput
      label={property === "x" ? "X" : "Y"}
      elements={elements}
      dragInputCallback={handlePositionChange}
      scene={scene}
      value={value}
      property={property}
      appState={appState}
    />
  );
};

export default Position;
