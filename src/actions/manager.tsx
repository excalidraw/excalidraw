import React from "react";
import {
  Action,
  ActionsManagerInterface,
  UpdaterFn,
  ActionFilterFn,
  ActionName,
  ActionResult,
} from "./types";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { t } from "../i18n";
import { ShortcutName } from "./shortcuts";

export class ActionManager implements ActionsManagerInterface {
  actions = {} as ActionsManagerInterface["actions"];

  updater: (actionResult: ActionResult | Promise<ActionResult>) => void;

  getAppState: () => Readonly<AppState>;

  getElementsIncludingDeleted: () => readonly ExcalidrawElement[];

  constructor(
    updater: UpdaterFn,
    getAppState: () => AppState,
    getElementsIncludingDeleted: () => readonly ExcalidrawElement[],
  ) {
    this.updater = (actionResult) => {
      if (actionResult && "then" in actionResult) {
        actionResult.then((actionResult) => {
          return updater(actionResult);
        });
      } else {
        return updater(actionResult);
      }
    };
    this.getAppState = getAppState;
    this.getElementsIncludingDeleted = getElementsIncludingDeleted;
  }

  registerAction(action: Action) {
    this.actions[action.name] = action;
  }

  registerAll(actions: readonly Action[]) {
    actions.forEach((action) => this.registerAction(action));
  }

  handleKeyDown(event: KeyboardEvent) {
    const data = Object.values(this.actions)
      .sort((a, b) => (b.keyPriority || 0) - (a.keyPriority || 0))
      .filter(
        (action) =>
          action.keyTest &&
          action.keyTest(
            event,
            this.getAppState(),
            this.getElementsIncludingDeleted(),
          ),
      );

    if (data.length === 0) {
      return false;
    }

    event.preventDefault();
    this.updater(
      data[0].perform(
        this.getElementsIncludingDeleted(),
        this.getAppState(),
        null,
      ),
    );
    return true;
  }

  executeAction(action: Action) {
    this.updater(
      action.perform(
        this.getElementsIncludingDeleted(),
        this.getAppState(),
        null,
      ),
    );
  }

  getContextMenuItems(actionFilter: ActionFilterFn = (action) => action) {
    return Object.values(this.actions)
      .filter(actionFilter)
      .filter((action) => "contextItemLabel" in action)
      .filter((action) =>
        action.contextItemPredicate
          ? action.contextItemPredicate(
              this.getElementsIncludingDeleted(),
              this.getAppState(),
            )
          : true,
      )
      .sort(
        (a, b) =>
          (a.contextMenuOrder !== undefined ? a.contextMenuOrder : 999) -
          (b.contextMenuOrder !== undefined ? b.contextMenuOrder : 999),
      )
      .map((action) => ({
        // take last bit of the label  "labels.<shortcutName>"
        shortcutName: action.contextItemLabel?.split(".").pop() as ShortcutName,
        label: action.contextItemLabel ? t(action.contextItemLabel) : "",
        action: () => {
          this.updater(
            action.perform(
              this.getElementsIncludingDeleted(),
              this.getAppState(),
              null,
            ),
          );
        },
      }));
  }

  // Id is an attribute that we can use to pass in data like keys.
  // This is needed for dynamically generated action components
  // like the user list. We can use this key to extract more
  // data from app state. This is an alternative to generic prop hell!
  renderAction = (name: ActionName, id?: string) => {
    if (this.actions[name] && "PanelComponent" in this.actions[name]) {
      const action = this.actions[name];
      const PanelComponent = action.PanelComponent!;
      const updateData = (formState?: any) => {
        this.updater(
          action.perform(
            this.getElementsIncludingDeleted(),
            this.getAppState(),
            formState,
          ),
        );
      };

      return (
        <PanelComponent
          elements={this.getElementsIncludingDeleted()}
          appState={this.getAppState()}
          updateData={updateData}
          id={id}
        />
      );
    }

    return null;
  };
}
