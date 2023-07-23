import Scene from "../scene/Scene";
import { useMemo } from "react";
import { isImageElement } from "../element/typeChecks";
import { NonDeletedExcalidrawElement } from "../element/types";
import { CommonCanvasAppState } from "../types";

export const useCanvasElements = (
  appState: CommonCanvasAppState,
  scene: Scene,
): readonly NonDeletedExcalidrawElement[] => {
  const nonDeletedElements = scene.getNonDeletedElements();

  const elements = useMemo(() => {
    return nonDeletedElements.filter((element) => {
      if (isImageElement(element)) {
        if (
          // not placed on canvas yet (but in elements array)
          appState.pendingImageElementId === element.id
        ) {
          return false;
        }
      }
      // don't render text element that's being currently edited (it's
      // rendered on remote only)
      return (
        !appState.editingElement ||
        appState.editingElement.type !== "text" ||
        element.id !== appState.editingElement.id
      );
    });
  }, [
    nonDeletedElements,
    appState.editingElement,
    appState.pendingImageElementId,
  ]);

  return elements;
};
