import { useEffect } from "react";
import { getShortcutKey } from "../../utils";
import { SubtypeTypes } from "../";

// Exports
export const mathSubtype = "math" as const;
export type MathProps = typeof mathProps[number];
export const useSubtype = (setup: (types: SubtypeTypes) => void) =>
  useEffect(() => setup(mathSubtypeTypes));
export const testUseSubtype = (setup: (types: SubtypeTypes) => void) =>
  setup(mathSubtypeTypes);

// Define this separately so we can do `export type MathProps`
const mathProps = [
  { useTex: true, mathOnly: false } as { useTex: boolean; mathOnly: boolean },
] as const;
const mathSubtypeTypes: SubtypeTypes = {
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
