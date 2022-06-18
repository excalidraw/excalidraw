import { ActionName } from "../../actions/types";
import { getShortcutKey } from "../../utils";

export const mathSubtype = "math" as const;
export const mathParentType = "text" as const;
export const mathProps = [
  { useTex: true, mathOnly: false } as { useTex: boolean; mathOnly: boolean },
] as const;
export const mathDisabledActions = [
  { subtype: mathSubtype, actions: ["changeFontFamily"] } as {
    subtype: typeof mathSubtype;
    actions: ActionName[];
  },
] as const;
export const mathActionName = [
  "changeUseTex",
  "changeMathOnly",
  mathSubtype,
] as const;
export const mathShortcutName = ["changeUseTex", "changeMathOnly"] as const;
export const mathShortcutMap: Record<
  typeof mathShortcutName[number],
  string[]
> = {
  changeUseTex: [getShortcutKey("CtrlOrCmd+Shift+M")],
  changeMathOnly: [getShortcutKey("CtrlOrCmd+Shift+O")],
};
