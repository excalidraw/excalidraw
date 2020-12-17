import React from "react";
import { CODES } from "../keys";
import { t } from "../i18n";
import { register } from "./register";
import {
  DistributeHorizontallyIcon,
  DistributeVerticallyIcon,
} from "../components/icons";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { getElementMap, getNonDeletedElements } from "../element";
import { ToolButton } from "../components/ToolButton";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { distributeElements, Distribution } from "../disitrubte";
import { getShortcutKey } from "../utils";
import { EVENT_ALIGN, trackEvent } from "../analytics";

const enableActionGroup = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => getSelectedElements(getNonDeletedElements(elements), appState).length > 1;

const distributeSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  distribution: Distribution,
) => {
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );

  const updatedElements = distributeElements(selectedElements, distribution);

  const updatedElementsMap = getElementMap(updatedElements);

  return elements.map((element) => updatedElementsMap[element.id] || element);
};

export const distributeHorizontally = register({
  name: "distributeHorizontally",
  perform: (elements, appState) => {
    trackEvent(EVENT_ALIGN, "distribute", "horizontally");
    return {
      appState,
      elements: distributeSelectedElements(elements, appState, {
        space: "between",
        axis: "x",
      }),
      commitToHistory: true,
    };
  },
  keyTest: (event) => event.altKey && event.code === CODES.H,
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      hidden={!enableActionGroup(elements, appState)}
      type="button"
      icon={<DistributeHorizontallyIcon appearance={appState.appearance} />}
      onClick={() => updateData(null)}
      title={`${t("labels.distributeHorizontally")} — ${getShortcutKey(
        "Alt+H",
      )}`}
      aria-label={t("labels.distributeHorizontally")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});

export const distributeVertically = register({
  name: "distributeVertically",
  perform: (elements, appState) => {
    trackEvent(EVENT_ALIGN, "distribute", "vertically");
    return {
      appState,
      elements: distributeSelectedElements(elements, appState, {
        space: "between",
        axis: "y",
      }),
      commitToHistory: true,
    };
  },
  keyTest: (event) => event.altKey && event.code === CODES.V,
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      hidden={!enableActionGroup(elements, appState)}
      type="button"
      icon={<DistributeVerticallyIcon appearance={appState.appearance} />}
      onClick={() => updateData(null)}
      title={`${t("labels.distributeVertically")} — ${getShortcutKey("Alt+V")}`}
      aria-label={t("labels.distributeVertically")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});
