const path = require("path");

const { build } = require("esbuild");

// the package being built (scripts run from the package directory)
const { name: packageName } = require(path.resolve("package.json"));

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
    // bundled sources (e.g. utils) may import the package being built by
    // name: resolve those to its own sources instead of a self-import, which
    // doesn't resolve from inside the package with an isolated node_modules
    [packageName]: path.resolve("src"),
  },
  external: [
    "@excalidraw/common",
    "@excalidraw/element",
    "@excalidraw/math",
    "@excalidraw/fractional-indexing",
  ].filter((name) => name !== packageName),
});

function buildDev(config) {
  return build({
    ...config,
    sourcemap: true,
    define: {
      "import.meta.env": JSON.stringify({ DEV: true }),
    },
  });
}

function buildProd(config) {
  return build({
    ...config,
    minify: true,
    define: {
      "import.meta.env": JSON.stringify({ PROD: true }),
    },
  });
}

const createESMRawBuild = async () => {
  // development unminified build with source maps
  await buildDev(getConfig("dist/dev"));

  // production minified build without sourcemaps
  await buildProd(getConfig("dist/prod"));
};

(async () => {
  await createESMRawBuild();
})();
