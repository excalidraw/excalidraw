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
    const { multiElement } = appState;
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
      multiElement &&
      multiElement.id === appState.selectedLinearElement.elementId &&
      multiElement.points[multiElement.points.length - 1] !==
        appState.selectedLinearElement.lastCommittedPoint
    ) {
      // Click-to-place: re-run the preview of the uncommitted end point, so
      // it already shows where the next click (with these modifiers) puts it
      const newState = LinearElementEditor.handlePointerMove(
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
