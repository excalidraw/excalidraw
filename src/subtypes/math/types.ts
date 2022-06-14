import { ActionName } from "../../actions/types";
import { getShortcutKey } from "../../utils";
export const SUBTYPE_MATH = "math";
export { SUBTYPE_MATH_ICON } from "./icon";

export const mathProps = [
  { useTex: true, mathOnly: false } as { useTex: boolean; mathOnly: boolean },
] as const;

export const mathActionName = [
  "changeUseTex",
  "changeMathOnly",
  SUBTYPE_MATH,
] as const;
export type MathActionName = typeof mathActionName[number];

export const mathDisabledActions = [
  { subtype: SUBTYPE_MATH, actions: ["changeFontFamily"] } as {
    subtype: typeof SUBTYPE_MATH;
    actions: ActionName[];
  },
] as const;
export type MathDisabledActions = typeof mathDisabledActions[number];

type MathShortcutName = typeof mathShortcutName[number];
export const mathShortcutName = ["changeUseTex", "changeMathOnly"] as const;

export const mathShortcutMap: Record<MathShortcutName, string[]> = {
  changeUseTex: [getShortcutKey("CtrlOrCmd+Shift+M")],
  changeMathOnly: [getShortcutKey("CtrlOrCmd+Shift+O")],
};
