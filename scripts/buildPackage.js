const { build } = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");
const { externalGlobalPlugin } = require("esbuild-plugin-external-global");

// Will be used later for treeshaking
//const fs = require("fs");
// const path = require("path");

// function getFiles(dir, files = []) {
//   const fileList = fs.readdirSync(dir);
//   for (const file of fileList) {
//     const name = `${dir}/${file}`;
//     if (
//       name.includes("node_modules") ||
//       name.includes("config") ||
//       name.includes("package.json") ||
//       name.includes("main.js") ||
//       name.includes("index-node.ts") ||
//       name.endsWith(".d.ts")
//     ) {
//       continue;
//     }

//     if (fs.statSync(name).isDirectory()) {
//       getFiles(name, files);
//     } else if (
//       !(
//         name.match(/\.(sa|sc|c)ss$/) ||
//         name.match(/\.(woff|woff2|eot|ttf|otf)$/) ||
//         name.match(/locales\/[^/]+\.json$/)
//       )
//     ) {
//       continue;
//     } else {
//       files.push(name);
//     }
//   }
//   return files;
// }

const browserConfig = {
  entryPoints: ["index.tsx"],
  bundle: true,
  format: "esm",
  plugins: [
    sassPlugin(),
    externalGlobalPlugin({
      react: "React",
      "react-dom": "ReactDOM",
    }),
  ],
  splitting: true,
  loader: {
    ".woff2": "file",
  },
};
const createESMBrowserBuild = async () => {
  // Development unminified build with source maps
  await build({
    ...browserConfig,
    outdir: "dist/browser/dev",
    sourcemap: true,
    chunkNames: "excalidraw-assets-dev/[name]-[hash]",
    assetNames: "excalidraw-assets-dev/[name]-[hash]",
    define: {
      "import.meta.env": JSON.stringify({ DEV: true }),
    },
  });

  // production minified build without sourcemaps
  await build({
    ...browserConfig,
    outdir: "dist/browser/prod",
    minify: true,
    chunkNames: "excalidraw-assets/[name]-[hash]",
    assetNames: "excalidraw-assets/[name]-[hash]",
    define: {
      "import.meta.env": JSON.stringify({ PROD: true }),
    },
  });
};

// const BASE_PATH = `${path.resolve(`${__dirname}/..`)}`;
// const filesinExcalidrawPackage = [
//   ...getFiles(`${BASE_PATH}/packages/excalidraw`),
//   `${BASE_PATH}/packages/utils/export.ts`,
//   `${BASE_PATH}/packages/utils/bbox.ts`,
//   ...getFiles(`${BASE_PATH}/public/fonts`),
// ];

// const filesToTransform = filesinExcalidrawPackage.filter((file) => {
//   return !(
//     file.includes("/__tests__/") ||
//     file.includes(".test.") ||
//     file.includes("/tests/") ||
//     file.includes("example")
//   );
// });

const rawConfigCommon = {
  bundle: true,
  format: "esm",
  plugins: [sassPlugin()],
  assetNames: "[dir]/[name]-[hash]",
  loader: {
    ".json": "copy",
    ".woff2": "file",
  },
  packages: "external",
  // chunks are always external, so they are not bundled within and get build separately
  external: ["*.chunk"],
};

const rawConfigIndex = {
  ...rawConfigCommon,
  entryPoints: ["index.tsx"],
};

const rawConfigChunks = {
  ...rawConfigCommon,
  // create a separate chunk for each
  entryPoints: ["**/*.chunk.ts"],
};

function buildDev(chunkConfig) {
  const config = {
    ...chunkConfig,
    sourcemap: true,
    define: {
      "import.meta.env": JSON.stringify({ DEV: true }),
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
      "import.meta.env": JSON.stringify({ PROD: true }),
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
  await createESMBrowserBuild();
})();
