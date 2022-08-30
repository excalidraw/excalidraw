import { ExcalidrawElement } from "./element/types";

// Use "let" instead of "const" so we can dynamically add subtypes
let subtypeNames: readonly SubtypeName[] = [];
let parentTypeMap: readonly {
  subtype: SubtypeName;
  parentType: ExcalidrawElement["type"];
}[] = [];

export type Subtype = Readonly<{
  name: SubtypeName;
  parents: readonly ExcalidrawElement["type"][];
}>;

// Subtype Names
export type SubtypeName = string;
export const isValidSubtypeName = (s: any, t: any): s is SubtypeName =>
  parentTypeMap.find(
    (val) => val.subtype === (s as string) && val.parentType === (t as string),
  ) !== undefined;

// This is the main method to set up the subtype.
// The signature of `prepareSubtype` will change in further commits.
export const prepareSubtype = (subtype: Subtype): {} => {
  // Check for undefined/null subtypes and parentTypes
  if (
    subtype.name === undefined ||
    subtype.name === "" ||
    subtype.parents === undefined ||
    subtype.parents.length === 0
  ) {
    return {};
  }

  // Register the types
  const name = subtype.name;
  subtypeNames = [...subtypeNames, name];
  subtype.parents.forEach((parentType) => {
    parentTypeMap = [...parentTypeMap, { subtype: name, parentType }];
  });
  return {};
};
