import { build } from "esbuild";
import { sassPlugin } from "esbuild-sass-plugin";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const parseEnvVariables = (filePath) => {
  try {
    const envContent = fs.readFileSync(filePath, "utf8");
    const envVars = {};
    envContent.split("\n").forEach((line) => {
      const [key, value] = line.split("=");
      if (key && value) envVars[key.trim()] = value.trim();
    });
    return envVars;
  } catch {
    return {};
  }
};

const ENV_VARS = {
  development: {
    ...parseEnvVariables(path.join(__dirname, "../.env.development")),
    DEV: true,
  },
  production: {
    ...parseEnvVariables(path.join(__dirname, "../.env.production")),
    PROD: true,
  },
};

const getConfig = (outdir) => ({
  outdir,
  bundle: true,
  splitting: true,
  format: "esm",
  target: "es2020",
  plugins: [
    sassPlugin({
      loadPaths: [
        path.resolve(__dirname, "../node_modules"),
        path.resolve(__dirname, "../node_modules/open-color"),
        path.resolve(__dirname, "../packages/excalidraw/css"),
        path.resolve(__dirname, "../packages/excalidraw/src"),
        path.resolve(__dirname, "../packages/excalidraw/components"),
      ],
      precompile: (source, pathname) => {
        // Skip precompile for open-color and css files to avoid loops
        if (
          pathname.includes("node_modules/open-color") ||
          pathname.includes("css/variables.module.scss") ||
          pathname.includes("css/styles.scss") ||
          pathname.includes("css/theme.scss")
        ) {
          return source;
        }
        if (pathname.endsWith(".scss")) {
          return `
            @use '../css/variables.module.scss' as vars;
            @use '../css/styles.scss' as styles;
            ${source}
          `;
        }
        return source;
      },
      type: "css",
      sourceMap: false,
      logger: {
        warn: () => {},
        error: (msg) => {
          console.error("Sass compilation error:", msg);
          throw new Error(msg);
        },
      },
    }),
  ],
  assetNames: "[dir]/[name]",
  chunkNames: "[dir]/[name]-[hash]",
  alias: {
    "@excalidraw/common": path.resolve(__dirname, "../packages/common/src"),
    "@excalidraw/element": path.resolve(__dirname, "../packages/element/src"),
    "@excalidraw/excalidraw": path.resolve(__dirname, "../packages/excalidraw"),
    "@excalidraw/math": path.resolve(__dirname, "../packages/math/src"),
    "@excalidraw/utils": path.resolve(__dirname, "../packages/utils/src"),
  },
  loader: { ".woff2": "file" },
});

async function buildDev(config) {
  console.log("Starting dev build to", config.outdir);
  try {
    await build({
      ...config,
      sourcemap: true,
      define: { "import.meta.env": JSON.stringify(ENV_VARS.development) },
    });
    console.log("Dev build completed successfully");
  } catch (err) {
    console.error("Dev build failed:", err);
    throw err;
  }
}

async function buildProd(config) {
  console.log("Starting prod build to", config.outdir);
  try {
    await build({
      ...config,
      minify: true,
      define: { "import.meta.env": JSON.stringify(ENV_VARS.production) },
    });
    console.log("Prod build completed successfully");
  } catch (err) {
    console.error("Prod build failed:", err);
    throw err;
  }
}

const createESMRawBuild = async () => {
  console.log("Creating ESM raw build...");
  const prodDir = path.resolve(__dirname, "../packages/excalidraw/dist/prod");
  const devDir = path.resolve(__dirname, "../packages/excalidraw/dist/dev");

  if (!fs.existsSync(prodDir)) {
    fs.mkdirSync(prodDir, { recursive: true });
  }
  if (!fs.existsSync(devDir)) {
    fs.mkdirSync(devDir, { recursive: true });
  }

  const chunksConfig = {
    entryPoints: [
      path.resolve(__dirname, "../packages/excalidraw/index.tsx"),
      ...fs
        .readdirSync(path.resolve(__dirname, "../packages/excalidraw"), { recursive: true })
        .filter((file) => file.endsWith(".chunk.ts"))
        .map((file) => path.resolve(__dirname, "../packages/excalidraw", file)),
    ],
    entryNames: "[name]",
  };

  await buildDev({
    ...getConfig(path.resolve(__dirname, "../packages/excalidraw/dist/dev")),
    ...chunksConfig,
  });
  await buildProd({
    ...getConfig(path.resolve(__dirname, "../packages/excalidraw/dist/prod")),
    ...chunksConfig,
  });
  console.log("ESM raw build finished");
};

(async () => {
  console.log("Build script started");
  try {
    await createESMRawBuild();
    console.log("Build script completed successfully");
  } catch (err) {
    console.error("Build script failed:", err);
    process.exit(1);
  }
})();