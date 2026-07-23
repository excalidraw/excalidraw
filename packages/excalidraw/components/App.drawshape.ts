import { randomInteger } from "@excalidraw/common";

import {
  bindOrUnbindBindingElement,
  convertToShape,
  convertToShapeHandlePointerMoveFromPointerDown,
  getHoveredElementForBinding,
  isBindingElement,
  isLineElement,
  LinearElementEditor,
  maxBindingDistance_simple,
  newArrowElement,
} from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawLineElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { actionFinalize } from "../actions";
import { DrawShapeTrail } from "../drawShapeTrail";

import type App from "./App";
import type { PointerDownState } from "../types";

/**
 * Captures the App state management for the drawShape tool (free-form
 * sketch converted into a recognized excalidraw element). Pointer events
 * are piped here from App.
 *
 * The whole gesture is finalized here, synchronously, on the concrete
 * inserted element: recognize → (maybe upgrade line to arrow) → insert →
 * bind endpoints → one generic actionFinalize for cleanup. actionFinalize
 * contains no drawShape-specific element logic.
 */
export class AppDrawShape {
  public trail: DrawShapeTrail;

  constructor(private app: App) {
    this.trail = new DrawShapeTrail(app);
  }

  stop = () => {
    this.trail.stop();
  };

  handlePointerDown = (pointerDownState: PointerDownState) => {
    this.trail.startPath(
      pointerDownState.lastCoords.x,
      pointerDownState.lastCoords.y,
    );
  };

  /** returns true when the pointermove was consumed by the shape preview */
  handlePointerMove = (pointerCoords: { x: number; y: number }): boolean => {
    return convertToShapeHandlePointerMoveFromPointerDown(
      this.app,
      pointerCoords,
    );
  };

  /**
   * Binds the given endpoint of a freshly inserted drawShape arrow to the
   * bindable element it hovers, if any.
   */
  private bindArrowEndpoint = (
    arrow: NonDeleted<ExcalidrawArrowElement>,
    index: 0 | -1,
  ) => {
    const { app } = this;
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const globalPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
      arrow,
      index,
      elementsMap,
    );
    const target = getHoveredElementForBinding(
      globalPoint,
      app.scene.getNonDeletedElements(),
      elementsMap,
      maxBindingDistance_simple(app.state.zoom),
    );
    if (!target) {
      return;
    }

    bindOrUnbindBindingElement(
      arrow,
      new Map([
        [
          index === 0 ? 0 : arrow.points.length - 1,
          {
            point: LinearElementEditor.pointFromAbsoluteCoords(
              arrow,
              globalPoint,
              elementsMap,
            ),
          },
        ],
      ]),
      globalPoint[0],
      globalPoint[1],
      app.scene,
      app.state,
      { newArrow: true },
    );
  };

  /**
   * A sketched line whose both endpoints land on bindable elements was meant
   * as a connector — upgrade it to an arrow (called before insertion).
   */
  private maybeUpgradeLineToArrow = (
    line: NonDeleted<ExcalidrawLineElement>,
  ): NonDeleted<ExcalidrawArrowElement> | null => {
    const { app } = this;
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const elements = app.scene.getNonDeletedElements();
    const bindingDistance = maxBindingDistance_simple(app.state.zoom);

    const bothEndsBindable = ([0, -1] as const).every((index) =>
      getHoveredElementForBinding(
        LinearElementEditor.getPointAtIndexGlobalCoordinates(
          line,
          index,
          elementsMap,
        ),
        elements,
        elementsMap,
        bindingDistance,
      ),
    );
    if (!bothEndsBindable) {
      return null;
    }

    return newArrowElement({
      type: "arrow",
      x: line.x,
      y: line.y,
      width: line.width,
      height: line.height,
      startArrowhead: null,
      endArrowhead: app.state.currentItemEndArrowhead,
      points: line.points,
      groupIds: line.groupIds,
      frameId: line.frameId,
      locked: false,
      angle: line.angle,
      strokeColor: line.strokeColor,
      backgroundColor: line.backgroundColor,
      fillStyle: line.fillStyle,
      roughness: line.roughness,
      opacity: line.opacity,
      strokeStyle: line.strokeStyle,
      strokeWidth: line.strokeWidth,
    });
  };

  handlePointerUp = () => {
    const { app } = this;

    const points = this.trail.getCurrentPoints();
    this.trail.endPath();

    // note: size gate inside recognizeShape
    if (points.length >= 3) {
      const detectedElement =
        app.state.newElement ||
        convertToShape(
          points,
          app.state,
          app.scene.getNonDeletedElementsMap(),
          app.state.newElement,
          app.scene.getNonDeletedFramesLikes(),
        );

      if (detectedElement) {
        let element: NonDeletedExcalidrawElement = {
          ...detectedElement,
          seed: randomInteger(),
          opacity: app.state.currentItemOpacity,
        };

        if (app.state.isBindingEnabled && isLineElement(element)) {
          element = this.maybeUpgradeLineToArrow(element) ?? element;
        }

        app.insertNewElement(element);

        if (app.state.isBindingEnabled && isBindingElement(element)) {
          this.bindArrowEndpoint(element, 0);
          this.bindArrowEndpoint(element, -1);
        }
      }
    }

    // generic cleanup only: clears the preview from `newElement`, keeps the
    // tool active, keeps nothing selected, commits the undo capture
    app.actionManager.executeAction(actionFinalize);
    this.trail.clearTrails();
  };
}
