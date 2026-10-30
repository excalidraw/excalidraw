import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

import type { Plugin, Rollup } from "vite";

/**
 * One file of the build, as `POST /api/oss/bundle-runs` stores it (see
 * `scripts/stats/post.mjs`).
 */
type BundleStatsAsset = {
  /** the same from build to build: a chunk's entry module or name, an asset's source file */
  name: string;
  /** the emitted file, e.g. `assets/index-CNToBGx8.js` */
  file: string;
  type: "js" | "css" | "html" | "font" | "other";
  /** loaded with the page: the HTML, the entry chunk, its static imports and their CSS */
  initial: boolean;
  bytes: number;
  gzipBytes: number;
  brotliBytes: number;
  /** a chunk's source packages → their bytes in it before minification */
  packages: Record<string, number>;
};

const BUNDLE_STATS_FILE = "bundle-stats.json";

const REPO_ROOT = path.resolve(__dirname, "../..");

const NODE_MODULES = "/node_modules/";

const getType = (fileName: string): BundleStatsAsset["type"] =>
  fileName.endsWith(".js")
    ? "js"
    : fileName.endsWith(".css")
    ? "css"
    : fileName.endsWith(".html")
    ? "html"
    : /\.(woff2?|ttf|otf)$/.test(fileName)
    ? "font"
    : "other";

/** A module id without Rollup's virtual-module prefix and query. */
const cleanId = (id: string) => id.replace(/^\0/, "").split("?")[0];

/** A module's path from the repo root, or from `node_modules` for dependencies. */
const toRepoPath = (id: string) => {
  const nodeModules = id.lastIndexOf(NODE_MODULES);
  return nodeModules >= 0
    ? id.slice(nodeModules + 1)
    : path.relative(REPO_ROOT, id).split(path.sep).join("/");
};

/**
 * The package a module comes from: its npm package, `@excalidraw/<name>` for
 * the monorepo's packages, the app, or the bundler's own helpers.
 */
const getPackage = (moduleId: string) => {
  const id = cleanId(moduleId);
  const nodeModules = id.lastIndexOf(NODE_MODULES);
  if (nodeModules >= 0) {
    const [scope, name] = id
      .slice(nodeModules + NODE_MODULES.length)
      .split("/");
    return scope.startsWith("@") ? `${scope}/${name}` : scope;
  }
  if (!path.isAbsolute(id)) {
    // e.g. vite/preload-helper, commonjsHelpers
    return "(bundler)";
  }
  const [dir, name] = toRepoPath(id).split("/");
  return dir === "packages" ? `@excalidraw/${name}` : dir;
};

const getSizes = (source: string | Uint8Array) => {
  const buffer = Buffer.from(source);
  return {
    bytes: buffer.length,
    gzipBytes: zlib.gzipSync(buffer, { level: 9 }).length,
    brotliBytes: zlib.brotliCompressSync(buffer, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
    }).length,
  };
};

/** The chunks loaded with the page: the entries and what they import statically, and their CSS. */
const getInitialFiles = (chunks: Rollup.OutputChunk[]) => {
  const chunksByFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const initial = new Set<string>();
  const stack = chunks.filter((chunk) => chunk.isEntry);

  while (stack.length) {
    const chunk = stack.pop()!;
    if (initial.has(chunk.fileName)) {
      continue;
    }
    initial.add(chunk.fileName);
    chunk.viteMetadata?.importedCss.forEach((css) => initial.add(css));
    for (const fileName of chunk.imports) {
      const imported = chunksByFile.get(fileName);
      if (imported) {
        stack.push(imported);
      }
    }
  }

  return initial;
};

/**
 * Writes `bundle-stats.json` next to the build: every emitted file (source
 * maps aside) with its minified, gzip and Brotli (maximum compression) sizes,
 * whether the page loads it initially and, for chunks, the bytes per source
 * package. Master CI (`.github/workflows/stats.yml`) posts it to the
 * Excalidraw+ admin (`scripts/stats/post.mjs`); applied by
 * `scripts/stats/vite.config.mts`, not by the app's own builds.
 */
export const bundleStatsPlugin = (): Plugin => {
  // the assets' source files are relative to it
  let root = process.cwd();

  return {
    name: "excalidraw-bundle-stats",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      root = config.root;
    },
    writeBundle(options, bundle) {
      const outputs = Object.values(bundle).filter(
        (output) => !output.fileName.endsWith(".map"),
      );
      const chunks = outputs.filter(
        (output): output is Rollup.OutputChunk => output.type === "chunk",
      );
      const initialFiles = getInitialFiles(chunks);
      const usedNames = new Map<string, number>();

      // unique within the build: Rollup may give shared chunks the same name
      const uniqueName = (name: string) => {
        const count = (usedNames.get(name) ?? 0) + 1;
        usedNames.set(name, count);
        return count > 1 ? `${name} (${count})` : name;
      };

      const assets = outputs.map((output): BundleStatsAsset => {
        const type = getType(output.fileName);

        if (output.type === "chunk") {
          const packages: Record<string, number> = {};
          for (const [id, { renderedLength }] of Object.entries(
            output.modules,
          )) {
            if (renderedLength) {
              const name = getPackage(id);
              packages[name] = (packages[name] ?? 0) + renderedLength;
            }
          }

          return {
            name: uniqueName(
              output.facadeModuleId
                ? toRepoPath(cleanId(output.facadeModuleId))
                : `${output.name}.js`,
            ),
            file: output.fileName,
            type,
            initial: initialFiles.has(output.fileName),
            ...getSizes(output.code),
            packages,
          };
        }

        const source = output.originalFileNames?.[0];
        return {
          name: uniqueName(
            source
              ? toRepoPath(path.resolve(root, source))
              : // emitted without a source (the HTML, CSS of chunks): the file without its hash
                output.fileName.replace(/-[\w-]{8}(\.[^./]+)$/, "$1"),
          ),
          file: output.fileName,
          type,
          initial: type === "html" || initialFiles.has(output.fileName),
          ...getSizes(output.source),
          packages: {},
        };
      });

      fs.writeFileSync(
        path.join(options.dir!, BUNDLE_STATS_FILE),
        JSON.stringify({ assets }, null, 2),
      );
    },
  };
};
