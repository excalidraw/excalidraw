const fs = require("fs");
const path = require("path");
const { build } = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");

// renames .json import references into .js in the main chunk,
// since we are creating separate .js chunk per each .json locale
// and esbuild does not have a built-in option to do this without code-splitting
// which creates other unnecessary chunks
const localesPlugin = (outdir) => ({
  name: "locales-json-to-js-plugin",
  setup(build) {
    build.onEnd(async () => {
      const indexPath = path.resolve(process.cwd(), `${outdir}/index.js`);
      const newContent = fs
        .readFileSync(indexPath, "utf-8")
        .replace(/(\/locales\/.*?)\.json/g, "$1.js");

      fs.writeFileSync(indexPath, newContent);
    });
  },
});

// excludes all external dependencies and bundles only the source code
const getConfig = (outdir) => ({
  outdir,
  bundle: true,
  format: "esm",
  packages: "external",
  plugins: [sassPlugin(), localesPlugin(outdir)],
  assetNames: "[dir]/[name]",
  alias: {
    "@excalidraw/excalidraw": path.resolve(__dirname, "../packages/excalidraw"),
    "@excalidraw/utils": path.resolve(__dirname, "../packages/utils"),
    "@excalidraw/math": path.resolve(__dirname, "../packages/math"),
  },
  // otherwise esbuild will try to bundle these with the main chunk,
  // even though they are marked as separate entry points
  external: ["*.chunk", "*.json"],
  loader: {
    ".woff2": "file",
    ".json": "json",
  },
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
  const chunksConfig = {
    entryPoints: ["index.tsx", "**/*.chunk.ts"],
    entryNames: "[name]",
  };

  const localesConfig = {
    entryPoints: ["locales/*.json"],
    entryNames: "locales/[name]",
  };

  // development unminified build with source maps
  await buildDev({
    ...getConfig("dist/dev"),
    ...chunksConfig,
  });
  await buildDev({
    ...getConfig("dist/dev"),
    ...localesConfig,
  });

  // production minified buld without sourcemaps
  await buildProd({
    ...getConfig("dist/prod"),
    ...chunksConfig,
  });
  await buildProd({
    ...getConfig("dist/prod"),
    ...localesConfig,
  });
};

(async () => {
  await createESMRawBuild();
})();
