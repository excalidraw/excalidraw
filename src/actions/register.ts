import { Action } from "./types";

export let actions: readonly Action<any>[] = [];

export const register = <T = any>(action: Action<T>): Action<T> => {
  actions = actions.concat(action);
  return action;
};
