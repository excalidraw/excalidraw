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
  // resolve workspace packages (linked through node_modules) to their
  // sources: see the "excalidraw-source" condition in their `exports`
  conditions: ["excalidraw-source"],
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
  await buildDev(getConfig("dist/dev"));

  // production minified build without sourcemaps
  await buildProd(getConfig("dist/prod"));
};

(async () => {
  await createESMRawBuild();
})();
