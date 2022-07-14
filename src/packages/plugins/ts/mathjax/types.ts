import { getShortcutKey } from "../../../../utils";
import { SubtypeTypes } from "../../../../subtypes";

// Exports
export const mathSubtype = "math" as const;
export type MathProps = typeof mathProps[number];
export const getMathSubtypeTypes = () => mathSubtypeTypes;

// Define this separately so we can do `export type MathProps`
const mathProps = [
  { useTex: true, mathOnly: false } as { useTex: boolean; mathOnly: boolean },
] as const;

// Use the `getMathSubtypeTypes` so we don't have to export this
const mathSubtypeTypes: SubtypeTypes = {
  subtype: mathSubtype,
  parents: [{ subtype: mathSubtype, parentType: "text" }],
  customProps: mathProps,
  customActions: [
    {
      subtype: mathSubtype,
      actions: ["changeUseTex", "changeMathOnly", mathSubtype],
    },
  ],
  disabledActions: [{ subtype: mathSubtype, actions: ["changeFontFamily"] }],
  customShortcutNames: ["changeUseTex", "changeMathOnly"],
  customShortcutMap: {
    changeUseTex: [getShortcutKey("CtrlOrCmd+Shift+M")],
    changeMathOnly: [getShortcutKey("CtrlOrCmd+Shift+O")],
  },
};
