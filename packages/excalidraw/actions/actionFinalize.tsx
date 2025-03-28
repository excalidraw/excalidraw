import { pointFrom } from "@excalidraw/math";

import {
  maybeBindLinearElement,
  bindOrUnbindLinearElement,
} from "@excalidraw/element/binding";
import { LinearElementEditor } from "@excalidraw/element/linearElementEditor";
import { mutateElement } from "@excalidraw/element/mutateElement";
import {
  isBindingElement,
  isLinearElement,
} from "@excalidraw/element/typeChecks";

import { KEYS, arrayToMap, updateActiveTool } from "@excalidraw/common";
import { isPathALoop } from "@excalidraw/element/shapes";

import { isInvisiblySmallElement } from "@excalidraw/element/sizeHelpers";

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
  perform: (elements, appState, _, app) => {
    const { interactiveCanvas, focusContainer, scene } = app;

    const elementsMap = scene.getNonDeletedElementsMap();

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
            elementsMap,
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
      mutateElement(pendingImageElement, { isDeleted: true }, false);
    }

    if (window.document.activeElement instanceof HTMLElement) {
      focusContainer();
    }

    const multiPointElement = appState.multiElement
      ? appState.multiElement
      : appState.newElement?.type === "freedraw"
      ? appState.newElement
      : null;

    if (multiPointElement) {
      // pen and mouse have hover
      if (
        multiPointElement.type !== "freedraw" &&
        appState.lastPointerDownWith !== "touch"
      ) {
        const { points, lastCommittedPoint } = multiPointElement;
        if (
          !lastCommittedPoint ||
          points[points.length - 1] !== lastCommittedPoint
        ) {
          mutateElement(multiPointElement, {
            points: multiPointElement.points.slice(0, -1),
          });
        }
      }

      if (isInvisiblySmallElement(multiPointElement)) {
        // TODO: #7348 in theory this gets recorded by the store, so the invisible elements could be restored by the undo/redo, which might be not what we would want
        newElements = newElements.filter(
          (el) => el.id !== multiPointElement.id,
        );
      }

      // If the multi point line closes the loop,
      // set the last point to first point.
      // This ensures that loop remains closed at different scales.
      const isLoop = isPathALoop(multiPointElement.points, appState.zoom.value);
      if (
        multiPointElement.type === "line" ||
        multiPointElement.type === "freedraw"
      ) {
        if (isLoop) {
          const linePoints = multiPointElement.points;
          const firstPoint = linePoints[0];
          mutateElement(multiPointElement, {
            points: linePoints.map((p, index) =>
              index === linePoints.length - 1
                ? pointFrom(firstPoint[0], firstPoint[1])
                : p,
            ),
          });
        }
      }

      if (
        isBindingElement(multiPointElement) &&
        !isLoop &&
        multiPointElement.points.length > 1
      ) {
        const [x, y] = LinearElementEditor.getPointAtIndexGlobalCoordinates(
          multiPointElement,
          -1,
          arrayToMap(elements),
        );
        maybeBindLinearElement(
          multiPointElement,
          appState,
          { x, y },
          elementsMap,
          elements,
        );
      }
    }

    if (
      (!appState.activeTool.locked &&
        appState.activeTool.type !== "freedraw") ||
      !multiPointElement
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
          multiPointElement
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
          multiPointElement &&
          !appState.activeTool.locked &&
          appState.activeTool.type !== "freedraw"
            ? {
                ...appState.selectedElementIds,
                [multiPointElement.id]: true,
              }
            : appState.selectedElementIds,
        // To select the linear element when user has finished mutipoint editing
        selectedLinearElement:
          multiPointElement && isLinearElement(multiPointElement)
            ? new LinearElementEditor(multiPointElement)
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
