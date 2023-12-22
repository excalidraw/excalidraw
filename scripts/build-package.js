const { build } = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");
const { externalGlobalPlugin } = require("esbuild-plugin-external-global");

const fs = require("fs");
const path = require("path");

function getFiles(dir, files = []) {
  const fileList = fs.readdirSync(dir);
  for (const file of fileList) {
    const name = `${dir}/${file}`;
    if (
      name.includes("node_modules") ||
      name.includes("config") ||
      name.includes("package.json") ||
      name.includes("main.js") ||
      name.includes("index-node.ts") ||
      name.endsWith(".d.ts")
    ) {
      continue;
    }

    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files);
    } else if (
      !(
        name.match(/\.(sa|sc|c)ss$/) ||
        name.match(/\.(woff|woff2|eot|ttf|otf)$/) ||
        name.match(/locales\/[^/]+\.json$/)
      )
    ) {
      continue;
    } else {
      files.push(name);
    }
  }
  return files;
}

const createESMBrowserBuild = async () => {
  await build({
    entryPoints: ["index.tsx"],
    bundle: true,
    format: "esm",
    outdir: "dist/browser",
    plugins: [
      sassPlugin(),
      externalGlobalPlugin({
        react: "React",
        "react-dom": "ReactDOM",
      }),
    ],
    define: {
      "import.meta.env": "{}",
    },
    splitting: true,
    chunkNames: "excalidraw-assets/[name]-[hash]",
    loader: {
      ".woff2": "dataurl",
    },
  });
};

const BASE_PATH = `${path.resolve(`${__dirname}/..`)}`;
const filesinExcalidrawPackage = [
  ...getFiles(`${BASE_PATH}/packages/excalidraw`),
  `${BASE_PATH}/packages/utils/export.ts`,
  `${BASE_PATH}/packages/utils/bbox.ts`,
  ...getFiles(`${BASE_PATH}/public/fonts`),
];

const filesToTransform = filesinExcalidrawPackage.filter((file) => {
  return !(
    file.includes("/__tests__/") ||
    file.includes(".test.") ||
    file.includes("/tests/") ||
    file.includes("example")
  );
});

const createESMRawBuild = async () => {
  const result = await build({
    entryPoints: filesToTransform,
    bundle: false,
    format: "esm",
    outdir: "dist",
    define: {
      "import.meta.env": "{}",
    },
    loader: {
      ".woff2": "copy",
      ".ttf": "copy",
      ".scss": "copy",
      ".css": "copy",
      ".json": "copy",
    },
    packages: "external",
    metafile: true,
  });
  fs.writeFileSync("meta.json", JSON.stringify(result.metafile));
};

createESMRawBuild();
createESMBrowserBuild();
