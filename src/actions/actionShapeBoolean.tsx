import React from "react";
import rough from "roughjs/bin/rough";
import { KEYS } from "../keys";
import { register } from "./register";
import { AppState } from "../types";
import { ExcalidrawElement } from "../element/types";
import { differenceElement, getNonDeletedElements } from "../element";
import { deleteSelectedElements, isSomeElementSelected } from "../scene";
import { ToolButton } from "../components/ToolButton";
import { difference } from "../components/icons";
import { t } from "../i18n";
import { getShortcutKey } from "../utils";

interface SelectedElements {
  elements: readonly ExcalidrawElement[];
  firstSelectedIndex: number;
}

function getSelectedElements(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) {
  const selectedElements = {} as SelectedElements;
  selectedElements.firstSelectedIndex = -1;

  selectedElements.elements = elements.filter(({ id }, i) => {
    if (appState.selectedElementIds[id]) {
      if (selectedElements.firstSelectedIndex === -1) {
        selectedElements.firstSelectedIndex = i;
      }

      return true;
    }

    return false;
  });

  return selectedElements;
}

export const actionShapeDifference = register({
  name: "shapeDifference",
  perform: (elements, appState) => {
    const canvas = document.createElement("canvas");
    const rc = rough.canvas(canvas);
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );

    const newElement = selectedElements.elements.reduce(
      (acc: ExcalidrawElement, element: ExcalidrawElement) => {
        if (!acc) {
          return element;
        }

        return differenceElement(acc, element, rc);
      },
    );

    // const {
    //   elements: nextElements,
    //   appState: nextAppState,
    // } = deleteSelectedElements(elements, appState);

    // nextElements.splice(selectedElements.firstSelectedIndex, 0, newElement);

    return {
      elements: [...elements, newElement],
      appState: appState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.shapeDifference",
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === "d",
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      type="button"
      icon={difference}
      title={`${t("labels.shapeDifference")} — ${getShortcutKey(
        "CtrlOrCmd+-",
      )}`}
      aria-label={t("labels.shapeDifference")}
      onClick={() => updateData(null)}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});
