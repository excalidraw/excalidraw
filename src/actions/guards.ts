import { Action, ActionName, DisableFn, EnableFn } from "./types";

const disablers = {} as Record<ActionName, DisableFn[]>;
const enablers = {} as Record<Action["name"], EnableFn[]>;

export const getActionDisablers = () => disablers;
export const getActionEnablers = () => enablers;

export const registerDisableFn = (name: ActionName, disabler: DisableFn) => {
  if (!(name in disablers)) {
    disablers[name] = [] as DisableFn[];
  }
  if (!disablers[name].includes(disabler)) {
    disablers[name].push(disabler);
  }
};

export const registerEnableFn = (name: Action["name"], enabler: EnableFn) => {
  if (!(name in enablers)) {
    enablers[name] = [] as EnableFn[];
  }
  if (!enablers[name].includes(enabler)) {
    enablers[name].push(enabler);
  }
};
