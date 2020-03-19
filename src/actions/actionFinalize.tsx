import { KEYS } from "../keys";
import { isInvisiblySmallElement } from "../element";
import { resetCursor } from "../utils";
import React from "react";
import { ToolButton } from "../components/ToolButton";
import { done } from "../components/icons";
import { t } from "../i18n";
import { register } from "./register";
import { mutateElement } from "../element/mutateElement";

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
