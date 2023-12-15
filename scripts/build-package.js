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
        name.endsWith(".js") ||
        name.endsWith(".ts") ||
        name.endsWith(".tsx") ||
        name.endsWith(".scss") ||
        name.endsWith(".scss")
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

const createESMRawBuild = async () => {
  await build({
    entryPoints: ["index.tsx"],
    bundle: true,
    format: "esm",
    outdir: "dist",
    plugins: [sassPlugin()],
    define: {
      "import.meta.env": "{}",
    },
    chunkNames: "excalidraw-assets/[name]-[hash]",
    loader: {
      ".woff2": "dataurl",
    },
    packages: "external",
  });
};

const filesinExcalidrawPackage = getFiles(
  `${path.resolve(`${__dirname}/..`)}/packages/excalidraw`,
);

const filesToTransform = filesinExcalidrawPackage.filter((file) => {
  return !(
    file.includes("/__tests__/") ||
    file.includes(".test.") ||
    file.includes("/tests/") ||
    file.includes("example")
  );
});

createESMRawBuild();
createESMBrowserBuild();
