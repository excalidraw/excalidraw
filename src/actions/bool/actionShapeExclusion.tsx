import React from "react";
import { register } from "../register";
import { ToolButton } from "../../components/ToolButton";
import { exclusion } from "../../components/icons";
import { t } from "../../i18n";
import { getShortcutKey } from "../../utils";
import { isBoolable, performShapeBool } from "./commonBoolHelpers";

export const actionShapeExclusion = register({
  name: "shapeExclusion",
  perform: (elements, appState) => {
    const { nextElements, nextAppState } = performShapeBool(
      elements,
      appState,
      "exclusion",
    );

    return {
      elements: nextElements,
      appState: nextAppState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.shapeExclusion",
  keyTest: (event) => event.altKey && event.key === "§",
  PanelComponent: ({ elements, appState, updateData }) =>
    isBoolable(elements, appState) ? (
      <ToolButton
        type="button"
        icon={exclusion}
        title={`${t("labels.shapeExclusion")} — ${getShortcutKey("Alt+^")}`}
        aria-label={t("labels.shapeExclusion")}
        onClick={() => updateData(null)}
      />
    ) : null,
});
