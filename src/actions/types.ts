import React from "react";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";

export type ActionResult = {
  elements?: readonly ExcalidrawElement[] | null;
  appState?: AppState | null;
  commitToHistory: boolean;
  syncHistory?: boolean;
};

type ActionFn<Data = any> = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  data: Data,
) => ActionResult;

export type UpdaterFn = (res: ActionResult, commitToHistory?: boolean) => void;
export type ActionFilterFn = (action: Action) => void;

export type ActionName =
  | "sendBackward"
  | "bringForward"
  | "sendToBack"
  | "bringToFront"
  | "copyStyles"
  | "selectAll"
  | "pasteStyles"
  | "changeStrokeColor"
  | "changeBackgroundColor"
  | "changeFillStyle"
  | "changeStrokeWidth"
  | "changeSloppiness"
  | "changeStrokeStyle"
  | "changeOpacity"
  | "changeFontSize"
  | "toggleCanvasMenu"
  | "toggleEditMenu"
  | "undo"
  | "redo"
  | "finalize"
  | "changeProjectName"
  | "changeExportBackground"
  | "changeShouldAddWatermark"
  | "saveScene"
  | "saveAsScene"
  | "loadScene"
  | "addLibraryItemToScene"
  | "addSelectionToLibrary"
  | "addDrawingToLibrary"
  | "openLibrary"
  | "duplicateSelection"
  | "deleteSelectedElements"
  | "changeViewBackgroundColor"
  | "clearCanvas"
  | "zoomIn"
  | "zoomOut"
  | "resetZoom"
  | "zoomToFit"
  | "changeFontFamily"
  | "changeTextAlign"
  | "toggleFullScreen"
  | "toggleShortcuts"
  | "group"
  | "ungroup"
  | "goToCollaborator";

export type KeyTestFn = (
  event: KeyboardEvent,
  appState: AppState,
  elements: readonly ExcalidrawElement[],
) => boolean;

export interface Action<T = any> {
  name: ActionName;
  PanelComponent?: React.FC<{
    elements: readonly ExcalidrawElement[];
    appState: AppState;
    updateData: (data?: T) => void;
    id?: string;
  }>;
  perform: ActionFn<T>;
  keyPriority?: number;
  keyTest?: KeyTestFn;
  contextItemLabel?: string;
  contextMenuOrder?: number;
}

export interface ActionsManagerInterface {
  actions: {
    [actionName in ActionName]: Action;
  };
  registerAction: (action: Action) => void;
  handleKeyDown: (event: KeyboardEvent) => boolean;
  getContextMenuItems: (
    actionFilter: ActionFilterFn,
  ) => { label: string; action: () => void }[];
  renderAction: (name: ActionName) => React.ReactElement | null;
}
