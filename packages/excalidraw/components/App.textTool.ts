import { flushSync } from "react-dom";

import {
  CURSOR_TYPE,
  EVENT,
  TEXT_AUTOWRAP_THRESHOLD,
  updateActiveTool,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  hasBoundTextElement,
  isArrowElement,
  isTextBindableContainer,
  isTextElement,
} from "@excalidraw/element";

import type { ArrowEndpoint } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import type React from "react";

import type App from "./App";
import type { AppState, PointerDownState } from "../types";

type ScenePoint = { x: number; y: number };

/** the modifier state a target depends on — off a pointer or keyboard event */
type Modifiers = { altKey: boolean };

/** What a text-tool click at a position does. */
export type TextToolTarget =
  /** binds a new text to a free arrow endpoint */
  | { type: "endpoint"; endpoint: ArrowEndpoint }
  /** edits this text (a label included, at its derived position) */
  | { type: "text"; element: NonDeleted<ExcalidrawTextElement> }
  /** binds a new label to this empty container (an arrow included) */
  | { type: "container"; element: NonDeleted<ExcalidrawTextContainer> }
  /** creates free text at the pointer */
  | { type: "free" };

const toHoverState = (target: TextToolTarget): AppState["textToolHover"] => {
  switch (target.type) {
    case "endpoint":
      return {
        type: "arrow",
        elementId: target.endpoint.arrow.id,
        anchor: target.endpoint.startOrEnd,
      };
    case "text":
      return { type: "text", elementId: target.element.id };
    case "container":
      // a shape is outlined whole (the label centers in it); an arrow gets
      // its midpoint pointed at
      return isArrowElement(target.element)
        ? { type: "arrow", elementId: target.element.id, anchor: "label" }
        : { type: "container", elementId: target.element.id };
    case "free":
      return null;
  }
};

const isSameHover = (
  a: AppState["textToolHover"],
  b: AppState["textToolHover"],
) => {
  if (a === b) {
    return true;
  }
  if (!a || !b || a.type !== b.type || a.elementId !== b.elementId) {
    return false;
  }
  return a.type !== "arrow" || b.type !== "arrow" || a.anchor === b.anchor;
};

/**
 * The text tool's pointer interaction.
 *
 * Everything hangs off one question — what would a click at this position
 * do (`getTargetAt`)? — answered once and used for the hover affordance
 * (`appState.textToolHover`), the cursor and the pointerdown itself, so the
 * affordance can never promise something the click won't deliver.
 *
 * A click on an empty container's center is armed on pointerdown and
 * committed on pointerup as a bound label; dragging past the autowrap
 * threshold first turns it into a free fixed-width text at the origin
 * instead.
 *
 * Text editing itself (`app.startTextEditing`) is shared with Enter,
 * double-click and the other entry points and stays in `App`.
 */
export class AppTextTool {
  constructor(private app: App) {}

  /**
   * A click on an empty container's center, armed on pointerdown and decided
   * on the pointer's way out: a click binds a label, a drag creates free
   * text instead. Deferring is what keeps the drag from first binding to
   * (and provisionally enlarging) the container.
   */
  private pending: {
    containerId: ExcalidrawElement["id"];
    origin: ScenePoint;
  } | null = null;

  /**
   * What a click at this position would do, in the order the click resolves
   * it: a free arrow endpoint (the smaller, more deliberate target; z-aware,
   * and off while ctrl/cmd disables binding) → the text under the pointer,
   * which the click edits → an empty container near its center, which gets
   * a label unless alt opts out → free text at the pointer.
   */
  getTargetAt = (
    scenePointer: ScenePoint,
    modifiers: Modifiers,
  ): TextToolTarget => {
    const { x, y } = scenePointer;

    const endpoint = this.app.arrowText.getBindableEndpointAtPosition(x, y);
    if (endpoint) {
      return { type: "endpoint", endpoint };
    }

    const text = this.app.getTextElementAtPosition(x, y);
    if (text) {
      return { type: "text", element: text };
    }

    if (!modifiers.altKey) {
      const container = this.app.getTextBindableContainerAtPosition(x, y);
      if (
        container &&
        // an existing label is edited by hitting the text itself (above)
        !hasBoundTextElement(container) &&
        this.app.getTextWysiwygSnappedToCenterPosition(
          x,
          y,
          this.app.state,
          container,
        )
      ) {
        return { type: "container", element: container };
      }
    }

    return { type: "free" };
  };

  /**
   * Keeps `appState.textToolHover` — the affordance for what a click would
   * do — in sync with the pointer, and returns the target (for the cursor).
   * Suppressed while something else owns the interaction: a text being
   * edited or drag-sized, a multi-point element, a box selection, a drag of
   * the selection, or the pointer over a scrollbar.
   */
  updateHover = (
    scenePointer: ScenePoint,
    modifiers: Modifiers,
    isOverScrollBar = false,
  ): TextToolTarget | null => {
    const { state } = this.app;
    if (state.activeTool.type !== "text") {
      return null;
    }
    // a pending center click keeps the affordance it was armed with until
    // it resolves (the pointer may leave the snap radius before the drag
    // threshold, and a release would still bind)
    if (this.pending) {
      return null;
    }
    const target =
      state.editingTextElement ||
      state.newElement ||
      state.multiElement ||
      state.selectionElement ||
      state.selectedElementsAreBeingDragged ||
      isOverScrollBar
        ? null
        : this.getTargetAt(scenePointer, modifiers);
    this.setHover(target && toHoverState(target));
    return target;
  };

  /**
   * Re-evaluates the hover at the last known pointer position — for the
   * events that change what a click would do without the pointer moving:
   * the alt (container label) and ctrl/cmd (endpoint binding) toggles.
   */
  refreshHover = (modifiers: Modifiers) => {
    if (this.app.lastPointerMoveCoords) {
      this.updateHover(this.app.lastPointerMoveCoords, modifiers);
    }
  };

  clearHover = () => {
    if (this.app.state.textToolHover) {
      this.app.setState({ textToolHover: null });
    }
  };

  private setHover = (next: AppState["textToolHover"]) => {
    if (!isSameHover(this.app.state.textToolHover, next)) {
      this.app.setState({ textToolHover: next });
    }
  };

  /**
   * The cursor for what a click would do: a pointer over the arrow anchors
   * text would attach to, a text cursor over text the click would edit, else
   * the tool's crosshair. `hitElement` is the plain hit under the pointer —
   * the fallback while the affordance is suppressed (editing, dragging), so
   * the cursor there behaves as it always has.
   */
  cursorFor = (
    target: TextToolTarget | null,
    hitElement: ExcalidrawElement | null,
  ): string => {
    if (
      target?.type === "endpoint" ||
      (target?.type === "container" && isArrowElement(target.element))
    ) {
      return CURSOR_TYPE.POINTER;
    }
    if (target?.type === "text" || isTextElement(hitElement)) {
      return CURSOR_TYPE.TEXT;
    }
    return CURSOR_TYPE.CROSSHAIR;
  };

  handlePointerDown = (
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ): void => {
    // while editing, a click outside only finalizes the edit — it doesn't
    // create another text (irrespective of state.activeTool.locked)
    if (this.app.state.editingTextElement) {
      return;
    }
    const sceneX = pointerDownState.origin.x;
    const sceneY = pointerDownState.origin.y;
    const target = this.getTargetAt({ x: sceneX, y: sceneY }, event);

    switch (target.type) {
      case "endpoint":
        this.app.startTextEditing({
          sceneX,
          sceneY,
          // the binding fixes the position, but the width is still the
          // user's to drag out (see `getEndpointBoundTextDragAnchor`)
          autoEdit: false,
          arrowEndpoint: target.endpoint,
          textElement: null,
        });
        break;
      case "text":
        this.app.startTextEditing({
          sceneX,
          sceneY,
          textElement: target.element,
          autoEdit: false,
          initialCaretSceneCoords: { x: sceneX, y: sceneY },
        });
        break;
      case "container":
        // decided on the way out (see handlePointerMove / handlePointerUp).
        // The affordance stays up meanwhile — set explicitly, since a tap
        // has no hover before it
        this.pending = {
          containerId: target.element.id,
          origin: { x: sceneX, y: sceneY },
        };
        this.setHover(toHoverState(target));
        return;
      case "free":
        this.app.startTextEditing({
          sceneX,
          sceneY,
          container: null,
          textElement: null,
          insertAtParentCenter: false,
          autoEdit: false,
        });
        break;
    }

    this.finish();
  };

  /**
   * The pointer-move half of a pending center click. Once the pointer has
   * moved past the autowrap threshold the click is a drag: free text is
   * created at the origin and sized by the drag from here on. Horizontal
   * only (a text is only ever sized that way) and in screen space, and
   * deliberately wider than the generic drag threshold so a jittery click
   * still binds. Returns whether a pending click owned the move.
   */
  handlePointerMove = (
    event: PointerEvent,
    pointerDownState: PointerDownState,
  ): boolean => {
    if (!this.pending) {
      return false;
    }
    // a tool switch mid-press orphans the click
    if (this.app.state.activeTool.type !== "text") {
      this.pending = null;
      return true;
    }
    const pointerCoords = viewportCoordsToSceneCoords(event, this.app.state);
    if (this.isDrag(pointerCoords)) {
      this.resolvePending(true, pointerCoords, pointerDownState, event);
    }
    return true;
  };

  /**
   * The pointer-up half: a genuine pointerup binds the label. The
   * missing-pointerup cleanup replays this with the pointerdown event (a
   * second finger landing mid-press), and a tool switch orphans the click —
   * both discard it instead.
   */
  handlePointerUp = (
    event: PointerEvent,
    pointerDownState: PointerDownState,
  ): void => {
    if (!this.pending) {
      return;
    }
    if (
      event.type !== EVENT.POINTER_UP ||
      this.app.state.activeTool.type !== "text"
    ) {
      this.pending = null;
      return;
    }
    const pointerCoords = viewportCoordsToSceneCoords(event, this.app.state);
    this.resolvePending(
      this.isDrag(pointerCoords),
      pointerCoords,
      pointerDownState,
      event,
    );
  };

  private isDrag = (pointerCoords: ScenePoint) =>
    Math.abs(pointerCoords.x - this.pending!.origin.x) *
      this.app.state.zoom.value >
    TEXT_AUTOWRAP_THRESHOLD;

  private resolvePending = (
    isDrag: boolean,
    pointerCoords: ScenePoint,
    pointerDownState: PointerDownState,
    event: PointerEvent,
  ) => {
    const { containerId, origin } = this.pending!;
    this.pending = null;

    // gone mid-press (a collaborator deleted it): nothing to create, but the
    // click still ends the tool's turn
    const container = this.app.scene.getNonDeletedElement(containerId);
    const created = isTextBindableContainer(container, false);

    // flushed so the drag below reads the created element off the state
    flushSync(() => {
      if (created) {
        this.app.startTextEditing({
          sceneX: origin.x,
          sceneY: origin.y,
          container: isDrag ? null : container,
          textElement: null,
          insertAtParentCenter: !isDrag,
          autoEdit: !isDrag,
        });
      }
      this.finish();
    });

    if (created && isDrag) {
      pointerDownState.lastCoords.x = pointerCoords.x;
      pointerDownState.lastCoords.y = pointerCoords.y;
      this.app.maybeDragNewGenericElement(pointerDownState, event);
    }
  };

  /**
   * The click has been acted on: drop the affordance, revert the tool unless
   * it is locked, restore the cursor.
   */
  private finish = () => {
    this.clearHover();
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
}
