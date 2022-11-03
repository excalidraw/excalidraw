import React from "react";
import {
  Action,
  UpdaterFn,
  ActionName,
  ActionResult,
  PanelComponentProps,
  ActionSource,
  DisableFn,
  EnableFn,
  isActionName,
} from "./types";
import { getActionDisablers, getActionEnablers } from "./guards";
import { ExcalidrawElement } from "../element/types";
import { AppClassProperties, AppState } from "../types";
import { MODES } from "../constants";
import { trackEvent } from "../analytics";

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
            `${source} (${app.device.isMobile ? "mobile" : "desktop"})`,
          );
        }
      }
    } catch (error) {
      console.error("error while logging action:", error);
    }
  }
};

export class ActionManager {
  actions = {} as Record<ActionName | Action["name"], Action>;

  disablers = {} as Record<ActionName, DisableFn[]>;
  enablers = {} as Record<Action["name"], EnableFn[]>;

  updater: (actionResult: ActionResult | Promise<ActionResult>) => void;

  getAppState: () => Readonly<AppState>;
  getElementsIncludingDeleted: () => readonly ExcalidrawElement[];
  app: AppClassProperties;

  constructor(
    updater: UpdaterFn,
    getAppState: () => AppState,
    getElementsIncludingDeleted: () => readonly ExcalidrawElement[],
    app: AppClassProperties,
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
    this.app = app;
  }

  public registerActionGuards() {
    const disablers = getActionDisablers();
    for (const d in disablers) {
      const dName = d as ActionName;
      disablers[dName].forEach((disabler) =>
        this.registerDisableFn(dName, disabler),
      );
    }
    const enablers = getActionEnablers();
    for (const e in enablers) {
      const eName = e as Action["name"];
      enablers[e].forEach((enabler) => this.registerEnableFn(eName, enabler));
    }
  }

  private registerDisableFn(name: ActionName, disabler: DisableFn) {
    if (!(name in this.disablers)) {
      this.disablers[name] = [] as DisableFn[];
    }
    if (!this.disablers[name].includes(disabler)) {
      this.disablers[name].push(disabler);
    }
  }

  private registerEnableFn(name: Action["name"], enabler: EnableFn) {
    if (!(name in this.enablers)) {
      this.enablers[name] = [] as EnableFn[];
    }
    if (!this.enablers[name].includes(enabler)) {
      this.enablers[name].push(enabler);
    }
  }

  public isActionEnabled(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    actionName: Action["name"],
  ): boolean {
    if (isActionName(actionName)) {
      return !(
        actionName in this.disablers &&
        this.disablers[actionName].some((fn) =>
          fn(elements, appState, actionName),
        )
      );
    }
    return (
      actionName in this.enablers &&
      this.enablers[actionName].some((fn) => fn(elements, appState, actionName))
    );
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
            : this.isActionEnabled(
                this.getElementsIncludingDeleted(),
                this.getAppState(),
                action.name,
              )) &&
          action.keyTest &&
          action.keyTest(
            event,
            this.getAppState(),
            this.getElementsIncludingDeleted(),
          ),
      );

    if (data.length !== 1) {
      if (data.length > 1) {
        console.warn("Canceling as multiple actions match this shortcut", data);
      }
      return false;
    }

    const action = data[0];

    const { viewModeEnabled } = this.getAppState();
    if (viewModeEnabled) {
      if (!Object.values(MODES).includes(data[0].name)) {
        return false;
      }
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

  executeAction(action: Action, source: ActionSource = "api") {
    const elements = this.getElementsIncludingDeleted();
    const appState = this.getAppState();
    const value = null;

    trackAction(action, source, appState, elements, this.app, value);

    this.updater(action.perform(elements, appState, value, this.app));
  }

  /**
   * @param data additional data sent to the PanelComponent
   */
  renderAction = (
    name: ActionName | Action["name"],
    data?: PanelComponentProps["data"],
    isInHamburgerMenu = false,
  ) => {
    const canvasActions = this.app.props.UIOptions.canvasActions;

    if (
      this.actions[name] &&
      "PanelComponent" in this.actions[name] &&
      (name in canvasActions
        ? canvasActions[name as keyof typeof canvasActions]
        : this.isActionEnabled(
            this.getElementsIncludingDeleted(),
            this.getAppState(),
            name,
          ))
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
          data={data}
          isInHamburgerMenu={isInHamburgerMenu}
        />
      );
    }

    return null;
  };
}
