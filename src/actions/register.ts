import { Action } from "./types";

export let actions: readonly Action[] = [];

export const register = (action: Action): Action => {
  actions = actions.concat(action);
  return action;
};
