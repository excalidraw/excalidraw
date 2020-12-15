import React from "react";
import { KEYS } from "../keys";
import { t } from "../i18n";
import { register } from "./register";
import {
  AlignBottomIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  CenterHorizontallyIcon,
  CenterVerticallyIcon,
} from "../components/icons";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { getElementMap, getNonDeletedElements } from "../element";
import { ToolButton } from "../components/ToolButton";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { alignElements, Alignment } from "../align";
import { getShortcutKey } from "../utils";
import { trackEvent, EVENT_ALIGN } from "../analytics";

const enableActionGroup = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => getSelectedElements(getNonDeletedElements(elements), appState).length > 1;

const alignSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  alignment: Alignment,
) => {
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );

  const updatedElements = alignElements(selectedElements, alignment);

  const updatedElementsMap = getElementMap(updatedElements);

  return elements.map((element) => updatedElementsMap[element.id] || element);
};

export const actionAlignTop = register({
  name: "alignTop",
  perform: (elements, appState) => {
    trackEvent(EVENT_ALIGN, "align", "top1");
    return {
      appState,
      elements: alignSelectedElements(elements, appState, {
        position: "start",
        axis: "y",
      }),
      commitToHistory: true,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.ARROW_UP,
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      hidden={!enableActionGroup(elements, appState)}
      type="button"
      icon={<AlignTopIcon appearance={appState.appearance} />}
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
  perform: (elements, appState) => {
    trackEvent(EVENT_ALIGN, "align", "bottom");
    return {
      appState,
      elements: alignSelectedElements(elements, appState, {
        position: "end",
        axis: "y",
      }),
      commitToHistory: true,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.ARROW_DOWN,
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      hidden={!enableActionGroup(elements, appState)}
      type="button"
      icon={<AlignBottomIcon appearance={appState.appearance} />}
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
  perform: (elements, appState) => {
    trackEvent(EVENT_ALIGN, "align", "left");
    return {
      appState,
      elements: alignSelectedElements(elements, appState, {
        position: "start",
        axis: "x",
      }),
      commitToHistory: true,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.ARROW_LEFT,
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      hidden={!enableActionGroup(elements, appState)}
      type="button"
      icon={<AlignLeftIcon appearance={appState.appearance} />}
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
  perform: (elements, appState) => {
    trackEvent(EVENT_ALIGN, "align", "right");
    return {
      appState,
      elements: alignSelectedElements(elements, appState, {
        position: "end",
        axis: "x",
      }),
      commitToHistory: true,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.ARROW_RIGHT,
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      hidden={!enableActionGroup(elements, appState)}
      type="button"
      icon={<AlignRightIcon appearance={appState.appearance} />}
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
  perform: (elements, appState) => {
    trackEvent(EVENT_ALIGN, "vertically", "center");
    return {
      appState,
      elements: alignSelectedElements(elements, appState, {
        position: "center",
        axis: "y",
      }),
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      hidden={!enableActionGroup(elements, appState)}
      type="button"
      icon={<CenterVerticallyIcon appearance={appState.appearance} />}
      onClick={() => updateData(null)}
      title={t("labels.centerVertically")}
      aria-label={t("labels.centerVertically")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});

export const actionAlignHorizontallyCentered = register({
  name: "alignHorizontallyCentered",
  perform: (elements, appState) => {
    trackEvent(EVENT_ALIGN, "horizontally", "center");
    return {
      appState,
      elements: alignSelectedElements(elements, appState, {
        position: "center",
        axis: "x",
      }),
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      hidden={!enableActionGroup(elements, appState)}
      type="button"
      icon={<CenterHorizontallyIcon appearance={appState.appearance} />}
      onClick={() => updateData(null)}
      title={t("labels.centerHorizontally")}
      aria-label={t("labels.centerHorizontally")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});
