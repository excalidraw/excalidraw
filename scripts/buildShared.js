const fs = require("fs");
const { build } = require("esbuild");

const rawConfig = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "esm",
  metafile: true,
  treeShaking: true,
  external: ["*.scss"],
};

const createESMRawBuild = async () => {
  // Development unminified build with source maps
  const dev = await build({
    ...rawConfig,
    outdir: "dist/dev",
    sourcemap: true,
    define: {
      "import.meta.env": JSON.stringify({ DEV: true }),
    },
  });

  fs.writeFileSync("meta-dev.json", JSON.stringify(dev.metafile));

  // production minified build without sourcemaps
  const prod = await build({
    ...rawConfig,
    outdir: "dist/prod",
    minify: true,
    define: {
      "import.meta.env": JSON.stringify({ PROD: true }),
    },
  });

  fs.writeFileSync("meta-prod.json", JSON.stringify(prod.metafile));
};

createESMRawBuild();
