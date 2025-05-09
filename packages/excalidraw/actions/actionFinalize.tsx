import { pointFrom } from "@excalidraw/math";

import {
  maybeBindLinearElement,
  bindOrUnbindLinearElement,
} from "@excalidraw/element/binding";
import { LinearElementEditor } from "@excalidraw/element/linearElementEditor";

import {
  isBindingElement,
  isLinearElement,
} from "@excalidraw/element/typeChecks";

import { KEYS, arrayToMap, updateActiveTool } from "@excalidraw/common";
import { isPathALoop } from "@excalidraw/element/shapes";

import { isInvisiblySmallElement } from "@excalidraw/element/sizeHelpers";

import type { LocalPoint } from "@excalidraw/math";

import { CaptureUpdateAction } from "@excalidraw/element/store";

import { t } from "../i18n";
import { resetCursor } from "../cursor";
import { done } from "../components/icons";
import { ToolButton } from "../components/ToolButton";

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
          scene.mutateElement(multiPointElement, {
            points: multiPointElement.points.slice(0, -1),
          });
        }
      }

      if (isInvisiblySmallElement(multiPointElement)) {
        const [x, y] = multiPointElement.points[0];
        const extraPoint = [x + Math.random() * 60, y + Math.random() * 60];
        scene.mutateElement(multiPointElement, {
          points: [...multiPointElement.points, extraPoint] as LocalPoint[],
          isDeleted: true,
        });
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
          scene.mutateElement(multiPointElement, {
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
        maybeBindLinearElement(multiPointElement, appState, { x, y }, scene);
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
      elements,
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
            ? new LinearElementEditor(multiPointElement, arrayToMap(elements))
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
