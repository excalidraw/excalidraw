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
    ".woff2": "copy",
    ".ttf": "copy",
  },
};
const createESMBrowserBuild = async () => {
  // Development unminified build with source maps
  await build({
    ...browserConfig,
    outdir: "dist/browser/dev",
    sourcemap: true,
    chunkNames: "excalidraw-assets-dev/[name]-[hash]",
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

const rawConfig = {
  entryPoints: ["index.tsx"],
  bundle: true,
  format: "esm",
  plugins: [sassPlugin()],

  loader: {
    ".woff2": "copy",
    ".ttf": "copy",
    ".json": "copy",
  },
  packages: "external",
};

const createESMRawBuild = async () => {
  // Development unminified build with source maps
  await build({
    ...rawConfig,
    sourcemap: true,
    outdir: "dist/dev",
    define: {
      "import.meta.env": JSON.stringify({ DEV: true }),
    },
  });

  // production minified build without sourcemaps
  await build({
    ...rawConfig,
    minify: true,
    outdir: "dist/prod",
    define: {
      "import.meta.env": JSON.stringify({ PROD: true }),
    },
  });
};

createESMRawBuild();
createESMBrowserBuild();
