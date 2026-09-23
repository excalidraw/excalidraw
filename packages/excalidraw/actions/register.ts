import type { Action } from "./types";

export let actions: readonly Action[] = [];

export const register = <
  TData extends any,
  T extends Action<TData> = Action<TData>,
>(
  action: T,
) => {
  actions = actions.concat(action);
  return action as T & {
    keyTest?: unknown extends T["keyTest"] ? never : T["keyTest"];
  };
};
