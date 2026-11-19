import { LinearElementEditor } from "../linearElementEditor";

import { handleFocusPointDrag } from "./focus";

import type { LinearElementEditorHost } from "../linearElementEditor";

/**
 * What arrow point dragging needs from the editor: point dragging's own needs
 * (`LinearElementEditorHost`) plus the last pointer position and event.
 */
export type ArrowPointDragHost = LinearElementEditorHost & {
  lastPointerMoveCoords: { x: number; y: number } | null;
  lastPointerMoveEvent: PointerEvent | null;
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
