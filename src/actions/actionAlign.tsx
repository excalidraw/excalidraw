import React from "react";
import { KEYS } from "../keys";
import { t } from "../i18n";
import { register } from "./register";
import { GroupIcon } from "../components/icons";
import { newElementWith } from "../element/mutateElement";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { getNonDeletedElements } from "../element";
import { ToolButton } from "../components/ToolButton";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";

const enableActionGroup = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => getSelectedElements(getNonDeletedElements(elements), appState).length > 1;

const alignElements = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  callback: (element: ExcalidrawElement) => ExcalidrawElement,
) =>
  elements.map((element) =>
    appState.selectedElementIds[element.id] ? callback(element) : element,
  );

export const actionAlignTop = register({
  name: "alignTop",
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );

    const staticElement = selectedElements.reduce((topmost, current) =>
      current.y < topmost.y ? current : topmost,
    );

    const updatedElements = alignElements(elements, appState, (element) =>
      newElementWith(element, { y: staticElement.y }),
    );

    return {
      appState,
      elements: updatedElements,
      commitToHistory: true,
    };
  },
  contextMenuOrder: 20,
  contextItemLabel: "labels.alignTop",
  contextItemPredicate: (elements, appState) =>
    enableActionGroup(elements, appState),
  keyTest: (event) => {
    return (
      event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.ARROW_UP
    );
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      hidden={false && !enableActionGroup(elements, appState)}
      type="button"
      icon={<GroupIcon appearance={appState.appearance} />}
      onClick={() => updateData(null)}
      title={t("labels.alignTop")}
      aria-label={t("labels.alignTop")}
      visible={
        true || isSomeElementSelected(getNonDeletedElements(elements), appState)
      }
    ></ToolButton>
  ),
});

export const actionAlignBottom = register({
  name: "alignBottom",
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );

    const staticElement = selectedElements.reduce((bottommost, current) =>
      current.y + current.height > bottommost.y + bottommost.height
        ? current
        : bottommost,
    );

    const updatedElements = alignElements(elements, appState, (element) =>
      newElementWith(element, {
        y: staticElement.y + staticElement.height - element.height,
      }),
    );

    return {
      appState,
      elements: updatedElements,
      commitToHistory: true,
    };
  },
  contextMenuOrder: 21,
  contextItemLabel: "labels.alignBottom",
  contextItemPredicate: (elements, appState) =>
    enableActionGroup(elements, appState),
  keyTest: (event) => {
    return (
      event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.ARROW_DOWN
    );
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      hidden={false && !enableActionGroup(elements, appState)}
      type="button"
      icon={<GroupIcon appearance={appState.appearance} />}
      onClick={() => updateData(null)}
      title={t("labels.alignBottom")}
      aria-label={t("labels.alignBottom")}
      visible={
        true || isSomeElementSelected(getNonDeletedElements(elements), appState)
      }
    ></ToolButton>
  ),
});

export const actionAlignLeft = register({
  name: "alignLeft",
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );

    const staticElement = selectedElements.reduce((leftmost, current) =>
      current.x < leftmost.x ? current : leftmost,
    );

    const updatedElements = alignElements(elements, appState, (element) =>
      newElementWith(element, {
        x: staticElement.x,
      }),
    );

    return {
      appState,
      elements: updatedElements,
      commitToHistory: true,
    };
  },
  contextMenuOrder: 22,
  contextItemLabel: "labels.alignLeft",
  contextItemPredicate: (elements, appState) =>
    enableActionGroup(elements, appState),
  keyTest: (event) => {
    return (
      event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.ARROW_LEFT
    );
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      hidden={false && !enableActionGroup(elements, appState)}
      type="button"
      icon={<GroupIcon appearance={appState.appearance} />}
      onClick={() => updateData(null)}
      title={t("labels.alignLeft")}
      aria-label={t("labels.alignLeft")}
      visible={
        true || isSomeElementSelected(getNonDeletedElements(elements), appState)
      }
    ></ToolButton>
  ),
});

export const actionAlignRight = register({
  name: "alignRight",
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );

    const staticElement = selectedElements.reduce((rightmost, current) =>
      current.x + current.width > rightmost.x + rightmost.width
        ? current
        : rightmost,
    );

    const updatedElements = alignElements(elements, appState, (element) =>
      newElementWith(element, {
        x: staticElement.x + staticElement.width - element.width,
      }),
    );

    return {
      appState,
      elements: updatedElements,
      commitToHistory: true,
    };
  },
  contextMenuOrder: 23,
  contextItemLabel: "labels.alignRight",
  contextItemPredicate: (elements, appState) =>
    enableActionGroup(elements, appState),
  keyTest: (event) => {
    return (
      event[KEYS.CTRL_OR_CMD] &&
      event.shiftKey &&
      event.key === KEYS.ARROW_RIGHT
    );
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      hidden={false && !enableActionGroup(elements, appState)}
      type="button"
      icon={<GroupIcon appearance={appState.appearance} />}
      onClick={() => updateData(null)}
      title={t("labels.alignRight")}
      aria-label={t("labels.alignRight")}
      visible={
        true || isSomeElementSelected(getNonDeletedElements(elements), appState)
      }
    ></ToolButton>
  ),
});

export const actionAlignVerticallyCentered = register({
  name: "alignVerticallyCentered",
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );

    const topmostElement = selectedElements.reduce((topmost, current) =>
      current.y < topmost.y ? current : topmost,
    );

    const bottommostElement = selectedElements.reduce((bottommost, current) =>
      current.y + current.height > bottommost.y + bottommost.height
        ? current
        : bottommost,
    );

    const selectionCenterY =
      (topmostElement.y + bottommostElement.y + bottommostElement.height) / 2;

    const updatedElements = alignElements(elements, appState, (element) =>
      newElementWith(element, {
        y: selectionCenterY - element.height / 2,
      }),
    );

    return {
      appState,
      elements: updatedElements,
      commitToHistory: true,
    };
  },
  contextMenuOrder: 24,
  contextItemLabel: "labels.centerVertically",
  contextItemPredicate: (elements, appState) =>
    enableActionGroup(elements, appState),
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      hidden={false && !enableActionGroup(elements, appState)}
      type="button"
      icon={<GroupIcon appearance={appState.appearance} />}
      onClick={() => updateData(null)}
      title={t("labels.centerVertically")}
      aria-label={t("labels.centerVertically")}
      visible={
        true || isSomeElementSelected(getNonDeletedElements(elements), appState)
      }
    ></ToolButton>
  ),
});

export const actionAlignHorizontallyCentered = register({
  name: "alignHorizontallyCentered",
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );

    const leftmostElement = selectedElements.reduce((leftmost, current) =>
      current.x < leftmost.x ? current : leftmost,
    );

    const rightmostElement = selectedElements.reduce((rightmost, current) =>
      current.x + current.width > rightmost.x + rightmost.width
        ? current
        : rightmost,
    );

    const selectionCenterX =
      (leftmostElement.x + rightmostElement.x + rightmostElement.width) / 2;

    const updatedElements = alignElements(elements, appState, (element) =>
      newElementWith(element, {
        x: selectionCenterX - element.width / 2,
      }),
    );

    return {
      appState,
      elements: updatedElements,
      commitToHistory: true,
    };
  },
  contextMenuOrder: 25,
  contextItemLabel: "labels.centerHorizontally",
  contextItemPredicate: (elements, appState) =>
    enableActionGroup(elements, appState),
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      hidden={false && !enableActionGroup(elements, appState)}
      type="button"
      icon={<GroupIcon appearance={appState.appearance} />}
      onClick={() => updateData(null)}
      title={t("labels.centerHorizontally")}
      aria-label={t("labels.centerHorizontally")}
      visible={
        true || isSomeElementSelected(getNonDeletedElements(elements), appState)
      }
    ></ToolButton>
  ),
});
