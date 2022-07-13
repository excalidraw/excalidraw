import { useEffect } from "react";
import { ExcalidrawImperativeAPI } from "../../../types";
import { addCustomMethods } from "../../../subtypes";
import { getMathSubtypeTypes, mathSubtype } from "./types";
import { prepareMathSubtype } from "./plugin";

export const MathJaxPlugin = "mathjax";

// Plugin authors: provide a hook like `useMyPlugin` in `myplugin/index`
export const useMathJaxPlugin = (api: ExcalidrawImperativeAPI | null) => {
  const enabled = mathJaxPluginLoadable;
  useEffect(() => {
    if (enabled && api) {
      const prep = api.addSubtype(getMathSubtypeTypes(), prepareMathSubtype);
      if (prep) {
        addCustomMethods(mathSubtype, prep.methods);
      }
    }
  }, [enabled, api]);
};

// Plugin authors: Use a variable like `myPluginLoadable` to determine
// whether or not to do anything in each of `useMyPlugin` and `testMyPlugin`.
let mathJaxPluginLoadable = false;

export const getMathJaxPluginLoadable = () => {
  return mathJaxPluginLoadable;
};

export const setMathJaxPluginLoadable = (loadable: boolean) => {
  mathJaxPluginLoadable = loadable;
};
