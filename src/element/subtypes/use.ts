import { Subtype } from ".";
import { ExcalidrawImperativeAPI } from "../../types";
import {
  MathJaxSubtype,
  setMathJaxSubtypeEnabled,
  useMathJaxSubtype,
} from "./mathjax";

const validSubtypes: readonly Subtype[] = [MathJaxSubtype];
const subtypesUsed: Subtype[] = [];

// The main invocation hook for use in the UI
export const useSubtypes = (
  api: ExcalidrawImperativeAPI | null,
  subtypes?: Subtype[],
) => {
  selectSubtypesToEnable(subtypes);
  useMathJaxSubtype(api);
  // Put calls like `useThisSubtype(api);` here
};

// This MUST be called before the `useSubtype` calls.
const selectSubtypesToEnable = (subtypes?: Subtype[]) => {
  const subtypeList: Subtype[] = [];
  if (subtypes === undefined) {
    subtypeList.push(...validSubtypes);
  } else {
    subtypes.forEach(
      (val) => validSubtypes.includes(val) && subtypeList.push(val),
    );
  }
  while (subtypesUsed.length > 0) {
    subtypesUsed.pop();
  }
  subtypesUsed.push(...subtypeList);
  enableSelectedSubtypes();
};

const enableSelectedSubtypes = () => {
  setMathJaxSubtypeEnabled(subtypesUsed.includes(MathJaxSubtype));
  // Put lines here like
  // `setThisSubtypeEnabled(subtypesUsed.includes(ThisSubtype));`
};
