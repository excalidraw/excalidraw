import { useEffect } from "react";
import { ExcalidrawImperativeAPI } from "../../../types";
import { addSubtypeMethods } from "../";
import { getMathSubtypeRecord } from "./types";
import { prepareMathSubtype } from "./implementation";

export const MathJaxSubtype = "mathjax";

// The main hook to use the MathJax subtype
export const useMathJaxSubtype = (api: ExcalidrawImperativeAPI | null) => {
  const enabled = mathJaxEnabled;
  useEffect(() => {
    if (enabled && api) {
      const prep = api.addSubtype(getMathSubtypeRecord(), prepareMathSubtype);
      if (prep) {
        addSubtypeMethods(getMathSubtypeRecord().subtype, prep.methods);
      }
    }
  }, [enabled, api]);
};

// Determine whether or not to do anything in `useMathJaxSubtype`
let mathJaxEnabled = false;

export const setMathJaxSubtypeEnabled = (enabled: boolean) => {
  mathJaxEnabled = enabled;
};
