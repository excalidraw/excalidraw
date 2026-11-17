import type { App } from "@excalidraw/excalidraw/types";

import { LinearElementEditor } from "../linearElementEditor";

import { handleFocusPointDrag } from "./focus";

export const maybeHandleArrowPointlikeDrag = ({
  app,
  event,
}: {
  app: App;
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
      // NOTE: the modifiers come from `event`, as the last pointer move
      // event's are stale when they change without the pointer moving
      const newState = LinearElementEditor.handlePointDragging(
        "nativeEvent" in event ? event.nativeEvent : event,
        app,
        app.lastPointerMoveCoords.x,
        app.lastPointerMoveCoords.y,
        appState.selectedLinearElement,
      );
      if (newState) {
        app.setState(newState);
      }
      return true;
    }
  }
  return false;
};
