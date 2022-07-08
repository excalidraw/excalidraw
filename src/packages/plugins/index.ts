import {
  MathJaxPlugin,
  setMathJaxPluginLoadable,
  testMathJaxPlugin,
  useMathJaxPlugin,
} from "./mathjax";

// Plugin authors: do imports like follows:
// ```
// import {
//   MyPlugin,
//   setMyPluginLoadable,
//   testMyPlugin,
//   useMyPlugin,
// } from "./myplugin";
// ```

// Plugin authors: include `MyPlugin` in `validPlugins`
const validPlugins: readonly string[] = [MathJaxPlugin];
const pluginsUsed: string[] = [];

// The main invocation hook for use in the UI (excalidraw.com and
// `@excalidraw/excalidraw`)
export const usePlugins = (plugins?: string[]) => {
  selectPluginsToLoad(plugins);
  useMathJaxPlugin();
  // Plugin authors: add a line here like `useMyPlugin();`
};

// The main invocation function for use in the test helper API.
export const testPlugins = (plugins?: string[]) => {
  selectPluginsToLoad(plugins);
  testMathJaxPlugin();
  // Plugin authors: add a line here like `testMyPlugin();`
};

// This MUST be called before the `usePlugin`/`testPlugin` calls.
const selectPluginsToLoad = (plugins?: string[]) => {
  const pluginList: string[] = [];
  if (plugins === undefined) {
    pluginList.push(...validPlugins);
  } else {
    plugins.forEach(
      (val) => validPlugins.includes(val) && pluginList.push(val),
    );
  }
  while (pluginsUsed.length > 0) {
    pluginsUsed.pop();
  }
  pluginsUsed.push(...pluginList);
  setLoadablePlugins();
};

const setLoadablePlugins = () => {
  setMathJaxPluginLoadable(pluginsUsed.includes(MathJaxPlugin));
  // Plugin authors: add a line here like
  // `setMyPluginLoadable(pluginsUsed.includes(MyPlugin));`
};
