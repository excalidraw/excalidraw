import { CURSOR_TYPE, DRAGGING_THRESHOLD } from "@excalidraw/common";

import {
  bindBindingElementToFixedPoint,
  dragNewTextElement,
  getEndpointBoundTextDragAnchor,
  getTextBindingForArrowEndpoint,
  getUnboundArrowEndpointAtPoint,
  hitElementBoundText,
  isArrowElement,
  isBindingEnabled,
  isEndpointBoundText,
  isTextElement,
  LinearElementEditor,
} from "@excalidraw/element";

import { pointDistance, pointFrom } from "@excalidraw/math";

import type { ArrowEndpoint } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  FixedPoint,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type App from "./App";
import type { PointerDownState } from "../types";

/**
 * Text ↔ arrow interactions.
 *
 * With the text tool: the free endpoint a click would bind a new text to
 * (`AppTextTool` resolves and shows it), the binding itself, and the
 * endpoint-bound flavor of drag-sizing a new text.
 *
 * With the selection tool: dragging an arrow's existing label along the arrow
 * — the grab affordance and the drag itself.
 *
 * The scene-level logic lives in `@excalidraw/element`'s
 * `arrowEndpointText.ts` and `linearElementEditor.ts`.
 */
export class AppArrowText {
  constructor(private app: App) {}

  /**
   * A free arrow endpoint a new text could be bound to. Binding an endpoint is
   * an arrow binding, so it follows the binding toggle (ctrl/cmd) like every
   * other one — holding it makes the text tool drop plain text instead.
   */
  getBindableEndpointAtPosition(x: number, y: number): ArrowEndpoint | null {
    if (!isBindingEnabled(this.app.state)) {
      return null;
    }

    const endpoint = getUnboundArrowEndpointAtPoint(
      pointFrom(x, y),
      this.app.scene.getNonDeletedElements(),
      this.app.scene.getNonDeletedElementsMap(),
      this.app.state.zoom,
    );

    if (!endpoint) {
      return null;
    }

    // The endpoint scan only knows about arrows, so it happily reaches through
    // whatever is drawn on top of them. An element stacked above the arrow that
    // the pointer actually hits owns the click — the text tool should edit or
    // label that element rather than bind the endpoint hidden behind it. This
    // includes text: a text stacked above the arrow keeps its edit behavior.
    //
    // The preference is z-aware on purpose. When the arrow is the top-most hit
    // (e.g. drawn over an existing text), its endpoint has full preference
    // over the whole hit circle — a z-blind "any text under the cursor wins"
    // rule would make the affordance flicker between the endpoint anchor and
    // text editing wherever a text bbox edge cuts into the circle.
    const hitElement = this.app.getElementAtPosition(x, y, {
      includeLockedElements: true,
    });

    if (
      hitElement &&
      hitElement.id !== endpoint.arrow.id &&
      this.app.scene.getElementIndex(hitElement.id) >
        this.app.scene.getElementIndex(endpoint.arrow.id)
    ) {
      return null;
    }

    return endpoint;
  }

  /**
   * How a text should be created to read as a label for this endpoint — the
   * side midpoint to bind, the alignment that pins it, and the scene position
   * it must sit at. `targetStrokeWidth` is the caller's to provide so it can
   * guarantee it matches the stroke width the text is then created with — the
   * binding gap derives from it (see `getTextBindingForArrowEndpoint`).
   */
  getTextBinding(
    { arrow, startOrEnd }: ArrowEndpoint,
    targetStrokeWidth: number,
  ) {
    return getTextBindingForArrowEndpoint(
      arrow,
      startOrEnd,
      this.app.scene.getNonDeletedElementsMap(),
      targetStrokeWidth,
    );
  }

  /**
   * Binds the arrow endpoint to the created text, at the side midpoint the
   * placement resolved (`getTextBinding`'s `fixedPoint`).
   */
  bindText(
    { arrow, startOrEnd }: ArrowEndpoint,
    text: NonDeleted<ExcalidrawTextElement>,
    fixedPoint: FixedPoint,
  ): void {
    bindBindingElementToFixedPoint(
      arrow,
      text,
      startOrEnd,
      fixedPoint,
      this.app.scene,
    );
  }

  /**
   * A text bound to an arrow endpoint can't be positioned by the drag — the
   * binding already placed it — so only its width is dragged out. Returns
   * whether it owned the drag.
   */
  maybeDragNewText(
    newElement: ExcalidrawElement,
    pointerCoords: { x: number; y: number },
  ): boolean {
    if (
      !isTextElement(newElement) ||
      !isEndpointBoundText(
        newElement,
        this.app.scene.getNonDeletedElementsMap(),
      )
    ) {
      return false;
    }

    dragNewTextElement({
      newElement,
      ...getEndpointBoundTextDragAnchor(newElement),
      pointerX: pointerCoords.x,
      zoom: this.app.state.zoom.value,
      scene: this.app.scene,
    });

    return true;
  }

  /**
   * Whether the arrow's label is what a grab at this position would pick up:
   * the pointer is over the label, and no element stacked above the arrow
   * owns the hit instead.
   */
  isBoundTextGrabbable(
    element: NonDeletedExcalidrawElement,
    x: number,
    y: number,
  ): boolean {
    if (
      !isArrowElement(element) ||
      !hitElementBoundText(
        pointFrom(x, y),
        element,
        this.app.scene.getNonDeletedElementsMap(),
      )
    ) {
      return false;
    }

    const hitElements = this.app.getElementsAtPosition(x, y);
    const arrowIndex = hitElements.findIndex((el) => el.id === element.id);

    return (
      arrowIndex !== -1 &&
      !hitElements
        .slice(arrowIndex + 1)
        .some((el) => this.app.hitElement(x, y, el, false))
    );
  }

  /**
   * The pointer-move half of dragging a label along its arrow. Owns the move
   * whenever the gesture started on the label (`pointerDownState.hit.arrowLabel`),
   * dragging only once past the threshold. Returns whether it owned it.
   */
  maybeDragLabel(
    linearElementEditor: LinearElementEditor,
    pointerDownState: PointerDownState,
    pointerCoords: { x: number; y: number },
  ): boolean {
    if (!pointerDownState.hit.arrowLabel) {
      return false;
    }

    this.app.cursor.set(CURSOR_TYPE.GRABBING);

    if (
      linearElementEditor.isDragging ||
      pointDistance(
        pointFrom(pointerDownState.origin.x, pointerDownState.origin.y),
        pointFrom(pointerCoords.x, pointerCoords.y),
      ) >=
        DRAGGING_THRESHOLD / this.app.state.zoom.value
    ) {
      const updatedEditor = LinearElementEditor.handleBoundTextDragging(
        linearElementEditor,
        this.app.scene,
        pointerCoords.x,
        pointerCoords.y,
      );
      if (updatedEditor) {
        pointerDownState.drag.hasOccurred = true;
        this.app.setState({
          selectedLinearElement: updatedEditor,
        });
      }
    }

    return true;
  }
}
