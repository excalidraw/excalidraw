import {
  CaptureUpdateAction,
  getTableFittedToContent,
  getTableWithAddedColumn,
  getTableWithAddedRow,
  getTableWithRemovedColumn,
  getTableWithRemovedRow,
  isTableElement,
  newElementWith,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTableElement,
} from "@excalidraw/element/types";

import { getSelectedElements } from "../scene";

import { register } from "./register";

import type { AppClassProperties, AppState } from "../types";

const getSelectedTable = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  app: AppClassProperties,
): ExcalidrawTableElement | null => {
  const selected = getSelectedElements(elements, appState);
  return selected.length === 1 && isTableElement(selected[0])
    ? selected[0]
    : null;
};

const applyTableUpdate = (
  elements: readonly ExcalidrawElement[],
  table: ExcalidrawTableElement,
  update: Partial<ExcalidrawTableElement> | null,
) => {
  if (!update) {
    return {
      elements,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  }
  return {
    elements: elements.map((element) =>
      element.id === table.id ? newElementWith(element, update) : element,
    ),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

export const actionAddTableRow = register({
  name: "addTableRow",
  label: "labels.addTableRow",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    !!getSelectedTable(elements, appState, app),
  perform: (elements, appState, _, app) => {
    const table = getSelectedTable(elements, appState, app);
    return {
      ...applyTableUpdate(
        elements,
        table!,
        table ? getTableWithAddedRow(table) : null,
      ),
      appState,
    };
  },
});

export const actionAddTableColumn = register({
  name: "addTableColumn",
  label: "labels.addTableColumn",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    !!getSelectedTable(elements, appState, app),
  perform: (elements, appState, _, app) => {
    const table = getSelectedTable(elements, appState, app);
    return {
      ...applyTableUpdate(
        elements,
        table!,
        table ? getTableWithAddedColumn(table) : null,
      ),
      appState,
    };
  },
});

export const actionDeleteTableRow = register({
  name: "deleteTableRow",
  label: "labels.deleteTableRow",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const table = getSelectedTable(elements, appState, app);
    return !!table && table.rows > 1;
  },
  perform: (elements, appState, _, app) => {
    const table = getSelectedTable(elements, appState, app);
    return {
      ...applyTableUpdate(
        elements,
        table!,
        table ? getTableWithRemovedRow(table) : null,
      ),
      appState,
    };
  },
});

export const actionDeleteTableColumn = register({
  name: "deleteTableColumn",
  label: "labels.deleteTableColumn",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const table = getSelectedTable(elements, appState, app);
    return !!table && table.cols > 1;
  },
  perform: (elements, appState, _, app) => {
    const table = getSelectedTable(elements, appState, app);
    return {
      ...applyTableUpdate(
        elements,
        table!,
        table ? getTableWithRemovedColumn(table) : null,
      ),
      appState,
    };
  },
});

export const actionToggleTableRowAutoResize = register({
  name: "toggleTableRowAutoResize",
  // label describes what the action will switch *to*
  label: (elements, appState, app) =>
    getSelectedTable(elements, appState, app)?.autoResizeRows
      ? "labels.tableFixedRowHeight"
      : "labels.tableFitRowsToText",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    !!getSelectedTable(elements, appState, app),
  perform: (elements, appState, _, app) => {
    const table = getSelectedTable(elements, appState, app);
    if (!table) {
      return {
        elements,
        appState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }
    // switching ON re-fits rows to content immediately; switching OFF just
    // freezes current row heights (overflow is then clipped on render)
    const update: Partial<ExcalidrawTableElement> = table.autoResizeRows
      ? { autoResizeRows: false }
      : { autoResizeRows: true, ...getTableFittedToContent(table) };
    return {
      ...applyTableUpdate(elements, table, update),
      appState,
    };
  },
});
