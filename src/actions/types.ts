import React from "react";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";

type ActionResult = {
  elements?: ExcalidrawElement[];
  appState?: AppState;
};

type ActionFn = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  formData: any
) => ActionResult;

type UpdaterFn = (formData: any) => void;

export interface Action {
  name: string;
  PanelComponent?: React.FC<{
    elements: readonly ExcalidrawElement[];
    appState: AppState;
    updater: UpdaterFn;
  }>;
  perform: ActionFn;
  keyTest?: (event: KeyboardEvent) => boolean;
  contextItemLabel?: string;
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
}
