import React from "react";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";

export type ActionResult = {
  elements?: ExcalidrawElement[];
  appState?: AppState;
};

type ActionFn = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  formData: any
) => ActionResult;

export type UpdaterFn = (res: ActionResult) => void;
export type ActionFilterFn = (action: Action) => void;

export interface Action {
  name: string;
  PanelComponent?: React.FC<{
    elements: readonly ExcalidrawElement[];
    appState: AppState;
    updateData: (formData: any) => void;
  }>;
  perform: ActionFn;
  keyPriority?: number;
  keyTest?: (
    event: KeyboardEvent,
    elements?: readonly ExcalidrawElement[],
    appState?: AppState
  ) => boolean;
  contextItemLabel?: string;
  contextMenuOrder?: number;
}

export interface ActionsManagerInterface {
  actions: {
    [keyProp: string]: Action;
  };
  registerAction: (action: Action) => void;
  handleKeyDown: (
    event: KeyboardEvent,
    elements: readonly ExcalidrawElement[],
    appState: AppState
  ) => ActionResult | {};
  getContextMenuItems: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    updater: UpdaterFn,
    actionFilter: ActionFilterFn
  ) => { label: string; action: () => void }[];
  renderAction: (
    name: string,
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    updater: UpdaterFn
  ) => React.ReactElement | null;
}
