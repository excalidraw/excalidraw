import { getNonDeletedElements } from "@excalidraw/element";

import { isFrameLikeElement } from "@excalidraw/element";

import { CODES, KEYS, arrayToMap, getShortcutKey } from "@excalidraw/common";

import { updateFrameMembershipOfSelectedElements } from "@excalidraw/element";

import { distributeElements } from "@excalidraw/element";

import { useContext } from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { getSelectedElementsByGroup } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { Distribution } from "@excalidraw/element";

import { ToolButton } from "../components/ToolButton";
import {
  DistributeHorizontallyIcon,
  DistributeVerticallyIcon,
} from "../components/icons";

import { t } from "../i18n";

import { isSomeElementSelected } from "../scene";

import {
  ExcalidrawPropsCustomOptionsContext,
  type AppClassProperties,
  type AppState,
} from "../types";

import { register } from "./register";

const enableActionGroup = (appState: AppState, app: AppClassProperties) => {
  const selectedElements = app.scene.getSelectedElements(appState);
  return (
    getSelectedElementsByGroup(
      selectedElements,
      app.scene.getNonDeletedElementsMap(),
      appState as Readonly<AppState>,
    ).length > 2 &&
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

  const updatedElements = distributeElements(
    selectedElements,
    app.scene.getNonDeletedElementsMap(),
    distribution,
    appState,
  );

  const updatedElementsMap = arrayToMap(updatedElements);

  return updateFrameMembershipOfSelectedElements(
    elements.map((element) => updatedElementsMap.get(element.id) || element),
    appState,
    app,
  );
};

export const distributeHorizontally = register({
  name: "distributeHorizontally",
  label: "labels.distributeHorizontally",
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: distributeSelectedElements(elements, appState, app, {
        space: "between",
        axis: "x",
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.H,
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const customOptions = useContext(ExcalidrawPropsCustomOptionsContext);

    if (customOptions?.pickerRenders?.layerButtonRender) {
      return customOptions.pickerRenders.layerButtonRender({
        onClick: () => updateData(null),
        title: `${t("labels.distributeHorizontally")}`,
        children: DistributeHorizontallyIcon,
        name: "distributeHorizontally",
        visible: isSomeElementSelected(
          getNonDeletedElements(elements),
          appState,
        ),
        hidden: !enableActionGroup(appState, app),
      });
    }

    return (
      <ToolButton
        hidden={!enableActionGroup(appState, app)}
        type="button"
        icon={DistributeHorizontallyIcon}
        onClick={() => updateData(null)}
        title={`${t("labels.distributeHorizontally")} — ${getShortcutKey(
          "Alt+H",
        )}`}
        aria-label={t("labels.distributeHorizontally")}
        visible={isSomeElementSelected(
          getNonDeletedElements(elements),
          appState,
        )}
      />
    );
  },
});

export const distributeVertically = register({
  name: "distributeVertically",
  label: "labels.distributeVertically",
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: distributeSelectedElements(elements, appState, app, {
        space: "between",
        axis: "y",
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.V,
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const customOptions = useContext(ExcalidrawPropsCustomOptionsContext);

    if (customOptions?.pickerRenders?.layerButtonRender) {
      return customOptions.pickerRenders.layerButtonRender({
        onClick: () => updateData(null),
        title: `${t("labels.distributeVertically")}`,
        children: DistributeVerticallyIcon,
        name: "distributeVertically",
        visible: isSomeElementSelected(
          getNonDeletedElements(elements),
          appState,
        ),
        hidden: !enableActionGroup(appState, app),
      });
    }

    return (
      <ToolButton
        hidden={!enableActionGroup(appState, app)}
        type="button"
        icon={DistributeVerticallyIcon}
        onClick={() => updateData(null)}
        title={`${t("labels.distributeVertically")} — ${getShortcutKey(
          "Alt+V",
        )}`}
        aria-label={t("labels.distributeVertically")}
        visible={isSomeElementSelected(
          getNonDeletedElements(elements),
          appState,
        )}
      />
    );
  },
});
