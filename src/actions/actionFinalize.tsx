import { Action } from "./types";
import { KEYS } from "../keys";
import { clearSelection } from "../scene";
import { isInvisiblySmallElement } from "../element";
import { resetCursor } from "../utils";
import React from "react";
import { ToolButton } from "../components/ToolButton";
import { save } from "../components/icons";
import { t } from "../i18n";

export const actionFinalize: Action = {
  name: "finalize",
  perform: (elements, appState) => {
    let newElements = clearSelection(elements);
    if (window.document.activeElement instanceof HTMLElement) {
      window.document.activeElement.blur();
    }
    if (appState.multiElement) {
      appState.multiElement.points = appState.multiElement.points.slice(
        0,
        appState.multiElement.points.length - 1,
      );
      if (isInvisiblySmallElement(appState.multiElement)) {
        newElements = newElements.slice(0, -1);
      }
      appState.multiElement.shape = null;
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
      },
    };
  },
  keyTest: (event, appState) =>
    (event.key === KEYS.ESCAPE &&
      !appState.draggingElement &&
      appState.multiElement === null) ||
    ((event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) &&
      appState.multiElement !== null),
  PanelComponent: ({ appState, updateData }) => (
    <div
      style={{
        visibility: appState.multiElement !== null ? "visible" : "hidden",
      }}
    >
      <ToolButton
        type="button"
        icon={save}
        title={t("buttons.done")}
        aria-label={t("buttons.done")}
        onClick={() => updateData(null)}
      />
    </div>
  ),
};
