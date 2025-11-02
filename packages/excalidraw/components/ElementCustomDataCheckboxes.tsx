import React from "react";
import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { getElementAbsoluteCoords, Scene } from "@excalidraw/element";

import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { useExcalidrawAppState } from "./App";
import { CheckboxItem } from "./CheckboxItem";

import "./ElementCustomDataCheckboxes.scss";

import type { AppState } from "../types";

const CONTAINER_PADDING = 8;

type CheckboxData =
  | string
  | {
      label: string;
      checked?: boolean;
    };

const getContainerCoords = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  elementsMap: ElementsMap,
) => {
  const [x1, y1] = getElementAbsoluteCoords(element, elementsMap);
  const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
    { sceneX: x1 + element.width, sceneY: y1 },
    appState,
  );
  const x = viewportX - appState.offsetLeft + 10;
  const y = viewportY - appState.offsetTop;
  return { x, y };
};

export const ElementCustomDataCheckboxes = ({
  element,
  elementsMap,
  scene,
}: {
  element: NonDeletedExcalidrawElement;
  elementsMap: ElementsMap;
  scene: Scene;
}) => {
  const appState = useExcalidrawAppState();

  // Don't show checkboxes in certain states
  if (
    appState.contextMenu ||
    appState.newElement ||
    appState.resizingElement ||
    appState.isRotating ||
    appState.openMenu ||
    appState.viewModeEnabled
  ) {
    return null;
  }

  // Check if customData has checkboxes
  const customData = element.customData;
  if (!customData || !customData.checkboxes) {
    return null;
  }

  const checkboxesData = customData.checkboxes;
  if (!Array.isArray(checkboxesData) || checkboxesData.length === 0) {
    return null;
  }

  // Normalize checkbox data - support both string[] and {label, checked}[]
  const normalizedCheckboxes: Array<{ label: string; checked: boolean }> =
    checkboxesData.map((item: CheckboxData, index: number) => {
      if (typeof item === "string") {
        return {
          label: item,
          checked:
            customData.checkedStates?.[index] ??
            customData.checkedStates?.[item] ??
            false,
        };
      }
      return {
        label: item.label,
        checked: item.checked ?? false,
      };
    });

  const { x, y } = getContainerCoords(element, appState, elementsMap);

  const handleCheckboxChange = (
    index: number,
    checked: boolean,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    event.preventDefault();

    const checkbox = normalizedCheckboxes[index];
    const label = checkbox.label;

    // Update the customData to reflect the new checked state
    const updatedCustomData = {
      ...customData,
      checkboxes: normalizedCheckboxes.map((cb, i) => {
        if (i === index) {
          return typeof checkboxesData[i] === "string"
            ? cb.label
            : { ...checkboxesData[i], checked };
        }
        return checkboxesData[i];
      }),
      checkedStates: {
        ...(customData.checkedStates || {}),
        [label]: checked,
        [index]: checked,
      },
    };

    scene.mutateElement(element, {
      customData: updatedCustomData,
    });
  };

  return (
    <div
      className="excalidraw-custom-data-checkboxes"
      style={{
        top: `${y}px`,
        left: `${x}px`,
        padding: CONTAINER_PADDING,
      }}
    >
      {normalizedCheckboxes.map((checkbox, index) => (
        <CheckboxItem
          key={index}
          checked={checkbox.checked}
          onChange={(checked, event) =>
            handleCheckboxChange(index, checked, event)
          }
          className="custom-data-checkbox-item"
        >
          {checkbox.label}
        </CheckboxItem>
      ))}
    </div>
  );
};

