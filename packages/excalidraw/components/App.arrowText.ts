import { CURSOR_TYPE, DRAGGING_THRESHOLD } from "@excalidraw/common";

import {
  bindBindingElementToFixedPoint,
  dragNewTextElement,
  getBoundTextElement,
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
import type { AppState, PointerDownState } from "../types";

/**
 * Text ↔ arrow interactions.
 *
 * With the text tool: the hover affordance showing where a click would attach
 * text to an arrow — a free endpoint (binds the arrow to a new text element
 * positioned against that endpoint) or the arrow's midpoint (adds a label
 * bound to the arrow) — and the endpoint-bound flavor of drag-sizing a new
 * text.
 *
 * With the selection tool: dragging an arrow's existing label along the arrow
 * — the grab affordance, the drag itself, and where a double-click starts
 * editing a label the drag has moved.
 *
 * The scene-level logic lives in `@excalidraw/element`'s
 * `arrowEndpointText.ts` and `linearElementEditor.ts`.
 */
export class AppArrowText {
  constructor(private app: App) {}

  /**
   * With the text tool active, an arrow under the cursor is a target for
   * attaching text. Returns where the text would land (if anywhere), and keeps
   * `appState.hoveredArrowTextAnchor` — which drives the highlight — in sync.
   */
  updateHoveredAnchor = (scenePointer: {
    x: number;
    y: number;
  }): AppState["hoveredArrowTextAnchor"] => {
    const hovered =
      this.app.state.activeTool.type === "text" &&
      !this.app.state.editingTextElement &&
      !this.app.state.newElement
        ? this.getAnchorAtPosition(scenePointer.x, scenePointer.y)
        : null;

    const previous = this.app.state.hoveredArrowTextAnchor;

    if (
      previous?.elementId !== hovered?.elementId ||
      previous?.anchor !== hovered?.anchor
    ) {
      this.app.setState({ hoveredArrowTextAnchor: hovered });
    }

    return hovered;
  };

  /**
   * Re-evaluates the hovered anchor at the last known pointer position — for
   * events that change what a click would do without the pointer moving,
   * i.e. the ctrl/cmd binding toggle. (Events that invalidate the anchor
   * wholesale — tool switches, finalize, deselect — clear it directly
   * instead.)
   */
  refresh = (): void => {
    if (this.app.lastPointerMoveCoords) {
      this.updateHoveredAnchor(this.app.lastPointerMoveCoords);
    }
  };

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

    // The text tool edits before it creates: when a text element is the
    // top-most hit at this position, a click edits that text, so a nearby
    // endpoint must not be offered over it.
    if (this.app.getTextElementAtPosition(x, y)) {
      return null;
    }

    // The endpoint scan only knows about arrows, so it happily reaches through
    // whatever is drawn on top of them. An element stacked above the arrow that
    // the pointer actually hits owns the click — the text tool should label
    // that element rather than bind the endpoint hidden behind it.
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
   * Mirrors what `handleTextOnPointerDown` would do at this position, so the
   * highlight can't promise something the click won't deliver.
   */
  private getAnchorAtPosition(
    x: number,
    y: number,
  ): AppState["hoveredArrowTextAnchor"] {
    const endpoint = this.getBindableEndpointAtPosition(x, y);

    if (endpoint) {
      return { elementId: endpoint.arrow.id, anchor: endpoint.startOrEnd };
    }

    const container = this.app.getTextBindableContainerAtPosition(x, y);

    // Only arrows get a midpoint label anchor worth pointing at; other
    // containers center the text in themselves, which needs no affordance.
    // An arrow that already has a label is edited in place, not re-anchored.
    if (
      !isArrowElement(container) ||
      getBoundTextElement(container, this.app.scene.getNonDeletedElementsMap())
    ) {
      return null;
    }

    // `getTextBindableContainerAtPosition` resolves an arrow anywhere in its
    // bounding box, but a click only becomes a *label* when it also snaps to
    // the arrow's center — off-center clicks drop a free-floating text
    // instead. Gate on the same check so the highlight can't promise a label
    // the click won't deliver.
    const snappedToCenter = this.app.getTextWysiwygSnappedToCenterPosition(
      x,
      y,
      this.app.state,
      container,
    );

    return snappedToCenter
      ? { elementId: container.id, anchor: "label" }
      : null;
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

  /**
   * Where a double-click on a labeled arrow should start text editing: the
   * center of the label itself, which a label drag may have moved away from
   * the arrow's midpoint. Null when the element is not a labeled arrow.
   */
  getLabelCenter(element: ExcalidrawElement): { x: number; y: number } | null {
    const elementsMap = this.app.scene.getNonDeletedElementsMap();

    if (!isArrowElement(element)) {
      return null;
    }

    const boundTextElement = getBoundTextElement(element, elementsMap);

    if (!boundTextElement) {
      return null;
    }

    const { x, y } = LinearElementEditor.getBoundTextElementPosition(
      element,
      boundTextElement,
      elementsMap,
    );

    return {
      x: x + boundTextElement.width / 2,
      y: y + boundTextElement.height / 2,
    };
  }
}
