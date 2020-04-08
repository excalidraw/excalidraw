import { deleteSelectedElements, isSomeElementSelected } from "../scene";
import { KEYS } from "../keys";
import { ToolButton } from "../components/ToolButton";
import React from "react";
import { trash } from "../components/icons";
import { t } from "../i18n";
import { register } from "./register";
import { getNonDeletedElements } from "../element";

export const actionDeleteSelected = register({
  name: "deleteSelectedElements",
  perform: (elements, appState) => {
    const {
      elements: nextElements,
      appState: nextAppState,
    } = deleteSelectedElements(elements, appState);
    return {
      elements: nextElements,
      appState: {
        ...nextAppState,
        elementType: "selection",
        multiElement: null,
      },
      commitToHistory: isSomeElementSelected(
        getNonDeletedElements(elements),
        appState,
      ),
    };
  },
  contextItemLabel: "labels.delete",
  contextMenuOrder: 3,
  keyTest: (event) => event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE,
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      type="button"
      icon={trash}
      title={t("labels.delete")}
      aria-label={t("labels.delete")}
      onClick={() => updateData(null)}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});
