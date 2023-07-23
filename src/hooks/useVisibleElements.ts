import { useMemo } from "react";
import { CommonCanvasAppState } from "../types";
import { NonDeletedExcalidrawElement } from "../element/types";
import { isVisibleElement } from "../element/sizeHelpers";

export const useVisibleCanvasElements = (
  appState: CommonCanvasAppState,
  elements: readonly NonDeletedExcalidrawElement[],
): readonly NonDeletedExcalidrawElement[] => {
  const visibleElements = useMemo(() => {
    const viewTransformations = {
      zoom: appState.zoom,
      offsetLeft: appState.offsetLeft,
      offsetTop: appState.offsetTop,
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
    };

    return elements.filter((element) =>
      isVisibleElement(
        element,
        appState.width,
        appState.height,
        viewTransformations,
      ),
    );
  }, [
    appState.offsetLeft,
    appState.offsetTop,
    appState.scrollX,
    appState.scrollY,
    appState.height,
    appState.width,
    appState.zoom,
    elements,
  ]);

  return visibleElements;
};
