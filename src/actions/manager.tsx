import React from "react";
import { Action, ActionsManagerInterface, UpdaterFn } from "./types";
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
      .filter(
        action => action.keyTest && action.keyTest(event, elements, appState)
      )
      .map(action => action.perform(elements, appState, null))[0];

    if (!data) return {};

    event.preventDefault();
    return data;
  }

  getContextMenuItems(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    updater: UpdaterFn
  ) {
    return Object.values(this.actions)
      .filter(action => "contextItemLabel" in action)
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
