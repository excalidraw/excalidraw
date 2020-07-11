import React from "react";
import { register } from "../register";
import { ToolButton } from "../../components/ToolButton";
import { intersection } from "../../components/icons";
import { t } from "../../i18n";
import { getShortcutKey } from "../../utils";
import { isBoolable, performShapeBool } from "./commonBoolHelpers";

export const actionShapeIntersection = register({
  name: "shapeIntersection",
  perform: (elements, appState) => {
    const { nextElements, nextAppState } = performShapeBool(
      elements,
      appState,
      "intersection",
    );

    return {
      elements: nextElements,
      appState: nextAppState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.shapeIntersection",
  keyTest: (event) => event.altKey && event.key === "•",
  PanelComponent: ({ elements, appState, updateData }) =>
    isBoolable(elements, appState) ? (
      <ToolButton
        type="button"
        icon={intersection}
        title={`${t("labels.shapeIntersection")} — ${getShortcutKey("Alt+*")}`}
        aria-label={t("labels.shapeIntersection")}
        onClick={() => updateData(null)}
      />
    ) : null,
});
