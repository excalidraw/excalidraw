const path = require("path");
const { build } = require("esbuild");

console.log("Starting build...");

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
  console.log("Building dev...");
  return build({
    ...config,
    sourcemap: true,
    define: {
      "import.meta.env": JSON.stringify({ DEV: true }),
    },
  });
}

function buildProd(config) {
  console.log("Building prod...");
  return build({
    ...config,
    minify: true,
    define: {
      "import.meta.env": JSON.stringify({ PROD: true }),
    },
  });
}

const createESMRawBuild = async () => {
  await buildDev(getConfig("dist/dev"));
  await buildProd(getConfig("dist/prod"));
  console.log("Build complete.");
};

(async () => {
  await createESMRawBuild();
})();