// Plugin authors: provide a plugin name here like "myplugin"
export const EmptyPlugin = "empty";

// Plugin authors: provide a hook like `useMyPlugin` in `myplugin/index`
export const useEmptyPlugin = () => {
  const enabled = emptyPluginLoadable;
  if (enabled) {
  }
};

// Plugin authors: provide a function like `testMyPlugin` in `myplugin/index`
export const testEmptyPlugin = () => {
  const enabled = emptyPluginLoadable;
  if (enabled) {
  }
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
