import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgrPlugin from "vite-plugin-svgr";
import { ViteEjsPlugin } from "vite-plugin-ejs";
import { VitePWA } from "vite-plugin-pwa";
import checker from "vite-plugin-checker";
import { createHtmlPlugin } from "vite-plugin-html";
import Sitemap from "vite-plugin-sitemap";
import { woff2BrowserPlugin } from "../scripts/woff2/woff2-vite-plugins";

import { MERMAID_CHUNKS_LIST_NAME } from "./data/cacheMermaidChunks";

import type { Plugin, Rollup } from "vite";

/**
 * Collects into `lazyChunkFileNames` the chunks reachable only via a dynamic
 * import of a module matching `moduleRegex`, so we can exclude them from the
 * PWA precache. Needed for large lazy deps that Rollup splits into many
 * arbitrarily named chunks (e.g. mermaid), which `globIgnores` can't target.
 *
 * With `listName`, their file names are also emitted as a JSON asset that
 * index.html points to (`<meta name={listName} content={fileName}>`), for the
 * app to cache them when it needs them.
 */
const lazyChunksPlugin = (
  moduleRegex: RegExp,
  lazyChunkFileNames: Set<string>,
  listName?: string,
): Plugin => ({
  name: "excalidraw-lazy-chunks",
  apply: "build",
  generateBundle(_options, bundle) {
    const chunks = new Map<string, Rollup.OutputChunk>();
    for (const file of Object.values(bundle)) {
      if (file.type === "chunk") {
        chunks.set(file.fileName, file);
      }
    }

    // the dynamically imported module may share its chunk with its deps
    // (no `facadeModuleId` then), so match on any contained module
    const isLazyRoot = (chunk: Rollup.OutputChunk) =>
      chunk.isDynamicEntry &&
      !chunk.isEntry &&
      chunk.moduleIds.some((id) => moduleRegex.test(id));

    const collectReachable = (
      roots: Rollup.OutputChunk[],
      skipDynamicImport: (chunk: Rollup.OutputChunk) => boolean,
    ) => {
      const reachable = new Set<string>();
      const stack = [...roots];
      while (stack.length) {
        const chunk = stack.pop()!;
        if (reachable.has(chunk.fileName)) {
          continue;
        }
        reachable.add(chunk.fileName);
        // static imports are always followed: they're needed whenever the
        // importing chunk is loaded
        for (const fileName of chunk.imports) {
          const next = chunks.get(fileName);
          if (next) {
            stack.push(next);
          }
        }
        for (const fileName of chunk.dynamicImports) {
          const next = chunks.get(fileName);
          if (next && !skipDynamicImport(next)) {
            stack.push(next);
          }
        }
      }
      return reachable;
    };

    const lazyRoots = [...chunks.values()].filter(isLazyRoot);
    if (!lazyRoots.length) {
      this.warn(`no lazy-loaded chunk found for ${moduleRegex}`);
    }

    // anything also reachable without dynamically importing the lazy roots
    // (e.g. deps shared with the main bundle, or a lazy root that Rollup
    // merged into a statically imported chunk) must stay precached
    const reachableOtherwise = collectReachable(
      [...chunks.values()].filter((chunk) => chunk.isEntry),
      isLazyRoot,
    );

    for (const chunk of lazyRoots) {
      if (reachableOtherwise.has(chunk.fileName)) {
        this.warn(
          `${chunk.fileName} (matching ${moduleRegex}) is reachable without a dynamic import, so it's not lazy-loaded and stays precached`,
        );
      }
    }

    lazyChunkFileNames.clear();
    for (const fileName of collectReachable(lazyRoots, () => false)) {
      if (!reachableOtherwise.has(fileName)) {
        lazyChunkFileNames.add(fileName);
      }
    }

    if (listName) {
      this.emitFile({
        type: "asset",
        name: `${listName}.json`,
        source: JSON.stringify([...lazyChunkFileNames]),
      });
    }
  },
  // "post" handlers run in Vite's HTML plugin's `generateBundle`, after ours
  transformIndexHtml: {
    order: "post",
    handler: (_html, { bundle }) => {
      if (!listName) {
        return;
      }
      const list = Object.values(bundle ?? {}).find(
        (file) => file.type === "asset" && file.name === `${listName}.json`,
      );
      if (!list) {
        throw new Error(`${listName}.json wasn't emitted`);
      }
      return [
        {
          tag: "meta",
          attrs: { name: listName, content: list.fileName },
          injectTo: "head",
        },
      ];
    },
  },
});

export default defineConfig(({ mode }) => {
  // To load .env variables
  const envVars = loadEnv(mode, `../`);
  // mermaid (+ its many deps & per-diagram chunks) is lazy-loaded and large,
  // so we don't precache it (the app caches it once the TTD dialog is opened,
  // see `cacheMermaidChunks`). Populated at build time by `lazyChunksPlugin`.
  const mermaidChunkFileNames = new Set<string>();
  // https://vitejs.dev/config/
  return {
    server: {
      port: Number(envVars.VITE_APP_PORT || 3000),
      // open the browser
      open: true,
    },
    // We need to specify the envDir since now there are no
    //more located in parallel with the vite.config.ts file but in parent dir
    envDir: "../",
    resolve: {
      alias: [
        {
          find: /^@excalidraw\/common$/,
          replacement: path.resolve(
            __dirname,
            "../packages/common/src/index.ts",
          ),
        },
        {
          find: /^@excalidraw\/common\/(.*?)/,
          replacement: path.resolve(__dirname, "../packages/common/src/$1"),
        },
        {
          find: /^@excalidraw\/element$/,
          replacement: path.resolve(
            __dirname,
            "../packages/element/src/index.ts",
          ),
        },
        {
          find: /^@excalidraw\/element\/(.*?)/,
          replacement: path.resolve(__dirname, "../packages/element/src/$1"),
        },
        {
          find: /^@excalidraw\/excalidraw$/,
          replacement: path.resolve(
            __dirname,
            "../packages/excalidraw/index.tsx",
          ),
        },
        {
          find: /^@excalidraw\/excalidraw\/(.*?)/,
          replacement: path.resolve(__dirname, "../packages/excalidraw/$1"),
        },
        {
          find: /^@excalidraw\/math$/,
          replacement: path.resolve(__dirname, "../packages/math/src/index.ts"),
        },
        {
          find: /^@excalidraw\/math\/(.*?)/,
          replacement: path.resolve(__dirname, "../packages/math/src/$1"),
        },
        {
          find: /^@excalidraw\/utils$/,
          replacement: path.resolve(
            __dirname,
            "../packages/utils/src/index.ts",
          ),
        },
        {
          find: /^@excalidraw\/utils\/(.*?)/,
          replacement: path.resolve(__dirname, "../packages/utils/src/$1"),
        },
        {
          find: /^@excalidraw\/fractional-indexing$/,
          replacement: path.resolve(
            __dirname,
            "../packages/fractional-indexing/src/index.ts",
          ),
        },
        {
          find: /^@excalidraw\/laser-pointer$/,
          replacement: path.resolve(
            __dirname,
            "../packages/laser-pointer/src/index.ts",
          ),
        },
      ],
    },
    build: {
      outDir: "build",
      rollupOptions: {
        output: {
          assetFileNames(chunkInfo) {
            if (chunkInfo?.name?.endsWith(".woff2")) {
              const family = chunkInfo.name.split("-")[0];
              return `fonts/${family}/[name][extname]`;
            }

            return "assets/[name]-[hash][extname]";
          },
          // Creating separate chunk for locales except for en and percentages.json so they
          // can be cached at runtime and not merged with
          // app precache. en.json and percentages.json are needed for first load
          // or fallback hence not clubbing with locales so first load followed by offline mode works fine. This is how CRA used to work too.
          manualChunks(id) {
            // Bundler runtime helpers (dynamic import preloading, CJS interop)
            // would otherwise live in the main bundle, and every lazy chunk
            // importing them would get a new file name with each deploy. Tabs
            // still running the previous version would then fail to load
            // non-precached lazy chunks (e.g. mermaid) after a deploy.
            if (
              id === "\0vite/preload-helper.js" ||
              id === "\0commonjsHelpers.js"
            ) {
              return "bundler-helpers";
            }

            if (
              id.includes("packages/excalidraw/locales") &&
              id.match(/en.json|percentages.json/) === null
            ) {
              const index = id.indexOf("locales/");
              // Taking the substring after "locales/"
              return `locales/${id.substring(index + 8)}`;
            }

            if (id.includes("@codemirror/") || id.includes("@lezer/")) {
              return "codemirror.chunk";
            }
          },
        },
      },
      sourcemap: true,
      // don't auto-inline small assets (i.e. fonts hosted on CDN)
      assetsInlineLimit: 0,
    },
    plugins: [
      Sitemap({
        hostname: "https://excalidraw.com",
        outDir: "build",
        changefreq: "monthly",
        // its static in public folder
        generateRobotsTxt: false,
      }),
      woff2BrowserPlugin(),
      lazyChunksPlugin(
        /[\\/]node_modules[\\/]@excalidraw[\\/]mermaid-to-excalidraw[\\/]/,
        mermaidChunkFileNames,
        MERMAID_CHUNKS_LIST_NAME,
      ),
      react(),
      checker({
        typescript: true,
        eslint:
          envVars.VITE_APP_ENABLE_ESLINT === "false"
            ? undefined
            : { lintCommand: 'eslint "./**/*.{js,ts,tsx}"' },
        overlay: {
          initialIsOpen: envVars.VITE_APP_COLLAPSE_OVERLAY === "false",
          badgeStyle: "margin-bottom: 4rem; margin-left: 1rem",
        },
      }),
      svgrPlugin(),
      ViteEjsPlugin(),
      VitePWA({
        registerType: "autoUpdate",
        devOptions: {
          /* set this flag to true to enable in Development mode */
          enabled: envVars.VITE_APP_ENABLE_PWA === "true",
        },

        workbox: {
          // don't precache fonts, locales and separate chunks
          globIgnores: [
            "fonts.css",
            "**/locales/**",
            "service-worker.js",
            "**/*.chunk-*.js",
            // CodeMirrorEditor can't be assigned a `.chunk` name via
            // manualChunks because Rollup would hoist shared deps (React)
            // via a static import from the main bundle, defeating lazy
            // loading. So we exclude it by name instead.
            "**/CodeMirrorEditor-*.js",
            // lazy-loaded Firebase SDK, only needed for collab/sharing, which
            // require network anyway
            "**/firebaseSDK-*.js",
          ],
          // mermaid chunks are excluded here rather than via `globIgnores`
          // as their file names are arbitrary
          manifestTransforms: [
            (entries) => ({
              manifest: entries.filter(
                (entry) => !mermaidChunkFileNames.has(entry.url),
              ),
              warnings: [],
            }),
          ],
          runtimeCaching: [
            {
              urlPattern: new RegExp(".+.woff2"),
              handler: "CacheFirst",
              options: {
                cacheName: "fonts",
                expiration: {
                  maxEntries: 1000,
                  maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days
                },
                cacheableResponse: {
                  // 0 to cache "opaque" responses from cross-origin requests (i.e. CDN)
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: new RegExp("fonts.css"),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "fonts",
                expiration: {
                  maxEntries: 50,
                },
              },
            },
            {
              urlPattern: new RegExp("locales/[^/]+.js"),
              handler: "CacheFirst",
              options: {
                cacheName: "locales",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // <== 30 days
                },
              },
            },
            {
              urlPattern: new RegExp("(.chunk-.+|CodeMirrorEditor-.+)\\.js"),
              handler: "CacheFirst",
              options: {
                cacheName: "chunk",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 90, // <== 90 days
                },
              },
            },
            {
              urlPattern: new RegExp("/assets/[^/]+\\.js$"),
              handler: "CacheFirst",
              options: {
                cacheName: "lazy-chunks",
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 90, // <== 90 days
                },
              },
            },
          ],
          maximumFileSizeToCacheInBytes: 2.3 * 1024 ** 2, // 2.3MB
        },
        manifest: {
          short_name: "Excalidraw",
          name: "Excalidraw",
          description:
            "Excalidraw is a whiteboard tool that lets you easily sketch diagrams that have a hand-drawn feel to them.",
          icons: [
            {
              src: "android-chrome-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "apple-touch-icon.png",
              type: "image/png",
              sizes: "180x180",
            },
            {
              src: "favicon-32x32.png",
              sizes: "32x32",
              type: "image/png",
            },
            {
              src: "favicon-16x16.png",
              sizes: "16x16",
              type: "image/png",
            },
          ],
          start_url: "/",
          id: "excalidraw",
          display: "standalone",
          theme_color: "#121212",
          background_color: "#ffffff",
          file_handlers: [
            {
              action: "/",
              accept: {
                "application/vnd.excalidraw+json": [".excalidraw"],
              },
            },
          ],
          share_target: {
            action: "/web-share-target",
            method: "POST",
            enctype: "multipart/form-data",
            params: {
              files: [
                {
                  name: "file",
                  accept: [
                    "application/vnd.excalidraw+json",
                    "application/json",
                    ".excalidraw",
                  ],
                },
              ],
            },
          },
          screenshots: [
            {
              src: "/screenshots/virtual-whiteboard.png",
              type: "image/png",
              sizes: "462x945",
            },
            {
              src: "/screenshots/wireframe.png",
              type: "image/png",
              sizes: "462x945",
            },
            {
              src: "/screenshots/illustration.png",
              type: "image/png",
              sizes: "462x945",
            },
            {
              src: "/screenshots/shapes.png",
              type: "image/png",
              sizes: "462x945",
            },
            {
              src: "/screenshots/collaboration.png",
              type: "image/png",
              sizes: "462x945",
            },
            {
              src: "/screenshots/export.png",
              type: "image/png",
              sizes: "462x945",
            },
          ],
        },
      }),
      createHtmlPlugin({
        minify: true,
      }),
    ],
    publicDir: "../public",
  };
});
