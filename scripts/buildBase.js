const path = require("path");

const { buildMode } = require("./buildMode");

// contains all dependencies bundled inside
const getConfig = (outdir) => ({
  outdir,
  bundle: true,
  format: "esm",
  entryPoints: ["src/index.ts"],
  entryNames: "[name]",
  assetNames: "[dir]/[name]",
  alias: {
    "@excalidraw/utils": path.resolve(__dirname, "../packages/utils/src"),
  },
  external: [
    "@excalidraw/common",
    "@excalidraw/element",
    "@excalidraw/math",
    "@excalidraw/fractional-indexing",
  ],
});

const ENV_VARS = {
  development: { DEV: true },
  production: { PROD: true },
};

const createESMRawBuild = async () => {
  // development unminified build with source maps
  await buildMode(getConfig("dist/dev"), "development", ENV_VARS);

  // production minified build without sourcemaps
  await buildMode(getConfig("dist/prod"), "production", ENV_VARS);
};

(async () => {
  await createESMRawBuild();
})();
