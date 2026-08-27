import { getNonDeletedElements } from "@excalidraw/element";

import { isFrameLikeElement } from "@excalidraw/element";

import { updateFrameMembershipOfSelectedElements } from "@excalidraw/element";

import { KEYS, arrayToMap, getShortcutKey } from "@excalidraw/common";

import { alignElements } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import { getSelectedElementsByGroup } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { Alignment } from "@excalidraw/element";

import { ToolButton } from "../components/ToolButton";
import {
  AlignBottomIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  CenterHorizontallyIcon,
  CenterVerticallyIcon,
} from "../components/icons";

import { t } from "../i18n";

import { isSomeElementSelected } from "../scene";

import { register } from "./register";

import type { AppClassProperties, AppState, UIAppState } from "../types";

export const alignActionsPredicate = (
  appState: UIAppState,
  app: AppClassProperties,
) => {
  const selectedElements = app.scene.getSelectedElements(appState);
  return (
    getSelectedElementsByGroup(
      selectedElements,
      app.scene.getNonDeletedElementsMap(),
      appState as Readonly<AppState>,
    ).length > 1 &&
    // TODO enable aligning frames when implemented properly
    !selectedElements.some((el) => isFrameLikeElement(el))
  );
};

const alignSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
  alignment: Alignment,
) => {
  const selectedElements = app.scene.getSelectedElements(appState);

  const updatedElements = alignElements(
    selectedElements,
    alignment,
    app.scene,
    appState,
  );

  const updatedElementsMap = arrayToMap(updatedElements);

  return updateFrameMembershipOfSelectedElements(
    elements.map((element) => updatedElementsMap.get(element.id) || element),
    appState,
    app,
  );
};

export const actionAlignTop = register({
  name: "alignTop",
  label: "labels.alignTop",
  icon: AlignTopIcon,
  trackEvent: { category: "element" },
  predicate: (elements, appState, appProps, app) =>
    alignActionsPredicate(appState, app),
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: alignSelectedElements(elements, appState, app, {
        position: "start",
        axis: "y",
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.ARROW_UP,
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <ToolButton
      hidden={!alignActionsPredicate(appState, app)}
      type="button"
      icon={AlignTopIcon}
      onClick={() => updateData(null)}
      title={`${t("labels.alignTop")} — ${getShortcutKey(
        "CtrlOrCmd+Shift+Up",
      )}`}
      aria-label={t("labels.alignTop")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});

export const actionAlignBottom = register({
  name: "alignBottom",
  label: "labels.alignBottom",
  icon: AlignBottomIcon,
  trackEvent: { category: "element" },
  predicate: (elements, appState, appProps, app) =>
    alignActionsPredicate(appState, app),
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: alignSelectedElements(elements, appState, app, {
        position: "end",
        axis: "y",
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.ARROW_DOWN,
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <ToolButton
      hidden={!alignActionsPredicate(appState, app)}
      type="button"
      icon={AlignBottomIcon}
      onClick={() => updateData(null)}
      title={`${t("labels.alignBottom")} — ${getShortcutKey(
        "CtrlOrCmd+Shift+Down",
      )}`}
      aria-label={t("labels.alignBottom")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});

export const actionAlignLeft = register({
  name: "alignLeft",
  label: "labels.alignLeft",
  icon: AlignLeftIcon,
  trackEvent: { category: "element" },
  predicate: (elements, appState, appProps, app) =>
    alignActionsPredicate(appState, app),
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: alignSelectedElements(elements, appState, app, {
        position: "start",
        axis: "x",
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.ARROW_LEFT,
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <ToolButton
      hidden={!alignActionsPredicate(appState, app)}
      type="button"
      icon={AlignLeftIcon}
      onClick={() => updateData(null)}
      title={`${t("labels.alignLeft")} — ${getShortcutKey(
        "CtrlOrCmd+Shift+Left",
      )}`}
      aria-label={t("labels.alignLeft")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});

export const actionAlignRight = register({
  name: "alignRight",
  label: "labels.alignRight",
  icon: AlignRightIcon,
  trackEvent: { category: "element" },
  predicate: (elements, appState, appProps, app) =>
    alignActionsPredicate(appState, app),
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: alignSelectedElements(elements, appState, app, {
        position: "end",
        axis: "x",
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.ARROW_RIGHT,
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <ToolButton
      hidden={!alignActionsPredicate(appState, app)}
      type="button"
      icon={AlignRightIcon}
      onClick={() => updateData(null)}
      title={`${t("labels.alignRight")} — ${getShortcutKey(
        "CtrlOrCmd+Shift+Right",
      )}`}
      aria-label={t("labels.alignRight")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});

export const actionAlignVerticallyCentered = register({
  name: "alignVerticallyCentered",
  label: "labels.centerVertically",
  icon: CenterVerticallyIcon,
  trackEvent: { category: "element" },
  predicate: (elements, appState, appProps, app) =>
    alignActionsPredicate(appState, app),
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: alignSelectedElements(elements, appState, app, {
        position: "center",
        axis: "y",
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <ToolButton
      hidden={!alignActionsPredicate(appState, app)}
      type="button"
      icon={CenterVerticallyIcon}
      onClick={() => updateData(null)}
      title={t("labels.centerVertically")}
      aria-label={t("labels.centerVertically")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});

export const actionAlignHorizontallyCentered = register({
  name: "alignHorizontallyCentered",
  label: "labels.centerHorizontally",
  icon: CenterHorizontallyIcon,
  trackEvent: { category: "element" },
  predicate: (elements, appState, appProps, app) =>
    alignActionsPredicate(appState, app),
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: alignSelectedElements(elements, appState, app, {
        position: "center",
        axis: "x",
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <ToolButton
      hidden={!alignActionsPredicate(appState, app)}
      type="button"
      icon={CenterHorizontallyIcon}
      onClick={() => updateData(null)}
      title={t("labels.centerHorizontally")}
      aria-label={t("labels.centerHorizontally")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});
