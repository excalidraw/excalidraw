import React from "react";
import { register } from "../register";
import { ToolButton } from "../../components/ToolButton";
import { difference } from "../../components/icons";
import { t } from "../../i18n";
import { getShortcutKey } from "../../utils";
import { isBoolable, performShapeBool } from "./commonBoolHelpers";

export const actionShapeDifference = register({
  name: "shapeDifference",
  perform: (elements, appState) => {
    const { nextElements, nextAppState } = performShapeBool(
      elements,
      appState,
      "difference",
    );

    return {
      elements: nextElements,
      appState: nextAppState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.shapeDifference",
  keyTest: (event) => event.altKey && event.key === "–",
  PanelComponent: ({ elements, appState, updateData }) =>
    isBoolable(elements, appState) ? (
      <ToolButton
        type="button"
        icon={difference}
        title={`${t("labels.shapeDifference")} — ${getShortcutKey("Alt+-")}`}
        aria-label={t("labels.shapeDifference")}
        onClick={() => updateData(null)}
      />
    ) : null,
});
