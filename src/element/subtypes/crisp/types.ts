import { SubtypeTypes } from "../../../subtypes";

// Exports
export const crispSubtype = "crisp" as const;
export type CrispProps = typeof crispProps[number];
export const getCrispSubtypeTypes = () => crispSubtypeTypes;

// Define this separately so we can do `export type CrispProps`
const crispProps = [{} as {}] as const;

// Use the `getCrispSubtypeTypes` so we don't have to export this
const crispSubtypeTypes: SubtypeTypes = {
  subtype: crispSubtype,
  parents: [
    { subtype: crispSubtype, parentType: "line" },
    { subtype: crispSubtype, parentType: "arrow" },
    { subtype: crispSubtype, parentType: "rectangle" },
    { subtype: crispSubtype, parentType: "diamond" },
    { subtype: crispSubtype, parentType: "ellipse" },
  ],
  customData: crispProps,
  customActions: [
    {
      subtype: crispSubtype,
      actions: [crispSubtype],
    },
  ],
  disabledActions: [{ subtype: crispSubtype, actions: ["changeSloppiness"] }],
  customShortcutNames: [],
  customShortcutMap: {},
};
