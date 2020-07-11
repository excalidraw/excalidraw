import React from "react";
import { register } from "../register";
import { ToolButton } from "../../components/ToolButton";
import { union } from "../../components/icons";
import { t } from "../../i18n";
import { getShortcutKey } from "../../utils";
import { isBoolable, performShapeBool } from "./commonBoolHelpers";

export const actionShapeUnion = register({
  name: "shapeUnion",
  perform: (elements, appState) => {
    const { nextElements, nextAppState } = performShapeBool(
      elements,
      appState,
      "union",
    );

    return {
      elements: nextElements,
      appState: nextAppState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.shapeUnion",
  keyTest: (event) => event.altKey && event.key === "≠",
  PanelComponent: ({ elements, appState, updateData }) =>
    isBoolable(elements, appState) ? (
      <ToolButton
        type="button"
        icon={union}
        title={`${t("labels.shapeUnion")} — ${getShortcutKey("Alt++")}`}
        aria-label={t("labels.shapeUnion")}
        onClick={() => updateData(null)}
      />
    ) : null,
});
