import {
  bindBindingElementToFixedPoint,
  canHaveConnectionHandles,
  getFixedPointForSide,
  getConnectionHandles,
  getNearestConnectionHandle,
  getHoveredElementForBinding,
  hitTestConnectionHandles,
  maxBindingDistance_simple,
  isArrowElement,
  isBindableElement,
  isBindingEnabled,
  newArrowElement,
  updateBoundElements,
  LinearElementEditor,
} from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import type { ConnectionHandleSide } from "@excalidraw/element";
import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  NonDeleted,
} from "@excalidraw/element/types";
import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import type App from "./App";
import type { AppState } from "../types";

/**
 * Connection handles — the Miro-style affordance for drawing a bound arrow
 * straight out of a shape's side.
 *
 * Four dots sit just outside a bindable shape's side midpoints. Pressing one
 * and dragging creates an arrow whose start is bound to that shape at that
 * side; dragging over another bindable shape snaps the end to that shape's
 * nearest side and binds it on release. Releasing over empty space leaves the
 * end unbound.
 *
 * The handles are a pure affordance: they add no element property. Both ends
 * bind through the ordinary fixed-point binding, so this touches neither the
 * file format nor the collaboration protocol, and the resulting arrow is an
 * ordinary bound arrow that existing binding logic keeps attached.
 *
 * The geometry lives in `@excalidraw/element`'s `connectionHandles.ts` and the
 * drawing in `renderer/interactiveScene.ts`. Modelled on `App.arrowText.ts`,
 * the editor's other hover-driven interactive-canvas affordance.
 */
export class AppConnectionHandles {
  constructor(private app: App) {}

  /**
   * Touch has no hover to follow, so there the handles hang off the current
   * selection instead of whatever is under the finger.
   */
  private get followsSelection(): boolean {
    return this.app.editorInterface.isTouchScreen;
  }

  /**
   * Whether handles should be offered at all right now. They belong to the
   * selection tool at rest — not while drawing, editing text, resizing, or
   * running any other tool.
   */
  private get isEnabled(): boolean {
    const { state } = this.app;

    return (
      state.activeTool.type === "selection" &&
      !state.newElement &&
      !state.editingTextElement &&
      !state.selectionElement &&
      !state.isResizing &&
      !state.isRotating &&
      !state.selectedElementsAreBeingDragged &&
      !state.viewModeEnabled &&
      isBindingEnabled(state)
    );
  }

  /**
   * Keeps `appState.connectionHandles` in sync with the pointer. Returns the
   * handle under the pointer, if any, so the caller can set the cursor.
   */
  updateHovered = (scenePointer: {
    x: number;
    y: number;
  }): ConnectionHandleSide | null => {
    const next = this.isEnabled ? this.resolveHandles(scenePointer) : null;
    const previous = this.app.state.connectionHandles;

    if (
      previous?.elementId !== next?.elementId ||
      previous?.hoveredSide !== next?.hoveredSide
    ) {
      this.app.setState({ connectionHandles: next });
    }

    return next?.hoveredSide ?? null;
  };

  /**
   * Re-evaluates at the last known pointer position, for events that change
   * what a press would do without the pointer moving (tool switches, the
   * binding toggle, a selection change on touch).
   */
  refresh = (): void => {
    if (this.app.lastPointerMoveCoords) {
      this.updateHovered(this.app.lastPointerMoveCoords);
    } else if (this.followsSelection) {
      this.updateHovered({ x: NaN, y: NaN });
    }
  };

  private resolveHandles(scenePointer: {
    x: number;
    y: number;
  }): AppState["connectionHandles"] {
    const element = this.followsSelection
      ? this.getSelectedBindable()
      : this.getHoveredBindable(scenePointer);

    if (!element) {
      return null;
    }

    return {
      elementId: element.id,
      hoveredSide: Number.isNaN(scenePointer.x)
        ? null
        : hitTestConnectionHandles(
            pointFrom<GlobalPoint>(scenePointer.x, scenePointer.y),
            element,
            this.app.scene.getNonDeletedElementsMap(),
            this.app.state.zoom.value,
          ),
    };
  }

  /** The single selected shape, when it can host handles. */
  private getSelectedBindable(): NonDeleted<ExcalidrawBindableElement> | null {
    const selected = this.app.scene.getSelectedElements(this.app.state);

    if (selected.length !== 1) {
      return null;
    }

    return canHaveConnectionHandles(selected[0], this.app.state.zoom.value)
      ? selected[0]
      : null;
  }

  /**
   * The shape whose handle sits under `point`, topmost first.
   *
   * Handles hang *outside* their shape, so ordinary element hit-testing can
   * never find them — approaching one from the outside would otherwise leave
   * it ungrabbable. Deriving this from the scene rather than from
   * `appState.connectionHandles` also keeps a press correct regardless of
   * whether the hover's `setState` has flushed yet.
   */
  private findHandleAt(point: GlobalPoint): {
    element: NonDeleted<ExcalidrawBindableElement>;
    side: ConnectionHandleSide;
  } | null {
    const zoom = this.app.state.zoom.value;
    const elementsMap = this.app.scene.getNonDeletedElementsMap();
    const elements = this.app.scene.getNonDeletedElements();

    // on touch only the selected shape shows handles, so only it offers them
    if (this.followsSelection) {
      const selected = this.getSelectedBindable();
      const side =
        selected &&
        hitTestConnectionHandles(point, selected, elementsMap, zoom);

      return selected && side ? { element: selected, side } : null;
    }

    for (let i = elements.length - 1; i >= 0; i--) {
      const element = elements[i];

      if (!canHaveConnectionHandles(element, zoom)) {
        continue;
      }

      const side = hitTestConnectionHandles(point, element, elementsMap, zoom);

      if (side) {
        return { element, side };
      }
    }

    return null;
  }

  /**
   * The shape whose handles the pointer should see: the one under the pointer,
   * or — so handles are reachable from outside the shape — one whose handle
   * the pointer is over.
   */
  private getHoveredBindable(scenePointer: {
    x: number;
    y: number;
  }): NonDeleted<ExcalidrawBindableElement> | null {
    const zoom = this.app.state.zoom.value;
    const hit = this.app.getElementAtPosition(scenePointer.x, scenePointer.y);

    if (canHaveConnectionHandles(hit, zoom)) {
      return hit;
    }

    return (
      this.findHandleAt(pointFrom<GlobalPoint>(scenePointer.x, scenePointer.y))
        ?.element ?? null
    );
  }

  /**
   * The handle a press at this position would grab. Handles take priority over
   * the shape body, so callers consult this before ordinary hit-testing.
   *
   * Only a handle that is actually ON SCREEN can be grabbed — hence the gate on
   * `appState.connectionHandles` rather than a scan of the whole scene. A
   * handle sits outside its shape, in space that otherwise belongs to box
   * selection, so letting an unseen one win would hijack any drag that merely
   * began near a shape's side (box-selecting past a rectangle, dragging an
   * embeddable out of a frame) into drawing an arrow instead.
   */
  getHandleAtPosition = (
    x: number,
    y: number,
  ): {
    element: NonDeleted<ExcalidrawBindableElement>;
    side: ConnectionHandleSide;
  } | null => {
    const shownId = this.app.state.connectionHandles?.elementId;

    if (!this.isEnabled || !shownId) {
      return null;
    }

    const elementsMap = this.app.scene.getNonDeletedElementsMap();
    const element = elementsMap.get(shownId);

    if (!isBindableElement(element, false)) {
      return null;
    }

    const found = this.findHandleAt(pointFrom<GlobalPoint>(x, y));

    return found?.element.id === element.id ? found : null;
  };

  /**
   * Starts a connection drag: creates an arrow rooted at the handle, binds its
   * start to that shape's side, and records the drag in appState.
   *
   * Nothing is captured for undo here — the whole gesture lands as one history
   * entry when it is finalized on pointer-up.
   */
  startDrag = (
    source: {
      element: NonDeleted<ExcalidrawBindableElement>;
      side: ConnectionHandleSide;
    },
    origin: { x: number; y: number },
  ): NonDeleted<ExcalidrawArrowElement> => {
    const elementsMap = this.app.scene.getNonDeletedElementsMap();
    const { state } = this.app;

    const handle = getConnectionHandles(
      source.element,
      elementsMap,
      state.zoom.value,
    ).find((candidate) => candidate.side === source.side)!;

    const arrow = newArrowElement({
      type: "arrow",
      x: handle.point[0],
      y: handle.point[1],
      strokeColor: state.currentItemStrokeColor,
      backgroundColor: state.currentItemBackgroundColor,
      fillStyle: state.currentItemFillStyle,
      strokeWidth: this.app.getCurrentItemStrokeWidth("arrow"),
      strokeStyle: state.currentItemStrokeStyle,
      roughness: state.currentItemRoughness,
      opacity: state.currentItemOpacity,
      // A connector is always elbow-routed, whatever arrow type was last used
      // for hand-drawn arrows: going around a shape in the way is only
      // possible along a right-angled path. A straight or curved arrow has no
      // way around without ceasing to be one.
      roundness: null,
      startArrowhead: state.currentItemStartArrowhead,
      endArrowhead: state.currentItemEndArrowhead,
      locked: false,
      frameId: this.app.getTopLayerFrameAtSceneCoords(origin)?.id ?? null,
      elbowed: true,
      fixedSegments: [],
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(0, 0)],
    }) as NonDeleted<ExcalidrawArrowElement>;

    this.app.insertNewElement(arrow);

    // bind the start to the side the drag came out of, so the arrow keeps
    // attaching there when the shape is later moved or resized
    bindBindingElementToFixedPoint(
      arrow,
      source.element,
      "start",
      getFixedPointForSide(source.side),
      this.app.scene,
    );

    this.app.setState({
      newElement: arrow,
      selectedLinearElement: new LinearElementEditor(arrow, elementsMap),
      connectionHandles: null,
      connectionDrag: {
        arrowId: arrow.id,
        source: { elementId: source.element.id, side: source.side },
        target: null,
      },
    });

    return arrow;
  };

  /**
   * The pointer-move half of the drag: stretches the arrow to the pointer, or
   * to a target shape's nearest handle when one is under it.
   */
  updateDrag = (pointerCoords: { x: number; y: number }): void => {
    const { connectionDrag } = this.app.state;

    if (!connectionDrag) {
      return;
    }

    const elementsMap = this.app.scene.getNonDeletedElementsMap();
    const arrow = elementsMap.get(connectionDrag.arrowId);

    if (!isArrowElement(arrow)) {
      return;
    }

    const zoom = this.app.state.zoom.value;
    const target = this.getDropTarget(pointerCoords, connectionDrag);

    // snap the end onto the target's nearest handle, else follow the pointer
    const endPoint = target
      ? getNearestConnectionHandle(
          pointFrom<GlobalPoint>(pointerCoords.x, pointerCoords.y),
          target.element,
          elementsMap,
          zoom,
        ).point
      : pointFrom<GlobalPoint>(pointerCoords.x, pointerCoords.y);

    this.app.scene.mutateElement(arrow, {
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(endPoint[0] - arrow.x, endPoint[1] - arrow.y),
      ],
    });

    const nextTarget = target
      ? { elementId: target.element.id, side: target.side }
      : null;

    if (
      nextTarget?.elementId !== connectionDrag.target?.elementId ||
      nextTarget?.side !== connectionDrag.target?.side
    ) {
      this.app.setState({
        connectionDrag: { ...connectionDrag, target: nextTarget },
        // show the target's handles while hovering it, so the snap is legible
        connectionHandles: nextTarget
          ? { elementId: nextTarget.elementId, hoveredSide: nextTarget.side }
          : null,
      });
    }
  };

  /** The bindable shape under the pointer, and the side the end would snap to. */
  private getDropTarget(
    pointerCoords: { x: number; y: number },
    connectionDrag: NonNullable<AppState["connectionDrag"]>,
  ): {
    element: NonDeleted<ExcalidrawBindableElement>;
    side: ConnectionHandleSide;
  } | null {
    if (!isBindingEnabled(this.app.state)) {
      return null;
    }

    const zoom = this.app.state.zoom.value;
    const elementsMap = this.app.scene.getNonDeletedElementsMap();

    // Deliberately NOT `getElementAtPosition`: the topmost thing under the
    // pointer is the arrow being dragged, which isn't bindable, so a plain
    // hit-test would report no target at all. This is the same lookup the
    // arrow tool uses, and it only ever returns bindable elements.
    const hit = getHoveredElementForBinding(
      pointFrom<GlobalPoint>(pointerCoords.x, pointerCoords.y),
      this.app.scene.getNonDeletedElements(),
      elementsMap,
      maxBindingDistance_simple(this.app.state.zoom),
    );

    // an arrow may not bind to itself, and a self-connection would collapse
    // back onto the source shape
    if (
      !canHaveConnectionHandles(hit, zoom) ||
      hit.id === connectionDrag.arrowId ||
      hit.id === connectionDrag.source.elementId
    ) {
      return null;
    }

    const { side } = getNearestConnectionHandle(
      pointFrom<GlobalPoint>(pointerCoords.x, pointerCoords.y),
      hit,
      elementsMap,
      zoom,
    );

    return { element: hit, side };
  }

  /**
   * Ends the drag: binds the arrow's end to the snapped target, if any, and
   * clears the transient state. Releasing over empty space simply leaves the
   * end where it is, unbound.
   *
   * Returns whether a connection drag was in progress.
   */
  finalizeDrag = (): boolean => {
    const { connectionDrag } = this.app.state;

    if (!connectionDrag) {
      return false;
    }

    const elementsMap = this.app.scene.getNonDeletedElementsMap();
    const arrow = elementsMap.get(connectionDrag.arrowId);
    const target = connectionDrag.target
      ? elementsMap.get(connectionDrag.target.elementId)
      : null;

    if (
      arrow &&
      connectionDrag.target &&
      isBindableElement(target, false) &&
      target
    ) {
      bindBindingElementToFixedPoint(
        arrow as NonDeleted<ExcalidrawArrowElement>,
        target,
        "end",
        getFixedPointForSide(connectionDrag.target.side),
        this.app.scene,
      );

      // The drag routed the arrow to the pointer, which is near the target's
      // side but not on it: a side handle sits outside the box, and a diamond
      // or an ellipse is inset from that box by up to half its diagonal.
      // Writing the binding doesn't move the arrow, so the connector would be
      // left stopping short of the shape on the heading it arrived on —
      // running alongside the outline instead of into it. Re-route it the way
      // a bound shape does when it moves.
      updateBoundElements(target, this.app.scene);
    }

    this.app.setState({
      connectionDrag: null,
      connectionHandles: null,
    });

    return true;
  };

  /**
   * Abandons a drag without binding — for escape/cancel paths. The arrow
   * itself is cleaned up by the caller's usual new-element teardown.
   */
  cancelDrag = (): void => {
    if (this.app.state.connectionDrag || this.app.state.connectionHandles) {
      this.app.setState({ connectionDrag: null, connectionHandles: null });
    }
  };
}
