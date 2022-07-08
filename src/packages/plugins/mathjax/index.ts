import { testSubtypePrep, useSubtypePrep } from "../../../subtypes";
import { getMathSubtypeTypes } from "./types";
import { prepareMathSubtype } from "./plugin";

export const MathJaxPlugin = "mathjax";

// Plugin authors: provide a hook like `useMyPlugin` in `myplugin/index`
export const useMathJaxPlugin = () => {
  const enabled = mathJaxPluginLoadable;
  useSubtypePrep(getMathSubtypeTypes(), prepareMathSubtype, enabled);
};

// Plugin authors: provide a function like `testMyPlugin` in `myplugin/index`
export const testMathJaxPlugin = () => {
  const enabled = mathJaxPluginLoadable;
  testSubtypePrep(getMathSubtypeTypes(), prepareMathSubtype, enabled);
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
