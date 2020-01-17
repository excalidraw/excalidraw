import React from "react";
import {
  Action,
  ActionsManagerInterface,
  UpdaterFn,
  ActionFilterFn
} from "./types";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";

export class ActionManager implements ActionsManagerInterface {
  actions: { [keyProp: string]: Action } = {};

  updater:
    | ((elements: ExcalidrawElement[], appState: AppState) => void)
    | null = null;

  setUpdater(
    updater: (elements: ExcalidrawElement[], appState: AppState) => void
  ) {
    this.updater = updater;
  }

  registerAction(action: Action) {
    this.actions[action.name] = action;
  }

  handleKeyDown(
    event: KeyboardEvent,
    elements: readonly ExcalidrawElement[],
    appState: AppState
  ) {
    const data = Object.values(this.actions)
      .sort((a, b) => (b.keyPriority || 0) - (a.keyPriority || 0))
      .filter(
        action => action.keyTest && action.keyTest(event, elements, appState)
      );

    if (data.length === 0) return {};

    event.preventDefault();
    return data[0].perform(elements, appState, null);
  }

  getContextMenuItems(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    updater: UpdaterFn,
    actionFilter: ActionFilterFn = action => action
  ) {
    return Object.values(this.actions)
      .filter(actionFilter)
      .filter(action => "contextItemLabel" in action)
      .sort(
        (a, b) =>
          (a.contextMenuOrder !== undefined ? a.contextMenuOrder : 999) -
          (b.contextMenuOrder !== undefined ? b.contextMenuOrder : 999)
      )
      .map(action => ({
        label: action.contextItemLabel!,
        action: () => {
          updater(action.perform(elements, appState, null));
        }
      }));
  }

  renderAction(
    name: string,
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    updater: UpdaterFn
  ) {
    if (this.actions[name] && "PanelComponent" in this.actions[name]) {
      const action = this.actions[name];
      const PanelComponent = action.PanelComponent!;
      const updateData = (formState: any) => {
        updater(action.perform(elements, appState, formState));
      };

      return (
        <PanelComponent
          elements={elements}
          appState={appState}
          updateData={updateData}
        />
      );
    }

    return null;
  }
}
