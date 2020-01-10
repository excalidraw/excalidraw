import { Action, ActionsManagerInterface } from "./types";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";

export class ActionManager implements ActionsManagerInterface {
  actions: { [keyProp: string]: Action } = {};

  registerAction(action: Action) {
    this.actions[action.name] = action;
  }

  handleKeyDown(
    event: KeyboardEvent,
    elements: readonly ExcalidrawElement[],
    appState: AppState
  ) {
    const data = Object.values(this.actions)
      .filter(action => action.keyTest && action.keyTest(event))
      .map(action => action.perform(elements, appState, null))[0];

    if (!data) return {};

    event.preventDefault();
    return data;
  }
}
