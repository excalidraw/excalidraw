import { arrayToMap, getShortcutKey, KEYS, matchKey } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { updateFrameMembershipOfSelectedElements } from "@excalidraw/element/frame";

import { arrangeElements } from "@excalidraw/element/arrange";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { TableCellsIcon } from "../components/icons";

import { t } from "../i18n";

import { register } from "./register";

import { alignActionsPredicate } from "./actionAlign";

import type { AppClassProperties, AppState } from "../types";

const arrangeSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const selectedElements = app.scene.getSelectedElements(appState);
  const elementsMap = arrayToMap(elements);
  const updatedElements = arrangeElements(
    app.scene,
    selectedElements,
    elementsMap,
    appState.arrangeConfiguration.algorithm,
    appState.arrangeConfiguration.gap,
  );

  const updatedElementsMap = arrayToMap(updatedElements);
  return updateFrameMembershipOfSelectedElements(
    elements.map((element) => updatedElementsMap.get(element.id) || element),
    appState,
    app,
  );
};

// Note that this is basically the same as alignActions so the conditions
// to use this action are the same
export const arrangeElementsPredicate = alignActionsPredicate;

/**
 * Arranges selected elements in to be positioned nicely next to each
 * other.
 *
 * Takes into account the current state's gap setting or selected algorithm
 */
export const actionArrangeElements = register({
  name: "arrangeElements",
  label: "labels.arrangeElements",
  keywords: ["arrange", "rearrange", "spread"],
  icon: TableCellsIcon,
  trackEvent: { category: "element" },
  viewMode: false,
  predicate: (_elements, appState, _appProps, app) =>
    arrangeElementsPredicate(appState, app),
  perform: (elements, appState, _value, app) => {
    return {
      appState,
      elements: arrangeSelectedElements(elements, appState, app),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) => event.shiftKey && matchKey(event, KEYS.R),
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="arrangeButton"
      onClick={() => updateData(null)}
      title={`${t("labels.arrangeElements")} — ${getShortcutKey("Shift+R")}`}
    >
      {TableCellsIcon}
    </button>
  ),
});
