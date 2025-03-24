const path = require("path");

const { build } = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");

const { woff2ServerPlugin } = require("./woff2/woff2-esbuild-plugins");

// contains all dependencies bundled inside
const getConfig = (outdir) => ({
  outdir,
  bundle: true,
  format: "esm",
  entryPoints: ["src/index.ts"],
  entryNames: "[name]",
  assetNames: "[dir]/[name]",
  alias: {
    "@excalidraw/common": path.resolve(__dirname, "../packages/common/src"),
    "@excalidraw/element": path.resolve(__dirname, "../packages/element/src"),
    "@excalidraw/excalidraw": path.resolve(__dirname, "../packages/excalidraw"),
    "@excalidraw/math": path.resolve(__dirname, "../packages/math/src"),
    "@excalidraw/utils": path.resolve(__dirname, "../packages/utils/src"),
  },
});

function buildDev(config) {
  return build({
    ...config,
    sourcemap: true,
    plugins: [sassPlugin(), woff2ServerPlugin()],
    define: {
      "import.meta.env": JSON.stringify({ DEV: true }),
    },
  });
}

function buildProd(config) {
  return build({
    ...config,
    minify: true,
    plugins: [
      sassPlugin(),
      woff2ServerPlugin({
        outdir: `${config.outdir}/assets`,
      }),
    ],
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
