import React from "react";
import { KEYS } from "../keys";
import { register } from "./register";
import { ExcalidrawElement } from "../element/types";
import { duplicateElement, getNonDeletedElements } from "../element";
import { isSomeElementSelected } from "../scene";
import { ToolButton } from "../components/ToolButton";
import { clone } from "../components/icons";
import { t } from "../i18n";
import { getShortcutKey } from "../utils";

export const actionDuplicateSelection = register({
  name: "duplicateSelection",
  perform: (elements, appState) => {
    return {
      appState,
      elements: elements.reduce(
        (acc: Array<ExcalidrawElement>, element: ExcalidrawElement) => {
          if (appState.selectedElementIds[element.id]) {
            const newElement = duplicateElement(element, {
              x: element.x + 10,
              y: element.y + 10,
            });
            appState.selectedElementIds[newElement.id] = true;
            delete appState.selectedElementIds[element.id];
            return acc.concat([element, newElement]);
          }
          return acc.concat(element);
        },
        [],
      ),
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.duplicateSelection",
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === "d",
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      type="button"
      icon={clone}
      title={`${t("labels.duplicateSelection")} — ${getShortcutKey(
        "CtrlOrCmd+D",
      )}`}
      aria-label={t("labels.duplicateSelection")}
      onClick={() => updateData(null)}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});
