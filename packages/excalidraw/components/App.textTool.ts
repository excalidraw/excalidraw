import { flushSync } from "react-dom";

import {
  EVENT,
  TEXT_AUTOWRAP_THRESHOLD,
  updateActiveTool,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  hasBoundTextElement,
  isArrowElement,
  isTextBindableContainer,
} from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawTextContainer,
  NonDeleted,
} from "@excalidraw/element/types";

import type React from "react";

import type App from "./App";
import type { PointerDownState } from "../types";

/**
 * The text tool's pointer interaction: the hover affordance, what a
 * pointerdown does, the pending center click, and the tool reset.
 *
 * Text editing itself (`app.startTextEditing`) is shared with Enter,
 * double-click and the other entry points and stays in `App`.
 */
export class AppTextTool {
  constructor(private app: App) {}

  private getCreationContainerAtPosition(
    x: number,
    y: number,
    skipBinding: boolean,
  ) {
    if (skipBinding) {
      return null;
    }
    const container = this.app.getTextBindableContainerAtPosition(x, y);
    // Existing labels are edited only by hitting the text itself. Empty
    // containers are candidates for binding only near their center.
    return container &&
      !hasBoundTextElement(container) &&
      this.app.getTextWysiwygSnappedToCenterPosition(
        x,
        y,
        this.app.state,
        container,
      )
      ? container
      : null;
  }

  maybeUpdateHighlightOnPointerMove = (
    sceneCoords: { x: number; y: number },
    event: React.PointerEvent<HTMLCanvasElement>,
    isOverScrollBar: boolean,
  ) => {
    // `elementsToHighlight` is shared with frame drag/resize flows, so only
    // manage it while the text tool owns the interaction (switching tools
    // resets it via setActiveTool)
    if (this.app.state.activeTool.type !== "text") {
      return;
    }

    if (
      this.app.state.newElement ||
      this.app.state.multiElement ||
      this.app.state.selectionElement ||
      this.app.state.selectedElementsAreBeingDragged
    ) {
      return;
    }

    let elementToHighlight: NonDeleted<ExcalidrawElement> | null = null;
    let containerToBindTo: NonDeleted<
      Exclude<ExcalidrawTextContainer, ExcalidrawArrowElement>
    > | null = null;

    if (!this.app.state.editingTextElement && !isOverScrollBar) {
      // mirror what clicking at this position would do: a bindable arrow
      // endpoint wins (see handleTextOnPointerDown) and gets its affordance
      // via `hoveredArrowTextAnchor` — as do arrow midpoint-label anchors —
      // so both are skipped here. Then editing an existing text element wins
      // (see startTextEditing), else highlight the empty (non-arrow)
      // container the new text would get bound to.
      const arrowEndpoint = this.app.arrowText.getBindableEndpointAtPosition(
        sceneCoords.x,
        sceneCoords.y,
      );
      if (!arrowEndpoint) {
        const textAtPosition = this.app.getTextElementAtPosition(
          sceneCoords.x,
          sceneCoords.y,
        );
        if (textAtPosition) {
          elementToHighlight = textAtPosition;
        } else {
          const container = this.getCreationContainerAtPosition(
            sceneCoords.x,
            sceneCoords.y,
            event.altKey,
          );
          if (container && !isArrowElement(container)) {
            containerToBindTo = container;
          }
        }
      }
    }

    if (
      (this.app.state.elementsToHighlight?.[0] ?? null) !== elementToHighlight
    ) {
      this.app.setState({
        elementsToHighlight: elementToHighlight ? [elementToHighlight] : null,
      });
    }
    if (
      (this.app.state.suggestedBinding?.element ?? null) !== containerToBindTo
    ) {
      this.app.setState({
        suggestedBinding: containerToBindTo
          ? { element: containerToBindTo }
          : null,
      });
    }
  };

  handlePointerDown = (
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ): void => {
    // if we're currently still editing text, clicking outside
    // should only finalize it, not create another (irrespective
    // of state.activeTool.locked)
    if (this.app.state.editingTextElement) {
      return;
    }
    const sceneX = pointerDownState.origin.x;
    const sceneY = pointerDownState.origin.y;

    // the click transitions into text editing either way, consuming (or
    // bypassing) whatever anchor or hover highlight was shown — don't leave
    // them lingering under the editor, which outlives the hover when the
    // tool is locked
    this.app.setState({
      hoveredArrowTextAnchor: null,
      elementsToHighlight: null,
      suggestedBinding: null,
    });

    // a free arrow endpoint takes precedence over adding a label *to* the
    // arrow — it's the smaller, more deliberate target
    const arrowEndpoint = this.app.arrowText.getBindableEndpointAtPosition(
      sceneX,
      sceneY,
    );

    if (arrowEndpoint) {
      this.app.startTextEditing({
        sceneX,
        sceneY,
        // the binding fixes the position, but the width is still the user's
        // to drag out (see `getEndpointBoundTextDragAnchor`)
        autoEdit: false,
        arrowEndpoint,
      });
    } else {
      const container = this.getCreationContainerAtPosition(
        sceneX,
        sceneY,
        event.altKey,
      );

      this.app.startTextEditing({
        sceneX,
        sceneY,
        insertAtParentCenter: !event.altKey,
        container,
        autoEdit: false,
        initialCaretSceneCoords: { x: sceneX, y: sceneY },
        textCreation: pointerDownState.text,
      });
    }

    if (!pointerDownState.text.pendingContainerId) {
      this.reset();
    }
  };

  reset = () => {
    // The pointer may have refreshed the hover while a center click was
    // pending. Clear it when creation starts, including with a locked tool.
    this.app.setState({
      hoveredArrowTextAnchor: null,
      elementsToHighlight: null,
      suggestedBinding: null,
    });
    if (!this.app.isToolLocked()) {
      this.app.setState(
        {
          activeTool: updateActiveTool(this.app.state, {
            type: this.app.state.preferredSelectionTool.type,
          }),
        },
        // reset once the tool revert has settled
        () => this.app.cursor.reset(),
      );
    } else {
      this.app.cursor.reset();
    }
  };

  maybeStartPending = (
    event: PointerEvent,
    pointerDownState: PointerDownState,
  ): boolean => {
    const { pendingContainerId } = pointerDownState.text;
    if (!pendingContainerId) {
      return false;
    }

    // Tool changes and missing-pointer-up cleanup cancel the pending click.
    if (
      this.app.state.activeTool.type !== "text" ||
      (event.type !== EVENT.POINTER_MOVE && event.type !== EVENT.POINTER_UP)
    ) {
      pointerDownState.text.pendingContainerId = null;
      return true;
    }

    const pointerCoords = viewportCoordsToSceneCoords(event, this.app.state);
    const isDrag =
      Math.abs(pointerCoords.x - pointerDownState.origin.x) *
        this.app.state.zoom.value >
      TEXT_AUTOWRAP_THRESHOLD;

    if (!isDrag && event.type !== EVENT.POINTER_UP) {
      return true;
    }

    pointerDownState.text.pendingContainerId = null;
    const container = this.app.scene.getNonDeletedElement(pendingContainerId);
    if (!isTextBindableContainer(container, false)) {
      return true;
    }

    flushSync(() => {
      this.app.startTextEditing({
        sceneX: pointerDownState.origin.x,
        sceneY: pointerDownState.origin.y,
        container: isDrag ? null : container,
        insertAtParentCenter: !isDrag,
        autoEdit: !isDrag,
      });
      this.reset();
    });

    if (isDrag) {
      pointerDownState.lastCoords.x = pointerCoords.x;
      pointerDownState.lastCoords.y = pointerCoords.y;
      this.app.maybeDragNewGenericElement(pointerDownState, event);
    }

    return true;
  };
}
