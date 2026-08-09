/**
 * Builds the Excalidraw ESM source graph for the Obsidian plugin runtime.
 *
 * Author: zsviczian
 *
 * References:
 * - https://github.com/zsviczian/obsidian-excalidraw-plugin
 * - https://github.com/excalidraw/excalidraw/releases/tag/v0.18.0
 *
 * Obsidian requires a single offline JavaScript artifact. React remains an
 * injected peer so the plugin can create a private matching runtime for every
 * Obsidian popout window. Mermaid also remains host-provided and is resolved
 * lazily through the fork's getSharedMermaidInstance() integration.
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const { build } = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");
const { externalGlobalPlugin } = require("esbuild-plugin-external-global");

const { parseEnvVariables } = require("../packages/excalidraw/env.cjs");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const PACKAGE_ROOT = path.join(REPOSITORY_ROOT, "packages/excalidraw");
const OUTPUT_ROOT = path.join(PACKAGE_ROOT, "dist/obsidian");

// zsviczian: clean only the consumer-specific output so build:obsidian can run
// after upstream build:esm without deleting its ESM and declaration artifacts.
fs.rmSync(OUTPUT_ROOT, { force: true, recursive: true });

const ENV_VARS = {
  development: {
    ...parseEnvVariables(path.join(REPOSITORY_ROOT, ".env.development")),
    DEV: true,
  },
  production: {
    ...parseEnvVariables(path.join(REPOSITORY_ROOT, ".env.production")),
    PROD: true,
  },
};

/** Resolves Sass partials before the package is compiled by esbuild. */
const resolveRelativeStylePath = (importPath, sourceFile) => {
  const sourceDirectory = path.dirname(sourceFile);

  for (const extension of [".scss", ".css", ""]) {
    const fullPath = path.resolve(sourceDirectory, importPath + extension);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }

    const partialPath = path.join(
      path.dirname(fullPath),
      `_${path.basename(fullPath)}`,
    );
    if (fs.existsSync(partialPath)) {
      return partialPath;
    }
  }

  return null;
};

/** Converts relative Sass imports to file URLs understood from every package. */
const precompileStyles = (source, sourcePath) =>
  source.replace(
    /(@use|@forward)\s+["'](\.[^"']+)["']/g,
    (match, directive, importPath) => {
      const resolvedPath = resolveRelativeStylePath(importPath, sourcePath);
      return resolvedPath
        ? `${directive} "${pathToFileURL(resolvedPath).href}"`
        : match;
    },
  );

/**
 * Keeps Xiaolai CJK subsets as lazy remote/vault paths while allowing every
 * other WOFF2 import to be embedded by esbuild's data URL loader.
 */
const cjkFontPathPlugin = {
  name: "obsidian-cjk-font-paths",
  setup(buildContext) {
    buildContext.onResolve(
      { filter: /Xiaolai-Regular-.*\.woff2$/ },
      (args) => ({
        path: path.resolve(path.dirname(args.importer), args.path),
        namespace: "obsidian-cjk-font",
      }),
    );

    buildContext.onLoad(
      { filter: /.*/, namespace: "obsidian-cjk-font" },
      (args) => {
        const packageRelativePath = path
          .relative(PACKAGE_ROOT, args.path)
          .split(path.sep)
          .join("/");

        return {
          contents: `export default ${JSON.stringify(packageRelativePath)};`,
          loader: "js",
        };
      },
    );
  },
};

/** Creates one development or production Obsidian runtime artifact. */
const buildObsidianRuntime = (mode) => {
  const isProduction = mode === "production";

  return build({
    entryPoints: [path.join(PACKAGE_ROOT, "obsidianEntry.ts")],
    outfile: path.join(
      OUTPUT_ROOT,
      `excalidraw.${isProduction ? "production.min" : "development"}.js`,
    ),
    bundle: true,
    splitting: false,
    format: "iife",
    globalName: "ExcalidrawLib",
    platform: "browser",
    target: "es2020",
    minify: isProduction,
    // zsviczian: retain original TS/TSX sources in debugger-only builds.
    sourcemap: isProduction ? false : "inline",
    legalComments: "none",
    treeShaking: true,
    conditions: [mode, "browser", "default"],
    mainFields: ["browser", "module", "main"],
    alias: {
      "@excalidraw/common": path.join(REPOSITORY_ROOT, "packages/common/src"),
      "@excalidraw/element": path.join(REPOSITORY_ROOT, "packages/element/src"),
      "@excalidraw/fractional-indexing": path.join(
        REPOSITORY_ROOT,
        "packages/fractional-indexing/src",
      ),
      "@excalidraw/math": path.join(REPOSITORY_ROOT, "packages/math/src"),
      "@excalidraw/utils": path.join(REPOSITORY_ROOT, "packages/utils/src"),
    },
    define: {
      "import.meta.env": JSON.stringify(ENV_VARS[mode]),
      // Obsidian evaluates one in-memory bundle, so no worker module URL exists.
      "import.meta.url": "undefined",
      "process.env.NODE_ENV": JSON.stringify(mode),
    },
    plugins: [
      externalGlobalPlugin({
        react: "React",
        "react-dom": "ReactDOM",
        "react/jsx-runtime": "ReactJSXRuntime",
        "react/jsx-dev-runtime": "ReactJSXDevRuntime",
      }),
      cjkFontPathPlugin,
      sassPlugin({ precompile: precompileStyles }),
    ],
    loader: {
      ".woff2": "dataurl",
    },
    // zsviczian: retain the documented scripting API without exposing React.
    footer: { js: "self.ExcalidrawLib = ExcalidrawLib;" },
  });
};

/**
 * Removes the redundant CSS map while retaining the development JavaScript
 * map that exposes the original TypeScript and TSX sources in DevTools.
 */
const stripDevelopmentCssSourceMap = () => {
  // zsviczian: avoid nesting the CSS map when the plugin runs cssnano later.
  const developmentCssPath = path.join(
    OUTPUT_ROOT,
    "excalidraw.development.css",
  );
  const developmentCss = fs.readFileSync(developmentCssPath, "utf8");
  const cssWithoutSourceMap = developmentCss.replace(
    /\n?\/\*# sourceMappingURL=data:application\/json;base64,[^*]+\*\/\s*$/,
    "\n",
  );

  if (cssWithoutSourceMap === developmentCss) {
    throw new Error("Development CSS did not contain an inline source map");
  }

  fs.writeFileSync(developmentCssPath, cssWithoutSourceMap);
};

(async () => {
  await buildObsidianRuntime("production");
  await buildObsidianRuntime("development");
  stripDevelopmentCssSourceMap(); // zsviczian
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
