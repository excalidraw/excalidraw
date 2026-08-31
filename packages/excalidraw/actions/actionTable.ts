import { CaptureUpdateAction } from "@excalidraw/element";

import {
  isTableElement,
  insertTableRow,
  insertTableColumn,
  deleteTableRow,
  deleteTableColumn,
} from "../table";

import { register } from "./register";

export const actionTableAddRowAbove = register({
  name: "tableAddRowAbove",
  label: "labels.table_addRowAbove",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    return selectedElements.some(isTableElement);
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    const targetElement = selectedElements.find(isTableElement);
    if (!targetElement) {
      return { elements, appState, captureUpdate: CaptureUpdateAction.NEVER };
    }
    const result = insertTableRow(elements, targetElement, "above", appState);
    return {
      elements: result.elements,
      appState: result.appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionTableAddRowBelow = register({
  name: "tableAddRowBelow",
  label: "labels.table_addRowBelow",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    return selectedElements.some(isTableElement);
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    const targetElement = selectedElements.find(isTableElement);
    if (!targetElement) {
      return { elements, appState, captureUpdate: CaptureUpdateAction.NEVER };
    }
    const result = insertTableRow(elements, targetElement, "below", appState);
    return {
      elements: result.elements,
      appState: result.appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionTableAddColLeft = register({
  name: "tableAddColLeft",
  label: "labels.table_addColLeft",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    return selectedElements.some(isTableElement);
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    const targetElement = selectedElements.find(isTableElement);
    if (!targetElement) {
      return { elements, appState, captureUpdate: CaptureUpdateAction.NEVER };
    }
    const result = insertTableColumn(elements, targetElement, "left", appState);
    return {
      elements: result.elements,
      appState: result.appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionTableAddColRight = register({
  name: "tableAddColRight",
  label: "labels.table_addColRight",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    return selectedElements.some(isTableElement);
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    const targetElement = selectedElements.find(isTableElement);
    if (!targetElement) {
      return { elements, appState, captureUpdate: CaptureUpdateAction.NEVER };
    }
    const result = insertTableColumn(elements, targetElement, "right", appState);
    return {
      elements: result.elements,
      appState: result.appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionTableDeleteRow = register({
  name: "tableDeleteRow",
  label: "labels.table_deleteRow",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    return selectedElements.some(isTableElement);
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    const targetElement = selectedElements.find(isTableElement);
    if (!targetElement) {
      return { elements, appState, captureUpdate: CaptureUpdateAction.NEVER };
    }
    const result = deleteTableRow(elements, targetElement, appState);
    return {
      elements: result.elements,
      appState: result.appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionTableDeleteCol = register({
  name: "tableDeleteCol",
  label: "labels.table_deleteCol",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    return selectedElements.some(isTableElement);
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    const targetElement = selectedElements.find(isTableElement);
    if (!targetElement) {
      return { elements, appState, captureUpdate: CaptureUpdateAction.NEVER };
    }
    const result = deleteTableColumn(elements, targetElement, appState);
    return {
      elements: result.elements,
      appState: result.appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
