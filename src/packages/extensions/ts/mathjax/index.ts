import { useEffect } from "react";
import { ExcalidrawImperativeAPI } from "../../../../types";
import { addSubtypeMethods } from "../../../../subtypes";
import { getMathSubtypeRecord } from "./types";
import { prepareMathSubtype } from "./implementation";

export const MathJaxExtension = "mathjax";

// Extension authors: provide a hook like `useMyExtension` in `myextension/index`
export const useMathJaxExtension = (api: ExcalidrawImperativeAPI | null) => {
  const enabled = mathJaxExtensionLoadable;
  useEffect(() => {
    if (enabled && api) {
      const prep = api.addSubtype(getMathSubtypeRecord(), prepareMathSubtype);
      if (prep) {
        addSubtypeMethods(getMathSubtypeRecord().subtype, prep.methods);
      }
    }
  }, [enabled, api]);
};

// Extension authors: Use a variable like `myExtensionLoadable` to determine
// whether or not to do anything in each of `useMyExtension` and `testMyExtension`.
let mathJaxExtensionLoadable = false;

export const getMathJaxExtensionLoadable = () => {
  return mathJaxExtensionLoadable;
};

export const setMathJaxExtensionLoadable = (loadable: boolean) => {
  mathJaxExtensionLoadable = loadable;
};
