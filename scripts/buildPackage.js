const path = require("path");

const { build } = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");

const { parseEnvVariables } = require("../packages/excalidraw/env.cjs");

const ENV_VARS = {
  development: {
    ...parseEnvVariables(`${__dirname}/../.env.development`),
    DEV: true,
  },
  production: {
    ...parseEnvVariables(`${__dirname}/../.env.production`),
    PROD: true,
  },
};

const rawConfigCommon = {
  bundle: true,
  format: "esm",
  plugins: [sassPlugin()],
  assetNames: "[dir]/[name]",
  chunkNames: "[dir]/[name]-[hash]",
  // chunks are always external, so they are not bundled within and get build separately
  external: ["*.chunk"],
  packages: "external",
  alias: {
    "@excalidraw/common": path.resolve(__dirname, "../packages/common/src"),
    "@excalidraw/element": path.resolve(__dirname, "../packages/element/src"),
    "@excalidraw/excalidraw": path.resolve(__dirname, "../packages/excalidraw"),
    "@excalidraw/math": path.resolve(__dirname, "../packages/math/src"),
    "@excalidraw/utils": path.resolve(__dirname, "../packages/utils/src"),
  },
  loader: {
    ".woff2": "file",
  },
};

const rawConfigIndex = {
  ...rawConfigCommon,
  entryPoints: ["index.tsx"],
};

const rawConfigChunks = {
  ...rawConfigCommon,
  // create a separate chunk for each
  entryPoints: ["**/*.chunk.ts"],
  entryNames: "[name]",
};

function buildDev(chunkConfig) {
  const config = {
    ...chunkConfig,
    sourcemap: true,
    define: {
      "import.meta.env": JSON.stringify(ENV_VARS.development),
    },
    outdir: "dist/dev",
  };

  return build(config);
}

function buildProd(chunkConfig) {
  const config = {
    ...chunkConfig,
    minify: true,
    define: {
      "import.meta.env": JSON.stringify(ENV_VARS.production),
    },
    outdir: "dist/prod",
  };

  return build(config);
}

const createESMRawBuild = async () => {
  // development unminified build with source maps
  await buildDev(rawConfigIndex);
  await buildDev(rawConfigChunks);

  // production minified buld without sourcemaps
  await buildProd(rawConfigIndex);
  await buildProd(rawConfigChunks);
};

// otherwise throws "ERROR: Could not resolve "./subset-worker.chunk"
(async () => {
  await createESMRawBuild();
})();
