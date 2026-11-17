import type { NullableGridSize } from "@excalidraw/common";

import { LinearElementEditor } from "../linearElementEditor";

import { handleFocusPointDrag } from "./focus";

import type { Scene } from "../Scene";
import type { ElementsState } from "../types";

/**
 * What arrow point dragging needs from the editor. Point dragging itself
 * (`LinearElementEditor.handlePointDragging`) still takes the whole editor.
 */
export type ArrowPointDragHost = Parameters<
  typeof LinearElementEditor.handlePointDragging
>[1] & {
  state: Pick<
    ElementsState,
    "selectedLinearElement" | "isBindingEnabled" | "zoom"
  >;
  scene: Scene;
  lastPointerMoveCoords: { x: number; y: number } | null;
  lastPointerMoveEvent: PointerEvent | null;
  getEffectiveGridSize(): NullableGridSize;
};

export const maybeHandleArrowPointlikeDrag = ({
  app,
  event,
}: {
  app: ArrowPointDragHost;
  event: KeyboardEvent | React.KeyboardEvent<Element> | PointerEvent;
}): boolean => {
  const appState = app.state;
  if (appState.selectedLinearElement && app.lastPointerMoveCoords) {
    // Update focus point status if the binding mode is changing
    if (appState.selectedLinearElement.draggedFocusPointBinding) {
      handleFocusPointDrag(
        appState.selectedLinearElement,
        app.scene.getNonDeletedElementsMap(),
        app.lastPointerMoveCoords,
        app.scene,
        appState,
        app.getEffectiveGridSize(),
        event.altKey,
      );
      return true;
    } else if (
      appState.selectedLinearElement.hoverPointIndex !== null &&
      app.lastPointerMoveEvent &&
      appState.selectedLinearElement.initialState.lastClickedPoint >= 0 &&
      appState.selectedLinearElement.isDragging
    ) {
      LinearElementEditor.handlePointDragging(
        app.lastPointerMoveEvent,
        app,
        app.lastPointerMoveCoords.x,
        app.lastPointerMoveCoords.y,
        appState.selectedLinearElement,
      );
      return true;
    }
  }
  return false;
};
