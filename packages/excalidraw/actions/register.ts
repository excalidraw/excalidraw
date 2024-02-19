import { Action } from "./types";

export let actions: readonly Action[] = [];

export const register = <T extends Action>(action: T) => {
  actions = actions.concat(action);
  return action as T & {
    keyTest?: unknown extends T["keyTest"] ? never : T["keyTest"];
  };
};
