import React from "react";
import {
  Action,
  ActionsManagerInterface,
  UpdaterFn,
  ActionFilterFn,
} from "./types";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { t } from "../i18n";

export class ActionManager implements ActionsManagerInterface {
  actions: { [keyProp: string]: Action } = {};

  updater: UpdaterFn;

  getAppState: () => AppState;

  getElements: () => readonly ExcalidrawElement[];

  constructor(
    updater: UpdaterFn,
    getAppState: () => AppState,
    getElements: () => readonly ExcalidrawElement[],
  ) {
    this.updater = updater;
    this.getAppState = getAppState;
    this.getElements = getElements;
  }

  registerAction(action: Action) {
    this.actions[action.name] = action;
  }

  registerAll(actions: readonly Action[]) {
    actions.forEach(action => this.registerAction(action));
  }

  handleKeyDown(event: KeyboardEvent) {
    const data = Object.values(this.actions)
      .sort((a, b) => (b.keyPriority || 0) - (a.keyPriority || 0))
      .filter(
        action =>
          action.keyTest &&
          action.keyTest(event, this.getAppState(), this.getElements()),
      );

    if (data.length === 0) {
      return false;
    }

    event.preventDefault();
    const commitToHistory =
      data[0].commitToHistory &&
      data[0].commitToHistory(this.getAppState(), this.getElements());
    this.updater(
      data[0].perform(this.getElements(), this.getAppState(), null),
      commitToHistory,
    );
    return true;
  }

  executeAction(action: Action) {
    const commitToHistory =
      action.commitToHistory &&
      action.commitToHistory(this.getAppState(), this.getElements());
    this.updater(
      action.perform(this.getElements(), this.getAppState(), null),
      commitToHistory,
    );
  }

  getContextMenuItems(actionFilter: ActionFilterFn = action => action) {
    return Object.values(this.actions)
      .filter(actionFilter)
      .filter(action => "contextItemLabel" in action)
      .sort(
        (a, b) =>
          (a.contextMenuOrder !== undefined ? a.contextMenuOrder : 999) -
          (b.contextMenuOrder !== undefined ? b.contextMenuOrder : 999),
      )
      .map(action => ({
        label: action.contextItemLabel ? t(action.contextItemLabel) : "",
        action: () => {
          const commitToHistory =
            action.commitToHistory &&
            action.commitToHistory(this.getAppState(), this.getElements());
          this.updater(
            action.perform(this.getElements(), this.getAppState(), null),
            commitToHistory,
          );
        },
      }));
  }

  renderAction = (name: string) => {
    if (this.actions[name] && "PanelComponent" in this.actions[name]) {
      const action = this.actions[name];
      const PanelComponent = action.PanelComponent!;
      const updateData = (formState?: any) => {
        const commitToHistory =
          action.commitToHistory &&
          action.commitToHistory(this.getAppState(), this.getElements());
        this.updater(
          action.perform(this.getElements(), this.getAppState(), formState),
          commitToHistory,
        );
      };

      return (
        <PanelComponent
          elements={this.getElements()}
          appState={this.getAppState()}
          updateData={updateData}
        />
      );
    }

    return null;
  };
}
