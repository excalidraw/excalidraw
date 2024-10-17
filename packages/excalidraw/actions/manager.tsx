import React from "react";
import type {
  Action,
  UpdaterFn,
  ActionName,
  ActionResult,
  PanelComponentProps,
  ActionSource,
  ActionPredicateFn,
} from "./types";
import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from "../element/types";
import type { AppClassProperties, AppState } from "../types";
import { trackEvent } from "../analytics";
import { isPromiseLike } from "../utils";

const trackAction = (
  action: Action,
  source: ActionSource,
  appState: Readonly<AppState>,
  elements: readonly ExcalidrawElement[],
  app: AppClassProperties,
  value: any,
) => {
  if (action.trackEvent) {
    try {
      if (typeof action.trackEvent === "object") {
        const shouldTrack = action.trackEvent.predicate
          ? action.trackEvent.predicate(appState, elements, value)
          : true;
        if (shouldTrack) {
          trackEvent(
            action.trackEvent.category,
            action.trackEvent.action || action.name,
            `${source} (${app.device.editor.isMobile ? "mobile" : "desktop"})`,
          );
        }
      }
    } catch (error) {
      console.error("error while logging action:", error);
    }
  }
};

export class ActionManager {
  actions = {} as Record<ActionName, Action>;
  actionPredicates = [] as ActionPredicateFn[];

  updater: (actionResult: ActionResult | Promise<ActionResult>) => void;

  getAppState: () => Readonly<AppState>;
  getElementsIncludingDeleted: () => readonly OrderedExcalidrawElement[];
  app: AppClassProperties;

  constructor(
    updater: UpdaterFn,
    getAppState: () => AppState,
    getElementsIncludingDeleted: () => readonly OrderedExcalidrawElement[],
    app: AppClassProperties,
  ) {
    this.updater = (actionResult) => {
      if (isPromiseLike(actionResult)) {
        actionResult.then((actionResult) => {
          return updater(actionResult);
        });
      } else {
        return updater(actionResult);
      }
    };
    this.getAppState = getAppState;
    this.getElementsIncludingDeleted = getElementsIncludingDeleted;
    this.app = app;
  }

  registerActionPredicate(predicate: ActionPredicateFn) {
    if (!this.actionPredicates.includes(predicate)) {
      this.actionPredicates.push(predicate);
    }
  }

  filterActions(
    filter: ActionPredicateFn,
    opts?: {
      elements?: readonly ExcalidrawElement[];
      data?: Record<string, any>;
    },
  ): Action[] {
    // For testing
    if (this === undefined) {
      return [];
    }
    const elements = opts?.elements ?? this.getElementsIncludingDeleted();
    const appState = this.getAppState();
    const data = opts?.data;

    const actions: Action[] = [];
    for (const key in this.actions) {
      const action = this.actions[key as ActionName];
      if (filter(action, elements, appState, this.app, data)) {
        actions.push(action);
      }
    }
    return actions;
  }

  registerAction(action: Action) {
    this.actions[action.name] = action;
  }

  registerAll(actions: readonly Action[]) {
    actions.forEach((action) => this.registerAction(action));
  }

  handleKeyDown(event: React.KeyboardEvent | KeyboardEvent) {
    const canvasActions = this.app.props.UIOptions.canvasActions;
    const data = Object.values(this.actions)
      .sort((a, b) => (b.keyPriority || 0) - (a.keyPriority || 0))
      .filter(
        (action) =>
          (action.name in canvasActions
            ? canvasActions[action.name as keyof typeof canvasActions]
            : this.isActionEnabled(action, { noPredicates: true })) &&
          action.keyTest &&
          action.keyTest(
            event,
            this.getAppState(),
            this.getElementsIncludingDeleted(),
            this.app,
          ),
      );

    if (data.length !== 1) {
      if (data.length > 1) {
        console.warn("Canceling as multiple actions match this shortcut", data);
      }
      return false;
    }

    const action = data[0];

    if (this.getAppState().viewModeEnabled && action.viewMode !== true) {
      return false;
    }

    const elements = this.getElementsIncludingDeleted();
    const appState = this.getAppState();
    const value = null;

    trackAction(action, "keyboard", appState, elements, this.app, null);

    event.preventDefault();
    event.stopPropagation();
    this.updater(data[0].perform(elements, appState, value, this.app));
    return true;
  }

  executeAction<T extends Action>(
    action: T,
    source: ActionSource = "api",
    value: Parameters<T["perform"]>[2] = null,
  ) {
    const elements = this.getElementsIncludingDeleted();
    const appState = this.getAppState();

    trackAction(action, source, appState, elements, this.app, value);

    this.updater(action.perform(elements, appState, value, this.app));
  }

  /**
   * @param data additional data sent to the PanelComponent
   */
  renderAction = (name: ActionName, data?: PanelComponentProps["data"]) => {
    const canvasActions = this.app.props.UIOptions.canvasActions;

    if (
      this.actions[name] &&
      "PanelComponent" in this.actions[name] &&
      (name in canvasActions
        ? canvasActions[name as keyof typeof canvasActions]
        : this.isActionEnabled(this.actions[name], { noPredicates: true }))
    ) {
      const action = this.actions[name];
      const PanelComponent = action.PanelComponent!;
      PanelComponent.displayName = "PanelComponent";
      const elements = this.getElementsIncludingDeleted();
      const appState = this.getAppState();
      const updateData = (formState?: any) => {
        trackAction(action, "ui", appState, elements, this.app, formState);

        this.updater(
          action.perform(
            this.getElementsIncludingDeleted(),
            this.getAppState(),
            formState,
            this.app,
          ),
        );
      };

      return (
        <PanelComponent
          key={name}
          elements={this.getElementsIncludingDeleted()}
          appState={this.getAppState()}
          updateData={updateData}
          appProps={this.app.props}
          app={this.app}
          data={data}
        />
      );
    }

    return null;
  };

  isActionEnabled = (
    action: Action,
    opts?: {
      elements?: readonly ExcalidrawElement[];
      data?: Record<string, any>;
      noPredicates?: boolean;
    },
  ): boolean => {
    const elements = opts?.elements ?? this.getElementsIncludingDeleted();
    const appState = this.getAppState();
    const data = opts?.data;

    if (
      !opts?.noPredicates &&
      action.predicate &&
      !action.predicate(elements, appState, this.app.props, this.app, data)
    ) {
      return false;
    }
    let enabled = true;
    this.actionPredicates.forEach((fn) => {
      if (!fn(action, elements, appState, this.app, data)) {
        enabled = false;
      }
    });
    return enabled;
  };
}
