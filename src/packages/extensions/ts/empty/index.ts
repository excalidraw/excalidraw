import { useEffect } from "react";
import { ExcalidrawImperativeAPI } from "../../../../types";

// Extension authors: provide a extension name here like "myextension"
export const EmptyExtension = "empty";

// Extension authors: provide a hook like `useMyExtension` in `myextension/index`
export const useEmptyExtension = (api: ExcalidrawImperativeAPI | null) => {
  const enabled = emptyExtensionLoadable;
  useEffect(() => {
    if (enabled) {
    }
  }, [enabled, api]);
};

// Extension authors: Use a variable like `myExtensionLoadable` to determine
// whether or not to do anything in each of `useMyExtension` and `testMyExtension`.
let emptyExtensionLoadable = false;

export const getEmptyExtensionLoadable = () => {
  return emptyExtensionLoadable;
};

export const setEmptyExtensionLoadable = (loadable: boolean) => {
  emptyExtensionLoadable = loadable;
};
