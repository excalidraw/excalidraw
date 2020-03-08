import { deleteSelectedElements, isSomeElementSelected } from "../scene";
import { KEYS } from "../keys";
import { ToolButton } from "../components/ToolButton";
import React from "react";
import { trash } from "../components/icons";
import { t } from "../i18n";
import { register } from "./register";

export const actionDeleteSelected = register({
  name: "deleteSelectedElements",
  perform: (elements, appState) => {
    return {
      elements: deleteSelectedElements(elements, appState),
      appState: { ...appState, elementType: "selection", multiElement: null },
    };
  },
  contextItemLabel: "labels.delete",
  contextMenuOrder: 3,
  commitToHistory: (appState, elements) =>
    isSomeElementSelected(elements, appState),
  keyTest: event => event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE,
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      type="button"
      icon={trash}
      title={t("labels.delete")}
      aria-label={t("labels.delete")}
      onClick={() => updateData(null)}
      visible={isSomeElementSelected(elements, appState)}
    />
  ),
});
