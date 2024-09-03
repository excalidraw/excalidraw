const fs = require("fs");
const { build } = require("esbuild");

const browserConfig = {
  entryPoints: ["index.ts"],
  bundle: true,
  format: "esm",
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
  packages: "external",
};

const createESMRawBuild = async () => {
  // Development unminified build with source maps
  const rawDev = await build({
    ...rawConfig,
    outdir: "dist/dev",
    sourcemap: true,
    metafile: true,
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
    define: {
      "import.meta.env": JSON.stringify({ PROD: true }),
    },
  });
  fs.writeFileSync("meta-raw-prod.json", JSON.stringify(rawProd.metafile));
};

createESMRawBuild();
createESMBrowserBuild();
