import { useEffect } from "react";
import { ExcalidrawImperativeAPI } from "../../../types";

// Plugin authors: provide a plugin name here like "myplugin"
export const EmptyPlugin = "empty";

// Plugin authors: provide a hook like `useMyPlugin` in `myplugin/index`
export const useEmptyPlugin = (api: ExcalidrawImperativeAPI | null) => {
  const enabled = emptyPluginLoadable;
  useEffect(() => {
    if (enabled) {
    }
  }, [enabled, api]);
};

// Plugin authors: Use a variable like `myPluginLoadable` to determine
// whether or not to do anything in each of `useMyPlugin` and `testMyPlugin`.
let emptyPluginLoadable = false;

export const getEmptyPluginLoadable = () => {
  return emptyPluginLoadable;
};

export const setEmptyPluginLoadable = (loadable: boolean) => {
  emptyPluginLoadable = loadable;
};
