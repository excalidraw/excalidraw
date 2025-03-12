const path = require("path");

const { build } = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");

// contains all dependencies bundled inside
const getConfig = (outdir) => ({
  outdir,
  bundle: true,
  format: "esm",
  entryPoints: ["index.ts"],
  entryNames: "[name]",
  assetNames: "[dir]/[name]",
  alias: {
    "@excalidraw/excalidraw": path.resolve(__dirname, "../packages/excalidraw"),
    "@excalidraw/utils": path.resolve(__dirname, "../packages/utils"),
    "@excalidraw/math": path.resolve(__dirname, "../packages/math"),
  },
});

function buildDev(config) {
  return build({
    ...config,
    plugins: [sassPlugin()],
    sourcemap: true,
    define: {
      "import.meta.env": JSON.stringify({ DEV: true }),
    },
  });
}

function buildProd(config) {
  return build({
    ...config,
    plugins: [sassPlugin()],
    minify: true,
    define: {
      "import.meta.env": JSON.stringify({ PROD: true }),
    },
  });
}

const createESMRawBuild = async () => {
  // development unminified build with source maps
  buildDev(getConfig("dist/dev"));

  // production minified build without sourcemaps
  buildProd(getConfig("dist/prod"));
};

(async () => {
  await createESMRawBuild();
})();
