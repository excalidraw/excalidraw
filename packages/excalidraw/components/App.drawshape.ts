import { randomInteger } from "@excalidraw/common";

import {
  bindBindingElement,
  convertToShape,
  convertToShapeHandlePointerMoveFromPointerDown,
  getHoveredElementForBinding,
  isBindingElement,
  isLineElement,
  LinearElementEditor,
  maxBindingDistance_simple,
  newArrowElement,
  updateBoundPoint,
} from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawLineElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
  PointsPositionUpdates,
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
 * The gesture is committed by `finalize()` — recognize → (maybe upgrade
 * line to arrow) → insert → bind endpoints — which is invoked from within
 * `actionFinalize`, the editor's single finalization funnel. Whatever
 * triggers a finalize (the gesture's own pointerup, a mid-gesture paste
 * switching tools, …), the pending sketch resolves there exactly once.
 */
export class AppDrawShape {
  public trail: DrawShapeTrail;

  /** a pointerdown started a sketch that `finalize()` hasn't resolved yet */
  private gestureInProgress = false;

  constructor(private app: App) {
    this.trail = new DrawShapeTrail(app);
  }

  stop = () => {
    this.trail.stop();
  };

  hasPendingGesture = () => {
    return this.gestureInProgress;
  };

  handlePointerDown = (pointerDownState: PointerDownState) => {
    if (this.gestureInProgress) {
      // a stale gesture (e.g. after a missed pointerup) — resolve it before
      // starting a new one
      this.app.actionManager.executeAction(actionFinalize);
    }
    this.gestureInProgress = true;
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
   * Binds both endpoints of a freshly inserted drawShape arrow to the
   * bindable elements they hover, if any.
   *
   * Endpoints bind in "orbit" mode — the arrow starts/ends at the target's
   * outline — even when the stroke was started or released inside the shape
   * (a sketched connector aims at the shape, not at a point inside it). The
   * exception is a sketch contained in a single shape: both ends then bind
   * "inside" and stay where they were drawn, like the interactive
   * inside→inside flow.
   */
  private bindRecognizedArrow = (arrow: NonDeleted<ExcalidrawArrowElement>) => {
    const { app } = this;
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const elements = app.scene.getNonDeletedElements();
    const bindingDistance = maxBindingDistance_simple(app.state.zoom);

    const endpoints = (["start", "end"] as const).map((startOrEnd) => {
      const globalPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
        arrow,
        startOrEnd === "start" ? 0 : -1,
        elementsMap,
      );
      return {
        startOrEnd,
        globalPoint,
        target: getHoveredElementForBinding(
          globalPoint,
          elements,
          elementsMap,
          bindingDistance,
        ),
      };
    });

    const sameTarget =
      !!endpoints[0].target && endpoints[0].target === endpoints[1].target;
    const isMidpointSnappingEnabled =
      app.state.isMidpointSnappingEnabled && !app.state.gridModeEnabled;

    for (const { startOrEnd, globalPoint, target } of endpoints) {
      if (target) {
        bindBindingElement(
          arrow,
          target,
          sameTarget ? "inside" : "orbit",
          startOrEnd,
          app.scene,
          globalPoint,
          app.state.isBindingEnabled,
          isMidpointSnappingEnabled,
        );
      }
    }

    if (sameTarget) {
      return;
    }

    // pull the orbit-bound endpoints onto the target outlines; both bindings
    // exist by now, so each endpoint clips the segment between the two focus
    // points (mirrors the focusPoint branch of bindOrUnbindBindingElement)
    const updates: PointsPositionUpdates = new Map();
    for (const { startOrEnd, target } of endpoints) {
      if (!target) {
        continue;
      }
      const point = updateBoundPoint(
        arrow,
        startOrEnd === "start" ? "startBinding" : "endBinding",
        startOrEnd === "start" ? arrow.startBinding : arrow.endBinding,
        target,
        elementsMap,
      );
      if (point) {
        updates.set(startOrEnd === "start" ? 0 : arrow.points.length - 1, {
          point,
        });
      }
    }
    if (updates.size) {
      LinearElementEditor.movePoints(arrow, app.scene, updates);
    }
  };

  /**
   * A sketched line that connects a bindable element with something else —
   * another element or blank canvas — was meant as a connector: upgrade it
   * to an arrow (called before insertion). A line touching no shape, or
   * contained in a single shape (an annotation, not a connector), stays a
   * line.
   */
  private maybeUpgradeLineToArrow = (
    line: NonDeleted<ExcalidrawLineElement>,
  ): NonDeleted<ExcalidrawArrowElement> | null => {
    const { app } = this;
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const elements = app.scene.getNonDeletedElements();
    const bindingDistance = maxBindingDistance_simple(app.state.zoom);

    const [startTarget, endTarget] = ([0, -1] as const).map((index) =>
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
    if ((!startTarget && !endTarget) || startTarget === endTarget) {
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

  /**
   * Commits the pending sketch, if any, and clears the trail. Invoked from
   * within `actionFinalize` — never call directly, execute `actionFinalize`
   * instead so element insertion flows into the action's returned elements.
   */
  finalize = () => {
    const { app } = this;

    // when no gesture is in progress this only clears residual trail state
    const points = this.gestureInProgress ? this.trail.getCurrentPoints() : [];
    this.gestureInProgress = false;
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
          this.bindRecognizedArrow(element);
        }
      }
    }

    this.trail.clearTrails();
  };
}
