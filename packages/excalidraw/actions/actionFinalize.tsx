import { pointFrom } from "@excalidraw/math";

import {
  maybeBindLinearElement,
  bindOrUnbindLinearElement,
  isBindingEnabled,
} from "@excalidraw/element/binding";
import { LinearElementEditor } from "@excalidraw/element/linearElementEditor";

import {
  isBindingElement,
  isLinearElement,
} from "@excalidraw/element/typeChecks";

import { KEYS, arrayToMap, updateActiveTool } from "@excalidraw/common";
import { isPathALoop } from "@excalidraw/element/shapes";

import { isInvisiblySmallElement } from "@excalidraw/element/sizeHelpers";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { t } from "../i18n";
import { resetCursor } from "../cursor";
import { done } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { CaptureUpdateAction } from "../store";

import { register } from "./register";

import type { AppState } from "../types";

export const actionFinalize = register({
  name: "finalize",
  label: "",
  trackEvent: false,
  perform: (elements, appState, data, app) => {
    const { interactiveCanvas, focusContainer, scene } = app;

    const elementsMap = scene.getNonDeletedElementsMap();

    if (data?.event && appState.selectedLinearElement) {
      const linearElementEditor = LinearElementEditor.handlePointerUp(
        data.event,
        appState.selectedLinearElement,
        appState,
        app.scene,
      );

      const { startBindingElement, endBindingElement } = linearElementEditor;
      const element = app.scene.getElement(linearElementEditor.elementId);
      if (isBindingElement(element)) {
        bindOrUnbindLinearElement(
          element,
          startBindingElement,
          endBindingElement,
          app.scene,
        );
      }

      if (linearElementEditor !== appState.selectedLinearElement) {
        let newElements = elements;
        if (element && isInvisiblySmallElement(element)) {
          // TODO: #7348 in theory this gets recorded by the store, so the invisible elements could be restored by the undo/redo, which might be not what we would want
          newElements = newElements.filter((el) => el.id !== element!.id);
        }
        return {
          elements: newElements,
          appState: {
            selectedLinearElement: {
              ...linearElementEditor,
              selectedPointsIndices: null,
            },
            suggestedBindings: [],
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        };
      }
    }

    if (appState.editingLinearElement) {
      const { elementId, startBindingElement, endBindingElement } =
        appState.editingLinearElement;
      const element = LinearElementEditor.getElement(elementId, elementsMap);

      if (element) {
        if (isBindingElement(element)) {
          bindOrUnbindLinearElement(
            element,
            startBindingElement,
            endBindingElement,
            scene,
          );
        }
        return {
          elements:
            element.points.length < 2 || isInvisiblySmallElement(element)
              ? elements.filter((el) => el.id !== element.id)
              : undefined,
          appState: {
            ...appState,
            cursorButton: "up",
            editingLinearElement: null,
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        };
      }
    }

    let newElements = elements;

    const pendingImageElement =
      appState.pendingImageElementId &&
      scene.getElement(appState.pendingImageElementId);

    if (pendingImageElement) {
      scene.mutateElement(
        pendingImageElement,
        { isDeleted: true },
        { informMutation: false, isDragging: false },
      );
    }

    if (window.document.activeElement instanceof HTMLElement) {
      focusContainer();
    }

    let element: NonDeleted<ExcalidrawElement> | null = null;
    if (appState.multiElement) {
      element = appState.multiElement;
    } else if (
      appState.newElement?.type === "freedraw" ||
      isBindingElement(appState.newElement)
    ) {
      element = appState.newElement;
    } else if (Object.keys(appState.selectedElementIds).length === 1) {
      const candidate = elementsMap.get(
        Object.keys(appState.selectedElementIds)[0],
      ) as NonDeleted<ExcalidrawLinearElement> | undefined;
      if (candidate) {
        element = candidate;
      }
    }

    if (element) {
      // pen and mouse have hover
      if (
        appState.multiElement &&
        element.type !== "freedraw" &&
        appState.lastPointerDownWith !== "touch"
      ) {
        const { points, lastCommittedPoint } = element;
        if (
          !lastCommittedPoint ||
          points[points.length - 1] !== lastCommittedPoint
        ) {
          scene.mutateElement(element, {
            points: element.points.slice(0, -1),
          });
        }
      }

      if (element && isInvisiblySmallElement(element)) {
        // TODO: #7348 in theory this gets recorded by the store, so the invisible elements could be restored by the undo/redo, which might be not what we would want
        newElements = newElements.filter((el) => el.id !== element!.id);
      }

      if (isLinearElement(element) || element.type === "freedraw") {
        // If the multi point line closes the loop,
        // set the last point to first point.
        // This ensures that loop remains closed at different scales.
        const isLoop = isPathALoop(element.points, appState.zoom.value);
        if (element.type === "line" || element.type === "freedraw") {
          if (isLoop) {
            const linePoints = element.points;
            const firstPoint = linePoints[0];
            scene.mutateElement(element, {
              points: linePoints.map((p, index) =>
                index === linePoints.length - 1
                  ? pointFrom(firstPoint[0], firstPoint[1])
                  : p,
              ),
            });
          }
        }

        if (
          isBindingElement(element) &&
          !isLoop &&
          element.points.length > 1 &&
          isBindingEnabled(appState)
        ) {
          const [x, y] = LinearElementEditor.getPointAtIndexGlobalCoordinates(
            element,
            -1,
            arrayToMap(elements),
          );
          maybeBindLinearElement(element, appState, { x, y }, scene);
        }
      }
    }

    if (
      (!appState.activeTool.locked &&
        appState.activeTool.type !== "freedraw") ||
      !element
    ) {
      resetCursor(interactiveCanvas);
    }

    let activeTool: AppState["activeTool"];
    if (appState.activeTool.type === "eraser") {
      activeTool = updateActiveTool(appState, {
        ...(appState.activeTool.lastActiveTool || {
          type: "selection",
        }),
        lastActiveToolBeforeEraser: null,
      });
    } else {
      activeTool = updateActiveTool(appState, {
        type: "selection",
      });
    }

    return {
      elements: newElements,
      appState: {
        ...appState,
        cursorButton: "up",
        activeTool:
          (appState.activeTool.locked ||
            appState.activeTool.type === "freedraw") &&
          element
            ? appState.activeTool
            : activeTool,
        activeEmbeddable: null,
        newElement: null,
        selectionElement: null,
        multiElement: null,
        editingTextElement: null,
        startBoundElement: null,
        suggestedBindings: [],
        selectedElementIds:
          element &&
          !appState.activeTool.locked &&
          appState.activeTool.type !== "freedraw"
            ? {
                ...appState.selectedElementIds,
                [element.id]: true,
              }
            : appState.selectedElementIds,
        // To select the linear element when user has finished mutipoint editing
        selectedLinearElement:
          element && isLinearElement(element)
            ? new LinearElementEditor(element, arrayToMap(newElements))
            : appState.selectedLinearElement,
        pendingImageElementId: null,
      },
      // TODO: #7348 we should not capture everything, but if we don't, it leads to incosistencies -> revisit
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event, appState) =>
    (event.key === KEYS.ESCAPE &&
      (appState.editingLinearElement !== null ||
        (!appState.newElement && appState.multiElement === null))) ||
    ((event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) &&
      appState.multiElement !== null),
  PanelComponent: ({ appState, updateData, data }) => (
    <ToolButton
      type="button"
      icon={done}
      title={t("buttons.done")}
      aria-label={t("buttons.done")}
      onClick={updateData}
      visible={appState.multiElement != null}
      size={data?.size || "medium"}
      style={{ pointerEvents: "all" }}
    />
  ),
});
