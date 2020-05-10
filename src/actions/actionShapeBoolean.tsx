import React from "react";
import { KEYS } from "../keys";
import { register } from "./register";
import { ExcalidrawElement } from "../element/types";
import { differenceElement, getNonDeletedElements } from "../element";
import { isSomeElementSelected } from "../scene";
import { ToolButton } from "../components/ToolButton";
import { difference } from "../components/icons";
import { t } from "../i18n";
import { getShortcutKey } from "../utils";

export const actionShapeDifference = register({
  name: "shapeDifference",
  perform: (elements, appState) => {
    differenceElement(elements)

    return {
      appState,
      elements,
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
