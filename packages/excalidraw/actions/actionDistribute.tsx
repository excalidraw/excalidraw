import {
  DistributeHorizontallyIcon,
  DistributeVerticallyIcon,
} from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { distributeElements, Distribution } from "../distribute";
import { getNonDeletedElements } from "../element";
import { isFrameLikeElement } from "../element/typeChecks";
import { ExcalidrawElement } from "../element/types";
import { updateFrameMembershipOfSelectedElements } from "../frame";
import { t } from "../i18n";
import { CODES, KEYS } from "../keys";
import { isSomeElementSelected } from "../scene";
import { AppClassProperties, AppState } from "../types";
import { arrayToMap, getShortcutKey } from "../utils";
import { register } from "./register";

const enableActionGroup = (appState: AppState, app: AppClassProperties) => {
  const selectedElements = app.scene.getSelectedElements(appState);
  return (
    selectedElements.length > 1 &&
    // TODO enable distributing frames when implemented properly
    !selectedElements.some((el) => isFrameLikeElement(el))
  );
};

const distributeSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
  distribution: Distribution,
) => {
  const selectedElements = app.scene.getSelectedElements(appState);

  const updatedElements = distributeElements(selectedElements, distribution);

  const updatedElementsMap = arrayToMap(updatedElements);

  return updateFrameMembershipOfSelectedElements(
    elements.map((element) => updatedElementsMap.get(element.id) || element),
    appState,
    app,
  );
};

export const distributeHorizontally = register({
  name: "distributeHorizontally",
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: distributeSelectedElements(elements, appState, app, {
        space: "between",
        axis: "x",
      }),
      commitToHistory: true,
    };
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.H,
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <ToolButton
      hidden={!enableActionGroup(appState, app)}
      type="button"
      icon={DistributeHorizontallyIcon}
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
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: distributeSelectedElements(elements, appState, app, {
        space: "between",
        axis: "y",
      }),
      commitToHistory: true,
    };
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.V,
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <ToolButton
      hidden={!enableActionGroup(appState, app)}
      type="button"
      icon={DistributeVerticallyIcon}
      onClick={() => updateData(null)}
      title={`${t("labels.distributeVertically")} — ${getShortcutKey("Alt+V")}`}
      aria-label={t("labels.distributeVertically")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});
