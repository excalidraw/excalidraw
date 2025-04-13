import { build } from "esbuild";
import { sassPlugin } from "esbuild-sass-plugin";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { woff2ServerPlugin } from "./woff2/woff2-esbuild-plugins.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log("Starting build (ESM) - DEBUG VERSION...");

const ensureDir = (dir) => {
  console.log(`[DEBUG] Ensuring directory: ${dir}`);
  try {
    if (!fs.existsSync(dir)) {
      console.log(`[DEBUG] Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[DEBUG] Successfully created directory: ${dir}`);
    } else {
      console.log(`[DEBUG] Directory already exists: ${dir}`);
    }
    return true;
  } catch (err) {
    console.error(`[ERROR] Failed to create directory ${dir}:`, err);
    return false;
  }
};

const getConfig = (outdir) => {
  ensureDir(outdir);
  return {
    outdir,
    bundle: true,
    format: "esm",
    entryPoints: ["src/index.ts"],
    entryNames: "[name]",
    assetNames: "[dir]/[name]",
    alias: {
      "@excalidraw/common": path.resolve(__dirname, "../packages/common/src"),
      "@excalidraw/element": path.resolve(__dirname, "../packages/element/src"),
      "@excalidraw/excalidraw": path.resolve(__dirname, "../packages/excalidraw"),
      "@excalidraw/math": path.resolve(__dirname, "../packages/math/src"),
      "@excalidraw/utils": path.resolve(__dirname, "../packages/utils/src"),
    },
  };
};

async function buildDev(config) {
  console.log("Building dev version...");
  try {
    await build({
      ...config,
      sourcemap: true,
      plugins: [sassPlugin(), woff2ServerPlugin()],
      define: {
        "import.meta.env": JSON.stringify({ DEV: true }),
      },
    });
    console.log("Dev build completed successfully");
  } catch (err) {
    console.error("Dev build failed:", err);
    throw err;
  }
}

async function buildProd(config) {
  console.log("Building prod version...");
  try {
    await build({
      ...config,
      minify: true,
      plugins: [
        sassPlugin(),
        woff2ServerPlugin({
          outdir: `${config.outdir}/assets`,
        }),
      ],
      define: {
        "import.meta.env": JSON.stringify({ PROD: true }),
      },
    });
    console.log("Prod build completed successfully");
  } catch (err) {
    console.error("Prod build failed:", err);
    throw err;
  }
}

const createESMRawBuild = async () => {
  // development unminified build with source maps
  await buildDev(getConfig("dist/dev"));

  // production minified build without sourcemaps
  await buildProd(getConfig("dist/prod"));
  console.log("All builds complete.");
};

(async () => {
  try {
    await createESMRawBuild();
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
})();
