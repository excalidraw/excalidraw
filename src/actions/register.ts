import { Action } from "./types";

export let actions: readonly Action[] = [];

export function register(action: Action): Action {
  actions = actions.concat(action);
  return action;
}
