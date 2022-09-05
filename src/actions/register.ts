import { Action, isActionName } from "./types";

let actions: readonly Action[] = [];
let customActions: readonly Action[] = [];
export const getCustomActions = () => customActions;
export const getActions = () => actions;

export const register = <T extends Action>(action: T) => {
  if (!isActionName(action.name)) {
    customActions = customActions.concat(action);
  }
  actions = actions.concat(action);
  return action as T & {
    keyTest?: unknown extends T["keyTest"] ? never : T["keyTest"];
  };
};
