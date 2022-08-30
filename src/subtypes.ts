import { ExcalidrawElement } from "./element/types";

// Use "let" instead of "const" so we can dynamically add subtypes
let subtypeNames: readonly Subtype[] = [];
let parentTypeMap: readonly {
  subtype: Subtype;
  parentType: ExcalidrawElement["type"];
}[] = [];

export type SubtypeRecord = Readonly<{
  subtype: Subtype;
  parents: readonly ExcalidrawElement["type"][];
}>;

// Subtype Names
export type Subtype = string;
export const isValidSubtype = (s: any, t: any): s is Subtype =>
  parentTypeMap.find(
    (val) => val.subtype === (s as string) && val.parentType === (t as string),
  ) !== undefined;

// This is the main method to set up the subtype.
// The signature of `prepareSubtype` will change in further commits.
export const prepareSubtype = (record: SubtypeRecord): {} => {
  // Check for undefined/null subtypes and parentTypes
  if (
    record.subtype === undefined ||
    record.subtype === "" ||
    record.parents === undefined ||
    record.parents.length === 0
  ) {
    return {};
  }

  // Register the types
  const subtype = record.subtype;
  subtypeNames = [...subtypeNames, subtype];
  record.parents.forEach((parentType) => {
    parentTypeMap = [...parentTypeMap, { subtype, parentType }];
  });
  return {};
};
