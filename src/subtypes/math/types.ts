import { ExcalidrawTextElement } from "../../element/types";
import { getShortcutKey } from "../../utils";

type MathSubtype = typeof mathSubtype;
type MathParentType = ExcalidrawTextElement["type"];
type MathActionName = typeof mathActionNames[number];
type MathDisabledActionName = typeof mathDisabledActionNames[number];
type MathShortcutName = typeof mathShortcutNames[number];
const mathParentType = "text" as const;
export const mathSubtype = "math" as const;
export const mathParent = [
  { subtype: mathSubtype, parentType: mathParentType } as {
    subtype: MathSubtype;
    parentType: MathParentType;
  },
] as const;
export const mathProps = [
  { useTex: true, mathOnly: false } as { useTex: boolean; mathOnly: boolean },
] as const;
export const mathDisabledActionNames = ["changeFontFamily"] as const;
export const mathDisabledActions = [
  { subtype: mathSubtype, actions: [...mathDisabledActionNames] } as {
    subtype: MathSubtype;
    actions: MathDisabledActionName[];
  },
] as const;
export const mathActionNames = [
  "changeUseTex",
  "changeMathOnly",
  mathSubtype,
] as const;
export const mathActions = [
  { subtype: mathSubtype, actions: [...mathActionNames] } as {
    subtype: MathSubtype;
    actions: MathActionName[];
  },
] as const;
export const mathShortcutNames = ["changeUseTex", "changeMathOnly"] as const;
export const mathShortcutMap = {
  changeUseTex: [getShortcutKey("CtrlOrCmd+Shift+M")],
  changeMathOnly: [getShortcutKey("CtrlOrCmd+Shift+O")],
} as Record<MathShortcutName, string[]>;
