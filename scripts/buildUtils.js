const fs = require("fs");
const { build } = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");
const { woff2ServerPlugin } = require("./woff2/woff2-esbuild-plugins");

const browserConfig = {
  entryPoints: ["index.ts"],
  bundle: true,
  format: "esm",
  plugins: [sassPlugin()],
  assetNames: "assets/[name]",
  loader: {
    ".woff2": "file",
  },
};

// Will be used later for treeshaking

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
//       name.endsWith(".d.ts") ||
//       name.endsWith(".md")
//     ) {
//       continue;
//     }

//     if (fs.statSync(name).isDirectory()) {
//       getFiles(name, files);
//     } else if (
//       name.match(/\.(sa|sc|c)ss$/) ||
//       name.match(/\.(woff|woff2|eot|ttf|otf)$/) ||
//       name.match(/locales\/[^/]+\.json$/)
//     ) {
//       continue;
//     } else {
//       files.push(name);
//     }
//   }
//   return files;
// }
const createESMBrowserBuild = async () => {
  // Development unminified build with source maps
  const browserDev = await build({
    ...browserConfig,
    outdir: "dist/browser/dev",
    sourcemap: true,
    metafile: true,
    define: {
      "import.meta.env": JSON.stringify({ DEV: true }),
    },
  });
  fs.writeFileSync(
    "meta-browser-dev.json",
    JSON.stringify(browserDev.metafile),
  );

  // production minified build without sourcemaps
  const browserProd = await build({
    ...browserConfig,
    outdir: "dist/browser/prod",
    minify: true,
    metafile: true,
    define: {
      "import.meta.env": JSON.stringify({ PROD: true }),
    },
  });
  fs.writeFileSync(
    "meta-browser-prod.json",
    JSON.stringify(browserProd.metafile),
  );
};

const rawConfig = {
  entryPoints: ["index.ts"],
  bundle: true,
  format: "esm",
};

// const BASE_PATH = `${path.resolve(`${__dirname}/..`)}`;
// const filesinExcalidrawPackage = getFiles(`${BASE_PATH}/packages/utils`);

// const filesToTransform = filesinExcalidrawPackage.filter((file) => {
//   return !(
//     file.includes("/__tests__/") ||
//     file.includes(".test.") ||
//     file.includes("/tests/") ||
//     file.includes("example")
//   );
// });
const createESMRawBuild = async () => {
  // Development unminified build with source maps
  const rawDev = await build({
    ...rawConfig,
    outdir: "dist/dev",
    sourcemap: true,
    metafile: true,
    plugins: [sassPlugin(), woff2ServerPlugin({ outdir: "dist/dev/assets" })],
    define: {
      "import.meta.env": JSON.stringify({ DEV: true }),
    },
  });
  fs.writeFileSync("meta-raw-dev.json", JSON.stringify(rawDev.metafile));

  // production minified build without sourcemaps
  const rawProd = await build({
    ...rawConfig,
    outdir: "dist/prod",
    minify: true,
    metafile: true,
    plugins: [
      sassPlugin(),
      woff2ServerPlugin({ outdir: "dist/prod/assets", generateTtf: true }),
    ],
    define: {
      "import.meta.env": JSON.stringify({ PROD: true }),
    },
  });
  fs.writeFileSync("meta-raw-prod.json", JSON.stringify(rawProd.metafile));
};

createESMRawBuild();
createESMBrowserBuild();
