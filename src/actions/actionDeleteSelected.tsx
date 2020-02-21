import { Action } from "./types";
import { deleteSelectedElements, isSomeElementSelected } from "../scene";
import { KEYS } from "../keys";
import { ToolButton } from "../components/ToolButton";
import React from "react";
import { trash } from "../components/icons";
import { t } from "../i18n";

export const actionDeleteSelected: Action = {
  name: "deleteSelectedElements",
  perform: (elements, appState) => {
    return {
      elements: deleteSelectedElements(elements),
      appState: { ...appState, elementType: "selection", multiElement: null },
    };
  },
  contextItemLabel: "labels.delete",
  contextMenuOrder: 3,
  commitToHistory: (_, elements) => isSomeElementSelected(elements),
  keyTest: event => event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE,
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={trash}
      title={t("labels.delete")}
      aria-label={t("labels.delete")}
      onClick={() => updateData(null)}
    />
  ),
};
