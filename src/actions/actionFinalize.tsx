import { KEYS } from "../keys";
import { isInvisiblySmallElement } from "../element";
import { resetCursor } from "../utils";
import React from "react";
import { ToolButton } from "../components/ToolButton";
import { done } from "../components/icons";
import { t } from "../i18n";
import { register } from "./register";
import { mutateElement } from "../element/mutateElement";
import { isPathALoop } from "../math";

export const actionFinalize = register({
  name: "finalize",
  perform: (elements, appState) => {
    let newElements = elements;
    if (window.document.activeElement instanceof HTMLElement) {
      window.document.activeElement.blur();
    }
    if (appState.multiElement) {
      // pen and mouse have hover
      if (appState.lastPointerDownWith !== "touch") {
        const { points, lastCommittedPoint } = appState.multiElement;
        if (
          !lastCommittedPoint ||
          points[points.length - 1] !== lastCommittedPoint
        ) {
          mutateElement(appState.multiElement, {
            points: appState.multiElement.points.slice(0, -1),
          });
        }
      }
      if (isInvisiblySmallElement(appState.multiElement)) {
        newElements = newElements.slice(0, -1);
      }

      // If the multi point line closes the loop,
      // set the last point to first point.
      // This ensures that loop remains closed at different scales.
      if (appState.multiElement.type === "line") {
        if (isPathALoop(appState.multiElement.points)) {
          const linePoints = appState.multiElement.points;
          const firstPoint = linePoints[0];
          mutateElement(appState.multiElement, {
            points: linePoints.map((point, i) =>
              i === linePoints.length - 1
                ? ([firstPoint[0], firstPoint[1]] as const)
                : point,
            ),
          });
        }
      }

      if (!appState.elementLocked) {
        appState.selectedElementIds[appState.multiElement.id] = true;
      }
    }
    if (!appState.elementLocked || !appState.multiElement) {
      resetCursor();
    }
    return {
      elements: newElements,
      appState: {
        ...appState,
        elementType:
          appState.elementLocked && appState.multiElement
            ? appState.elementType
            : "selection",
        draggingElement: null,
        multiElement: null,
        editingElement: null,
        selectedElementIds: {},
      },
      commitToHistory: false,
    };
  },
  keyTest: (event, appState) =>
    (event.key === KEYS.ESCAPE &&
      !appState.draggingElement &&
      appState.multiElement === null) ||
    ((event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) &&
      appState.multiElement !== null),
  PanelComponent: ({ appState, updateData }) => (
    <ToolButton
      type="button"
      icon={done}
      title={t("buttons.done")}
      aria-label={t("buttons.done")}
      onClick={updateData}
      visible={appState.multiElement != null}
    />
  ),
});
