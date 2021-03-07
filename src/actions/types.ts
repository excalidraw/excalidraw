import React from "react";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";

/** if false, the action should be prevented */
export type ActionResult =
  | {
      elements?: readonly ExcalidrawElement[] | null;
      appState?: MarkOptional<AppState, "offsetTop" | "offsetLeft"> | null;
      commitToHistory: boolean;
      syncHistory?: boolean;
    }
  | false;

type ActionFn = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  formData: any,
  app: { canvas: HTMLCanvasElement | null },
) => ActionResult | Promise<ActionResult>;

export type UpdaterFn = (res: ActionResult) => void;
export type ActionFilterFn = (action: Action) => void;

export type ActionName =
  | "copy"
  | "cut"
  | "paste"
  | "copyAsPng"
  | "copyAsSvg"
  | "sendBackward"
  | "bringForward"
  | "sendToBack"
  | "bringToFront"
  | "copyStyles"
  | "selectAll"
  | "pasteStyles"
  | "gridMode"
  | "zenMode"
  | "stats"
  | "changeStrokeColor"
  | "changeBackgroundColor"
  | "changeFillStyle"
  | "changeStrokeWidth"
  | "changeSloppiness"
  | "changeStrokeStyle"
  | "changeArrowhead"
  | "changeOpacity"
  | "changeFontSize"
  | "toggleCanvasMenu"
  | "toggleEditMenu"
  | "undo"
  | "redo"
  | "finalize"
  | "changeProjectName"
  | "changeExportBackground"
  | "changeExportEmbedScene"
  | "changeShouldAddWatermark"
  | "saveScene"
  | "saveAsScene"
  | "loadScene"
  | "duplicateSelection"
  | "deleteSelectedElements"
  | "changeViewBackgroundColor"
  | "clearCanvas"
  | "zoomIn"
  | "zoomOut"
  | "resetZoom"
  | "zoomToFit"
  | "zoomToSelection"
  | "changeFontFamily"
  | "changeTextAlign"
  | "toggleFullScreen"
  | "toggleShortcuts"
  | "group"
  | "ungroup"
  | "goToCollaborator"
  | "addToLibrary"
  | "changeSharpness"
  | "alignTop"
  | "alignBottom"
  | "alignLeft"
  | "alignRight"
  | "alignVerticallyCentered"
  | "alignHorizontallyCentered"
  | "distributeHorizontally"
  | "distributeVertically"
  | "viewMode"
  | "exportWithDarkMode";

export interface Action {
  name: ActionName;
  PanelComponent?: React.FC<{
    elements: readonly ExcalidrawElement[];
    appState: AppState;
    updateData: (formData?: any) => void;
    id?: string;
  }>;
  perform: ActionFn;
  keyPriority?: number;
  keyTest?: (
    event: KeyboardEvent,
    appState: AppState,
    elements: readonly ExcalidrawElement[],
  ) => boolean;
  contextItemLabel?: string;
  contextItemPredicate?: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
  ) => boolean;
  checked?: (appState: Readonly<AppState>) => boolean;
}

export interface ActionsManagerInterface {
  actions: Record<ActionName, Action>;
  registerAction: (action: Action) => void;
  handleKeyDown: (event: KeyboardEvent) => boolean;
  renderAction: (name: ActionName) => React.ReactElement | null;
}
