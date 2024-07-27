/**
 * Custom vite plugin to convert url woff2 imports into a text.
 * Other woff2 imports are automatically served and resolved as a file uri.
 *
 * @returns {import("vite").PluginOption}
 */
module.exports.woff2BrowserPlugin = () => {
  // for now limited to woff2 only, might be extended to any assets in the future
  const regex = /^https:\/\/.+?\.woff2$/;
  let isDev;

  return {
    name: "woff2BrowserPlugin",
    enforce: "pre",
    config(_, { command }) {
      isDev = command === "serve";
    },
    resolveId(source) {
      if (!regex.test(source)) {
        return null;
      }

      // getting the url to the dependency tree
      return source;
    },
    load(id) {
      if (!regex.test(id)) {
        return null;
      }

      // loading the url as string
      return `export default "${id}"`;
    },
    // necessary for dev as vite / rollup does skips https imports in serve (~dev) mode
    // aka dev mode equivalent of "export default x" above (resolveId + load)
    transform(code, id) {
      // treat https woff2 imports as a text
      if (isDev && id.endsWith("/excalidraw/fonts/index.ts")) {
        return code.replaceAll(
          /import\s+(\w+)\s+from\s+(["']https:\/\/.+?\.woff2["'])/g,
          `const $1 = $2`,
        );
      }
    },
  };
};
