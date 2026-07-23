import { flushSync } from "react-dom";

import { randomInteger } from "@excalidraw/common";

import {
  convertToShape,
  convertToShapeHandlePointerMoveFromPointerDown,
  isBindingElement,
  LinearElementEditor,
} from "@excalidraw/element";

import { actionFinalize } from "../actions";
import { DrawShapeTrail } from "../drawShapeTrail";

import type App from "./App";
import type { PointerDownState } from "../types";

/**
 * Captures the App state management for the drawShape tool (free-form
 * sketch converted into a recognized excalidraw element). Pointer events
 * are piped here from App.
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

  handlePointerUp = (childEvent: PointerEvent) => {
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
        const _detectedElement = {
          ...detectedElement,
          seed: randomInteger(),
          opacity: app.state.currentItemOpacity,
        };
        app.insertNewElement(_detectedElement);

        if (isBindingElement(_detectedElement)) {
          const [x, y] = LinearElementEditor.getPointAtIndexGlobalCoordinates(
            _detectedElement,
            1,
            app.scene.getNonDeletedElementsMap(),
          );

          app.scene.mutateElement(_detectedElement, {
            startArrowhead: app.state.currentItemStartArrowhead,
            endArrowhead: app.state.currentItemEndArrowhead,
          });

          flushSync(() => {
            const linearElement = new LinearElementEditor(
              _detectedElement,
              app.scene.getNonDeletedElementsMap(),
            );
            app.setState({
              newElement: _detectedElement,
              selectedLinearElement: {
                ...linearElement,
                pointerOffset: {
                  x: 0,
                  y: 0,
                },
                initialState: {
                  ...linearElement.initialState,
                  lastClickedPoint: 1,
                },
                selectedPointsIndices: [1],
              },
            });
          });

          app.actionManager.executeAction(actionFinalize, "ui", {
            event: childEvent,
            sceneCoords: { x, y },
          });
        }
      }
    }

    app.actionManager.executeAction(actionFinalize);
    this.trail.clearTrails();
  };
}
