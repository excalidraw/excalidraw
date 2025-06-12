var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../scripts/woff2/woff2-vite-plugins.js
var require_woff2_vite_plugins = __commonJS({
  "../scripts/woff2/woff2-vite-plugins.js"(exports, module) {
    "use strict";
    var OSS_FONTS_CDN = "https://excalidraw.nyc3.cdn.digitaloceanspaces.com/oss/";
    var OSS_FONTS_FALLBACK = "/";
    module.exports.woff2BrowserPlugin = () => {
      let isDev;
      return {
        name: "woff2BrowserPlugin",
        enforce: "pre",
        config(_, { command }) {
          isDev = command === "serve";
        },
        transform(code, id) {
          if (!isDev && id.endsWith("/excalidraw/fonts/fonts.css")) {
            return `/* WARN: The following content is generated during excalidraw-app build */

      @font-face {
        font-family: "Assistant";
        src: url(${OSS_FONTS_CDN}fonts/Assistant/Assistant-Regular.woff2)
            format("woff2"),
          url(./Assistant-Regular.woff2) format("woff2");
        font-weight: 400;
        style: normal;
        display: swap;
      }

      @font-face {
        font-family: "Assistant";
        src: url(${OSS_FONTS_CDN}fonts/Assistant/Assistant-Medium.woff2)
            format("woff2"),
          url(./Assistant-Medium.woff2) format("woff2");
        font-weight: 500;
        style: normal;
        display: swap;
      }

      @font-face {
        font-family: "Assistant";
        src: url(${OSS_FONTS_CDN}fonts/Assistant/Assistant-SemiBold.woff2)
            format("woff2"),
          url(./Assistant-SemiBold.woff2) format("woff2");
        font-weight: 600;
        style: normal;
        display: swap;
      }

      @font-face {
        font-family: "Assistant";
        src: url(${OSS_FONTS_CDN}fonts/Assistant/Assistant-Bold.woff2)
            format("woff2"),
          url(./Assistant-Bold.woff2) format("woff2");
        font-weight: 700;
        style: normal;
        display: swap;
      }`;
          }
          if (!isDev && id.endsWith("excalidraw-app/index.html")) {
            return code.replace(
              "<!-- PLACEHOLDER:EXCALIDRAW_APP_FONTS -->",
              `<script>
        // point into our CDN in prod, fallback to root (excalidraw.com) domain in case of issues
        window.EXCALIDRAW_ASSET_PATH = [
          "${OSS_FONTS_CDN}",
          "${OSS_FONTS_FALLBACK}",
        ];
      </script>

      <!-- Preload all default fonts to avoid swap on init -->
      <link
        rel="preload"
        href="${OSS_FONTS_CDN}fonts/Excalifont/Excalifont-Regular-a88b72a24fb54c9f94e3b5fdaa7481c9.woff2"
        as="font"
        type="font/woff2"
        crossorigin="anonymous"
      />
      <!-- For Nunito only preload the latin range, which should be good enough for now -->
      <link
        rel="preload"
        href="${OSS_FONTS_CDN}fonts/Nunito/Nunito-Regular-XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTQ3j6zbXWjgeg.woff2"
        as="font"
        type="font/woff2"
        crossorigin="anonymous"
      />
      <link
        rel="preload"
        href="${OSS_FONTS_CDN}fonts/ComicShanns/ComicShanns-Regular-279a7b317d12eb88de06167bd672b4b4.woff2"
        as="font"
        type="font/woff2"
        crossorigin="anonymous"
      />
    `
            );
          }
        }
      };
    };
  }
});

// vite.config.mts
var import_woff2_vite_plugins = __toESM(require_woff2_vite_plugins(), 1);
import path from "path";
import { defineConfig, loadEnv } from "file:///C:/Users/Administrator/Desktop/excalidraw/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Administrator/Desktop/excalidraw/node_modules/@vitejs/plugin-react/dist/index.mjs";
import svgrPlugin from "file:///C:/Users/Administrator/Desktop/excalidraw/node_modules/vite-plugin-svgr/dist/index.js";
import { ViteEjsPlugin } from "file:///C:/Users/Administrator/Desktop/excalidraw/node_modules/vite-plugin-ejs/index.js";
import { VitePWA } from "file:///C:/Users/Administrator/Desktop/excalidraw/node_modules/vite-plugin-pwa/dist/index.js";
import checker from "file:///C:/Users/Administrator/Desktop/excalidraw/node_modules/vite-plugin-checker/dist/esm/main.js";
import { createHtmlPlugin } from "file:///C:/Users/Administrator/Desktop/excalidraw/node_modules/vite-plugin-html/dist/index.mjs";
import Sitemap from "file:///C:/Users/Administrator/Desktop/excalidraw/node_modules/vite-plugin-sitemap/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\Administrator\\Desktop\\excalidraw\\excalidraw-app";
var vite_config_default = defineConfig(({ mode }) => {
  const envVars = loadEnv(mode, `../`);
  return {
    server: {
      port: Number(envVars.VITE_APP_PORT || 3e3),
      // open the browser
      open: true
    },
    // We need to specify the envDir since now there are no
    //more located in parallel with the vite.config.ts file but in parent dir
    envDir: "../",
    resolve: {
      alias: [
        {
          find: /^@excalidraw\/common$/,
          replacement: path.resolve(
            __vite_injected_original_dirname,
            "../packages/common/src/index.ts"
          )
        },
        {
          find: /^@excalidraw\/common\/(.*?)/,
          replacement: path.resolve(__vite_injected_original_dirname, "../packages/common/src/$1")
        },
        {
          find: /^@excalidraw\/element$/,
          replacement: path.resolve(
            __vite_injected_original_dirname,
            "../packages/element/src/index.ts"
          )
        },
        {
          find: /^@excalidraw\/element\/(.*?)/,
          replacement: path.resolve(__vite_injected_original_dirname, "../packages/element/src/$1")
        },
        {
          find: /^@excalidraw\/excalidraw$/,
          replacement: path.resolve(
            __vite_injected_original_dirname,
            "../packages/excalidraw/index.tsx"
          )
        },
        {
          find: /^@excalidraw\/excalidraw\/(.*?)/,
          replacement: path.resolve(__vite_injected_original_dirname, "../packages/excalidraw/$1")
        },
        {
          find: /^@excalidraw\/math$/,
          replacement: path.resolve(__vite_injected_original_dirname, "../packages/math/src/index.ts")
        },
        {
          find: /^@excalidraw\/math\/(.*?)/,
          replacement: path.resolve(__vite_injected_original_dirname, "../packages/math/src/$1")
        },
        {
          find: /^@excalidraw\/utils$/,
          replacement: path.resolve(
            __vite_injected_original_dirname,
            "../packages/utils/src/index.ts"
          )
        },
        {
          find: /^@excalidraw\/utils\/(.*?)/,
          replacement: path.resolve(__vite_injected_original_dirname, "../packages/utils/src/$1")
        }
      ]
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
            if (id.includes("packages/excalidraw/locales") && id.match(/en.json|percentages.json/) === null) {
              const index = id.indexOf("locales/");
              return `locales/${id.substring(index + 8)}`;
            }
          }
        }
      },
      sourcemap: true,
      // don't auto-inline small assets (i.e. fonts hosted on CDN)
      assetsInlineLimit: 0
    },
    plugins: [
      Sitemap({
        hostname: "https://excalidraw.com",
        outDir: "build",
        changefreq: "monthly",
        // its static in public folder
        generateRobotsTxt: false
      }),
      (0, import_woff2_vite_plugins.woff2BrowserPlugin)(),
      react(),
      checker({
        typescript: true,
        eslint: envVars.VITE_APP_ENABLE_ESLINT === "false" ? void 0 : { lintCommand: 'eslint "./**/*.{js,ts,tsx}"' },
        overlay: {
          initialIsOpen: envVars.VITE_APP_COLLAPSE_OVERLAY === "false",
          badgeStyle: "margin-bottom: 4rem; margin-left: 1rem"
        }
      }),
      svgrPlugin(),
      ViteEjsPlugin(),
      VitePWA({
        registerType: "autoUpdate",
        devOptions: {
          /* set this flag to true to enable in Development mode */
          enabled: envVars.VITE_APP_ENABLE_PWA === "true"
        },
        workbox: {
          // don't precache fonts, locales and separate chunks
          globIgnores: [
            "fonts.css",
            "**/locales/**",
            "service-worker.js",
            "**/*.chunk-*.js"
          ],
          runtimeCaching: [
            {
              urlPattern: new RegExp(".+.woff2"),
              handler: "CacheFirst",
              options: {
                cacheName: "fonts",
                expiration: {
                  maxEntries: 1e3,
                  maxAgeSeconds: 60 * 60 * 24 * 90
                  // 90 days
                },
                cacheableResponse: {
                  // 0 to cache "opaque" responses from cross-origin requests (i.e. CDN)
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: new RegExp("fonts.css"),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "fonts",
                expiration: {
                  maxEntries: 50
                }
              }
            },
            {
              urlPattern: new RegExp("locales/[^/]+.js"),
              handler: "CacheFirst",
              options: {
                cacheName: "locales",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                  // <== 30 days
                }
              }
            },
            {
              urlPattern: new RegExp(".chunk-.+.js"),
              handler: "CacheFirst",
              options: {
                cacheName: "chunk",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 90
                  // <== 90 days
                }
              }
            }
          ]
        },
        manifest: {
          short_name: "Todo.Png",
          name: "Todo.Png",
          description: "Todo.Png is a whiteboard tool that lets you easily sketch diagrams that have a hand-drawn feel to them.",
          icons: [
            {
              src: "android-chrome-192x192.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "apple-touch-icon.png",
              type: "image/png",
              sizes: "180x180"
            },
            {
              src: "favicon-32x32.png",
              sizes: "32x32",
              type: "image/png"
            },
            {
              src: "favicon-16x16.png",
              sizes: "16x16",
              type: "image/png"
            }
          ],
          start_url: "/",
          id: "Todo.Png",
          display: "standalone",
          theme_color: "#121212",
          background_color: "#ffffff",
          file_handlers: [
            {
              action: "/",
              accept: {
                "application/vnd.excalidraw+json": [".excalidraw"]
              }
            }
          ]
        }
      }),
      createHtmlPlugin({
        minify: true
      })
    ],
    publicDir: "../public"
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc2NyaXB0cy93b2ZmMi93b2ZmMi12aXRlLXBsdWdpbnMuanMiLCAidml0ZS5jb25maWcubXRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQWRtaW5pc3RyYXRvclxcXFxEZXNrdG9wXFxcXGV4Y2FsaWRyYXdcXFxcc2NyaXB0c1xcXFx3b2ZmMlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQWRtaW5pc3RyYXRvclxcXFxEZXNrdG9wXFxcXGV4Y2FsaWRyYXdcXFxcc2NyaXB0c1xcXFx3b2ZmMlxcXFx3b2ZmMi12aXRlLXBsdWdpbnMuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL0FkbWluaXN0cmF0b3IvRGVza3RvcC9leGNhbGlkcmF3L3NjcmlwdHMvd29mZjIvd29mZjItdml0ZS1wbHVnaW5zLmpzXCI7Ly8gZGVmaW5lIGBFWENBTElEUkFXX0FTU0VUX1BBVEhgIGFzIGEgU1NPVFxuY29uc3QgT1NTX0ZPTlRTX0NETiA9IFwiaHR0cHM6Ly9leGNhbGlkcmF3Lm55YzMuY2RuLmRpZ2l0YWxvY2VhbnNwYWNlcy5jb20vb3NzL1wiO1xuY29uc3QgT1NTX0ZPTlRTX0ZBTExCQUNLID0gXCIvXCI7XG5cbi8qKlxuICogQ3VzdG9tIHZpdGUgcGx1Z2luIGZvciBhdXRvLXByZWZpeGluZyBgRVhDQUxJRFJBV19BU1NFVF9QQVRIYCB3b2ZmMiBmb250cyBpbiBgZXhjYWxpZHJhdy1hcHBgLlxuICpcbiAqIEByZXR1cm5zIHtpbXBvcnQoXCJ2aXRlXCIpLlBsdWdpbk9wdGlvbn1cbiAqL1xubW9kdWxlLmV4cG9ydHMud29mZjJCcm93c2VyUGx1Z2luID0gKCkgPT4ge1xuICBsZXQgaXNEZXY7XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBcIndvZmYyQnJvd3NlclBsdWdpblwiLFxuICAgIGVuZm9yY2U6IFwicHJlXCIsXG4gICAgY29uZmlnKF8sIHsgY29tbWFuZCB9KSB7XG4gICAgICBpc0RldiA9IGNvbW1hbmQgPT09IFwic2VydmVcIjtcbiAgICB9LFxuICAgIHRyYW5zZm9ybShjb2RlLCBpZCkge1xuICAgICAgLy8gdXNpbmcgY29weSAvIHJlcGxhY2UgYXMgZm9udHMgZGVmaW5lZCBpbiB0aGUgYC5jc3NgIGRvbid0IGhhdmUgdG8gYmUgbWFudWFsbHkgY29waWVkIG92ZXIgKHZpdGUvcm9sbHVwIGRvZXMgdGhpcyBhdXRvbWF0aWNhbGx5KSxcbiAgICAgIC8vIGJ1dCBhdCB0aGUgc2FtZSB0aW1lIGNhbid0IGJlIGVhc2lseSBwcmVmaXhlZCB3aXRoIHRoZSBgRVhDQUxJRFJBV19BU1NFVF9QQVRIYCBvbmx5IGZvciB0aGUgYGV4Y2FsaWRyYXctYXBwYFxuICAgICAgaWYgKCFpc0RldiAmJiBpZC5lbmRzV2l0aChcIi9leGNhbGlkcmF3L2ZvbnRzL2ZvbnRzLmNzc1wiKSkge1xuICAgICAgICByZXR1cm4gYC8qIFdBUk46IFRoZSBmb2xsb3dpbmcgY29udGVudCBpcyBnZW5lcmF0ZWQgZHVyaW5nIGV4Y2FsaWRyYXctYXBwIGJ1aWxkICovXG5cbiAgICAgIEBmb250LWZhY2Uge1xuICAgICAgICBmb250LWZhbWlseTogXCJBc3Npc3RhbnRcIjtcbiAgICAgICAgc3JjOiB1cmwoJHtPU1NfRk9OVFNfQ0ROfWZvbnRzL0Fzc2lzdGFudC9Bc3Npc3RhbnQtUmVndWxhci53b2ZmMilcbiAgICAgICAgICAgIGZvcm1hdChcIndvZmYyXCIpLFxuICAgICAgICAgIHVybCguL0Fzc2lzdGFudC1SZWd1bGFyLndvZmYyKSBmb3JtYXQoXCJ3b2ZmMlwiKTtcbiAgICAgICAgZm9udC13ZWlnaHQ6IDQwMDtcbiAgICAgICAgc3R5bGU6IG5vcm1hbDtcbiAgICAgICAgZGlzcGxheTogc3dhcDtcbiAgICAgIH1cblxuICAgICAgQGZvbnQtZmFjZSB7XG4gICAgICAgIGZvbnQtZmFtaWx5OiBcIkFzc2lzdGFudFwiO1xuICAgICAgICBzcmM6IHVybCgke09TU19GT05UU19DRE59Zm9udHMvQXNzaXN0YW50L0Fzc2lzdGFudC1NZWRpdW0ud29mZjIpXG4gICAgICAgICAgICBmb3JtYXQoXCJ3b2ZmMlwiKSxcbiAgICAgICAgICB1cmwoLi9Bc3Npc3RhbnQtTWVkaXVtLndvZmYyKSBmb3JtYXQoXCJ3b2ZmMlwiKTtcbiAgICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICAgICAgc3R5bGU6IG5vcm1hbDtcbiAgICAgICAgZGlzcGxheTogc3dhcDtcbiAgICAgIH1cblxuICAgICAgQGZvbnQtZmFjZSB7XG4gICAgICAgIGZvbnQtZmFtaWx5OiBcIkFzc2lzdGFudFwiO1xuICAgICAgICBzcmM6IHVybCgke09TU19GT05UU19DRE59Zm9udHMvQXNzaXN0YW50L0Fzc2lzdGFudC1TZW1pQm9sZC53b2ZmMilcbiAgICAgICAgICAgIGZvcm1hdChcIndvZmYyXCIpLFxuICAgICAgICAgIHVybCguL0Fzc2lzdGFudC1TZW1pQm9sZC53b2ZmMikgZm9ybWF0KFwid29mZjJcIik7XG4gICAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XG4gICAgICAgIHN0eWxlOiBub3JtYWw7XG4gICAgICAgIGRpc3BsYXk6IHN3YXA7XG4gICAgICB9XG5cbiAgICAgIEBmb250LWZhY2Uge1xuICAgICAgICBmb250LWZhbWlseTogXCJBc3Npc3RhbnRcIjtcbiAgICAgICAgc3JjOiB1cmwoJHtPU1NfRk9OVFNfQ0ROfWZvbnRzL0Fzc2lzdGFudC9Bc3Npc3RhbnQtQm9sZC53b2ZmMilcbiAgICAgICAgICAgIGZvcm1hdChcIndvZmYyXCIpLFxuICAgICAgICAgIHVybCguL0Fzc2lzdGFudC1Cb2xkLndvZmYyKSBmb3JtYXQoXCJ3b2ZmMlwiKTtcbiAgICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgICAgc3R5bGU6IG5vcm1hbDtcbiAgICAgICAgZGlzcGxheTogc3dhcDtcbiAgICAgIH1gO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWlzRGV2ICYmIGlkLmVuZHNXaXRoKFwiZXhjYWxpZHJhdy1hcHAvaW5kZXguaHRtbFwiKSkge1xuICAgICAgICByZXR1cm4gY29kZS5yZXBsYWNlKFxuICAgICAgICAgIFwiPCEtLSBQTEFDRUhPTERFUjpFWENBTElEUkFXX0FQUF9GT05UUyAtLT5cIixcbiAgICAgICAgICBgPHNjcmlwdD5cbiAgICAgICAgLy8gcG9pbnQgaW50byBvdXIgQ0ROIGluIHByb2QsIGZhbGxiYWNrIHRvIHJvb3QgKGV4Y2FsaWRyYXcuY29tKSBkb21haW4gaW4gY2FzZSBvZiBpc3N1ZXNcbiAgICAgICAgd2luZG93LkVYQ0FMSURSQVdfQVNTRVRfUEFUSCA9IFtcbiAgICAgICAgICBcIiR7T1NTX0ZPTlRTX0NETn1cIixcbiAgICAgICAgICBcIiR7T1NTX0ZPTlRTX0ZBTExCQUNLfVwiLFxuICAgICAgICBdO1xuICAgICAgPC9zY3JpcHQ+XG5cbiAgICAgIDwhLS0gUHJlbG9hZCBhbGwgZGVmYXVsdCBmb250cyB0byBhdm9pZCBzd2FwIG9uIGluaXQgLS0+XG4gICAgICA8bGlua1xuICAgICAgICByZWw9XCJwcmVsb2FkXCJcbiAgICAgICAgaHJlZj1cIiR7T1NTX0ZPTlRTX0NETn1mb250cy9FeGNhbGlmb250L0V4Y2FsaWZvbnQtUmVndWxhci1hODhiNzJhMjRmYjU0YzlmOTRlM2I1ZmRhYTc0ODFjOS53b2ZmMlwiXG4gICAgICAgIGFzPVwiZm9udFwiXG4gICAgICAgIHR5cGU9XCJmb250L3dvZmYyXCJcbiAgICAgICAgY3Jvc3NvcmlnaW49XCJhbm9ueW1vdXNcIlxuICAgICAgLz5cbiAgICAgIDwhLS0gRm9yIE51bml0byBvbmx5IHByZWxvYWQgdGhlIGxhdGluIHJhbmdlLCB3aGljaCBzaG91bGQgYmUgZ29vZCBlbm91Z2ggZm9yIG5vdyAtLT5cbiAgICAgIDxsaW5rXG4gICAgICAgIHJlbD1cInByZWxvYWRcIlxuICAgICAgICBocmVmPVwiJHtPU1NfRk9OVFNfQ0ROfWZvbnRzL051bml0by9OdW5pdG8tUmVndWxhci1YUlhJM0k2TGkwMUJLb2ZpT2M1d3RsWjJkaThIRElraGRUUTNqNnpiWFdqZ2VnLndvZmYyXCJcbiAgICAgICAgYXM9XCJmb250XCJcbiAgICAgICAgdHlwZT1cImZvbnQvd29mZjJcIlxuICAgICAgICBjcm9zc29yaWdpbj1cImFub255bW91c1wiXG4gICAgICAvPlxuICAgICAgPGxpbmtcbiAgICAgICAgcmVsPVwicHJlbG9hZFwiXG4gICAgICAgIGhyZWY9XCIke09TU19GT05UU19DRE59Zm9udHMvQ29taWNTaGFubnMvQ29taWNTaGFubnMtUmVndWxhci0yNzlhN2IzMTdkMTJlYjg4ZGUwNjE2N2JkNjcyYjRiNC53b2ZmMlwiXG4gICAgICAgIGFzPVwiZm9udFwiXG4gICAgICAgIHR5cGU9XCJmb250L3dvZmYyXCJcbiAgICAgICAgY3Jvc3NvcmlnaW49XCJhbm9ueW1vdXNcIlxuICAgICAgLz5cbiAgICBgLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0sXG4gIH07XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxBZG1pbmlzdHJhdG9yXFxcXERlc2t0b3BcXFxcZXhjYWxpZHJhd1xcXFxleGNhbGlkcmF3LWFwcFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQWRtaW5pc3RyYXRvclxcXFxEZXNrdG9wXFxcXGV4Y2FsaWRyYXdcXFxcZXhjYWxpZHJhdy1hcHBcXFxcdml0ZS5jb25maWcubXRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9BZG1pbmlzdHJhdG9yL0Rlc2t0b3AvZXhjYWxpZHJhdy9leGNhbGlkcmF3LWFwcC92aXRlLmNvbmZpZy5tdHNcIjtpbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcbmltcG9ydCBzdmdyUGx1Z2luIGZyb20gXCJ2aXRlLXBsdWdpbi1zdmdyXCI7XG5pbXBvcnQgeyBWaXRlRWpzUGx1Z2luIH0gZnJvbSBcInZpdGUtcGx1Z2luLWVqc1wiO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcbmltcG9ydCBjaGVja2VyIGZyb20gXCJ2aXRlLXBsdWdpbi1jaGVja2VyXCI7XG5pbXBvcnQgeyBjcmVhdGVIdG1sUGx1Z2luIH0gZnJvbSBcInZpdGUtcGx1Z2luLWh0bWxcIjtcbmltcG9ydCBTaXRlbWFwIGZyb20gXCJ2aXRlLXBsdWdpbi1zaXRlbWFwXCI7XG5pbXBvcnQgeyB3b2ZmMkJyb3dzZXJQbHVnaW4gfSBmcm9tIFwiLi4vc2NyaXB0cy93b2ZmMi93b2ZmMi12aXRlLXBsdWdpbnNcIjtcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgLy8gVG8gbG9hZCAuZW52IHZhcmlhYmxlc1xuICBjb25zdCBlbnZWYXJzID0gbG9hZEVudihtb2RlLCBgLi4vYCk7XG4gIC8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG4gIHJldHVybiB7XG4gICAgc2VydmVyOiB7XG4gICAgICBwb3J0OiBOdW1iZXIoZW52VmFycy5WSVRFX0FQUF9QT1JUIHx8IDMwMDApLFxuICAgICAgLy8gb3BlbiB0aGUgYnJvd3NlclxuICAgICAgb3BlbjogdHJ1ZSxcbiAgICB9LFxuICAgIC8vIFdlIG5lZWQgdG8gc3BlY2lmeSB0aGUgZW52RGlyIHNpbmNlIG5vdyB0aGVyZSBhcmUgbm9cbiAgICAvL21vcmUgbG9jYXRlZCBpbiBwYXJhbGxlbCB3aXRoIHRoZSB2aXRlLmNvbmZpZy50cyBmaWxlIGJ1dCBpbiBwYXJlbnQgZGlyXG4gICAgZW52RGlyOiBcIi4uL1wiLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGFsaWFzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBmaW5kOiAvXkBleGNhbGlkcmF3XFwvY29tbW9uJC8sXG4gICAgICAgICAgcmVwbGFjZW1lbnQ6IHBhdGgucmVzb2x2ZShcbiAgICAgICAgICAgIF9fZGlybmFtZSxcbiAgICAgICAgICAgIFwiLi4vcGFja2FnZXMvY29tbW9uL3NyYy9pbmRleC50c1wiLFxuICAgICAgICAgICksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBmaW5kOiAvXkBleGNhbGlkcmF3XFwvY29tbW9uXFwvKC4qPykvLFxuICAgICAgICAgIHJlcGxhY2VtZW50OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4uL3BhY2thZ2VzL2NvbW1vbi9zcmMvJDFcIiksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBmaW5kOiAvXkBleGNhbGlkcmF3XFwvZWxlbWVudCQvLFxuICAgICAgICAgIHJlcGxhY2VtZW50OiBwYXRoLnJlc29sdmUoXG4gICAgICAgICAgICBfX2Rpcm5hbWUsXG4gICAgICAgICAgICBcIi4uL3BhY2thZ2VzL2VsZW1lbnQvc3JjL2luZGV4LnRzXCIsXG4gICAgICAgICAgKSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGZpbmQ6IC9eQGV4Y2FsaWRyYXdcXC9lbGVtZW50XFwvKC4qPykvLFxuICAgICAgICAgIHJlcGxhY2VtZW50OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4uL3BhY2thZ2VzL2VsZW1lbnQvc3JjLyQxXCIpLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgZmluZDogL15AZXhjYWxpZHJhd1xcL2V4Y2FsaWRyYXckLyxcbiAgICAgICAgICByZXBsYWNlbWVudDogcGF0aC5yZXNvbHZlKFxuICAgICAgICAgICAgX19kaXJuYW1lLFxuICAgICAgICAgICAgXCIuLi9wYWNrYWdlcy9leGNhbGlkcmF3L2luZGV4LnRzeFwiLFxuICAgICAgICAgICksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBmaW5kOiAvXkBleGNhbGlkcmF3XFwvZXhjYWxpZHJhd1xcLyguKj8pLyxcbiAgICAgICAgICByZXBsYWNlbWVudDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuLi9wYWNrYWdlcy9leGNhbGlkcmF3LyQxXCIpLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgZmluZDogL15AZXhjYWxpZHJhd1xcL21hdGgkLyxcbiAgICAgICAgICByZXBsYWNlbWVudDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuLi9wYWNrYWdlcy9tYXRoL3NyYy9pbmRleC50c1wiKSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGZpbmQ6IC9eQGV4Y2FsaWRyYXdcXC9tYXRoXFwvKC4qPykvLFxuICAgICAgICAgIHJlcGxhY2VtZW50OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4uL3BhY2thZ2VzL21hdGgvc3JjLyQxXCIpLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgZmluZDogL15AZXhjYWxpZHJhd1xcL3V0aWxzJC8sXG4gICAgICAgICAgcmVwbGFjZW1lbnQ6IHBhdGgucmVzb2x2ZShcbiAgICAgICAgICAgIF9fZGlybmFtZSxcbiAgICAgICAgICAgIFwiLi4vcGFja2FnZXMvdXRpbHMvc3JjL2luZGV4LnRzXCIsXG4gICAgICAgICAgKSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGZpbmQ6IC9eQGV4Y2FsaWRyYXdcXC91dGlsc1xcLyguKj8pLyxcbiAgICAgICAgICByZXBsYWNlbWVudDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuLi9wYWNrYWdlcy91dGlscy9zcmMvJDFcIiksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gICAgYnVpbGQ6IHtcbiAgICAgIG91dERpcjogXCJidWlsZFwiLFxuICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICBvdXRwdXQ6IHtcbiAgICAgICAgICBhc3NldEZpbGVOYW1lcyhjaHVua0luZm8pIHtcbiAgICAgICAgICAgIGlmIChjaHVua0luZm8/Lm5hbWU/LmVuZHNXaXRoKFwiLndvZmYyXCIpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGZhbWlseSA9IGNodW5rSW5mby5uYW1lLnNwbGl0KFwiLVwiKVswXTtcbiAgICAgICAgICAgICAgcmV0dXJuIGBmb250cy8ke2ZhbWlseX0vW25hbWVdW2V4dG5hbWVdYDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIFwiYXNzZXRzL1tuYW1lXS1baGFzaF1bZXh0bmFtZV1cIjtcbiAgICAgICAgICB9LFxuICAgICAgICAgIC8vIENyZWF0aW5nIHNlcGFyYXRlIGNodW5rIGZvciBsb2NhbGVzIGV4Y2VwdCBmb3IgZW4gYW5kIHBlcmNlbnRhZ2VzLmpzb24gc28gdGhleVxuICAgICAgICAgIC8vIGNhbiBiZSBjYWNoZWQgYXQgcnVudGltZSBhbmQgbm90IG1lcmdlZCB3aXRoXG4gICAgICAgICAgLy8gYXBwIHByZWNhY2hlLiBlbi5qc29uIGFuZCBwZXJjZW50YWdlcy5qc29uIGFyZSBuZWVkZWQgZm9yIGZpcnN0IGxvYWRcbiAgICAgICAgICAvLyBvciBmYWxsYmFjayBoZW5jZSBub3QgY2x1YmJpbmcgd2l0aCBsb2NhbGVzIHNvIGZpcnN0IGxvYWQgZm9sbG93ZWQgYnkgb2ZmbGluZSBtb2RlIHdvcmtzIGZpbmUuIFRoaXMgaXMgaG93IENSQSB1c2VkIHRvIHdvcmsgdG9vLlxuICAgICAgICAgIG1hbnVhbENodW5rcyhpZCkge1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcyhcInBhY2thZ2VzL2V4Y2FsaWRyYXcvbG9jYWxlc1wiKSAmJlxuICAgICAgICAgICAgICBpZC5tYXRjaCgvZW4uanNvbnxwZXJjZW50YWdlcy5qc29uLykgPT09IG51bGxcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IGlkLmluZGV4T2YoXCJsb2NhbGVzL1wiKTtcbiAgICAgICAgICAgICAgLy8gVGFraW5nIHRoZSBzdWJzdHJpbmcgYWZ0ZXIgXCJsb2NhbGVzL1wiXG4gICAgICAgICAgICAgIHJldHVybiBgbG9jYWxlcy8ke2lkLnN1YnN0cmluZyhpbmRleCArIDgpfWA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgICAvLyBkb24ndCBhdXRvLWlubGluZSBzbWFsbCBhc3NldHMgKGkuZS4gZm9udHMgaG9zdGVkIG9uIENETilcbiAgICAgIGFzc2V0c0lubGluZUxpbWl0OiAwLFxuICAgIH0sXG4gICAgcGx1Z2luczogW1xuICAgICAgU2l0ZW1hcCh7XG4gICAgICAgIGhvc3RuYW1lOiBcImh0dHBzOi8vZXhjYWxpZHJhdy5jb21cIixcbiAgICAgICAgb3V0RGlyOiBcImJ1aWxkXCIsXG4gICAgICAgIGNoYW5nZWZyZXE6IFwibW9udGhseVwiLFxuICAgICAgICAvLyBpdHMgc3RhdGljIGluIHB1YmxpYyBmb2xkZXJcbiAgICAgICAgZ2VuZXJhdGVSb2JvdHNUeHQ6IGZhbHNlLFxuICAgICAgfSksXG4gICAgICB3b2ZmMkJyb3dzZXJQbHVnaW4oKSxcbiAgICAgIHJlYWN0KCksXG4gICAgICBjaGVja2VyKHtcbiAgICAgICAgdHlwZXNjcmlwdDogdHJ1ZSxcbiAgICAgICAgZXNsaW50OlxuICAgICAgICAgIGVudlZhcnMuVklURV9BUFBfRU5BQkxFX0VTTElOVCA9PT0gXCJmYWxzZVwiXG4gICAgICAgICAgICA/IHVuZGVmaW5lZFxuICAgICAgICAgICAgOiB7IGxpbnRDb21tYW5kOiAnZXNsaW50IFwiLi8qKi8qLntqcyx0cyx0c3h9XCInIH0sXG4gICAgICAgIG92ZXJsYXk6IHtcbiAgICAgICAgICBpbml0aWFsSXNPcGVuOiBlbnZWYXJzLlZJVEVfQVBQX0NPTExBUFNFX09WRVJMQVkgPT09IFwiZmFsc2VcIixcbiAgICAgICAgICBiYWRnZVN0eWxlOiBcIm1hcmdpbi1ib3R0b206IDRyZW07IG1hcmdpbi1sZWZ0OiAxcmVtXCIsXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIHN2Z3JQbHVnaW4oKSxcbiAgICAgIFZpdGVFanNQbHVnaW4oKSxcbiAgICAgIFZpdGVQV0Eoe1xuICAgICAgICByZWdpc3RlclR5cGU6IFwiYXV0b1VwZGF0ZVwiLFxuICAgICAgICBkZXZPcHRpb25zOiB7XG4gICAgICAgICAgLyogc2V0IHRoaXMgZmxhZyB0byB0cnVlIHRvIGVuYWJsZSBpbiBEZXZlbG9wbWVudCBtb2RlICovXG4gICAgICAgICAgZW5hYmxlZDogZW52VmFycy5WSVRFX0FQUF9FTkFCTEVfUFdBID09PSBcInRydWVcIixcbiAgICAgICAgfSxcblxuICAgICAgICB3b3JrYm94OiB7XG4gICAgICAgICAgLy8gZG9uJ3QgcHJlY2FjaGUgZm9udHMsIGxvY2FsZXMgYW5kIHNlcGFyYXRlIGNodW5rc1xuICAgICAgICAgIGdsb2JJZ25vcmVzOiBbXG4gICAgICAgICAgICBcImZvbnRzLmNzc1wiLFxuICAgICAgICAgICAgXCIqKi9sb2NhbGVzLyoqXCIsXG4gICAgICAgICAgICBcInNlcnZpY2Utd29ya2VyLmpzXCIsXG4gICAgICAgICAgICBcIioqLyouY2h1bmstKi5qc1wiLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcnVudGltZUNhY2hpbmc6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdXJsUGF0dGVybjogbmV3IFJlZ0V4cChcIi4rLndvZmYyXCIpLFxuICAgICAgICAgICAgICBoYW5kbGVyOiBcIkNhY2hlRmlyc3RcIixcbiAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICAgIGNhY2hlTmFtZTogXCJmb250c1wiLFxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcbiAgICAgICAgICAgICAgICAgIG1heEVudHJpZXM6IDEwMDAsXG4gICAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiA5MCwgLy8gOTAgZGF5c1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHtcbiAgICAgICAgICAgICAgICAgIC8vIDAgdG8gY2FjaGUgXCJvcGFxdWVcIiByZXNwb25zZXMgZnJvbSBjcm9zcy1vcmlnaW4gcmVxdWVzdHMgKGkuZS4gQ0ROKVxuICAgICAgICAgICAgICAgICAgc3RhdHVzZXM6IFswLCAyMDBdLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB1cmxQYXR0ZXJuOiBuZXcgUmVnRXhwKFwiZm9udHMuY3NzXCIpLFxuICAgICAgICAgICAgICBoYW5kbGVyOiBcIlN0YWxlV2hpbGVSZXZhbGlkYXRlXCIsXG4gICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICBjYWNoZU5hbWU6IFwiZm9udHNcIixcbiAgICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiA1MCxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdXJsUGF0dGVybjogbmV3IFJlZ0V4cChcImxvY2FsZXMvW14vXSsuanNcIiksXG4gICAgICAgICAgICAgIGhhbmRsZXI6IFwiQ2FjaGVGaXJzdFwiLFxuICAgICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgY2FjaGVOYW1lOiBcImxvY2FsZXNcIixcbiAgICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiA1MCxcbiAgICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDMwLCAvLyA8PT0gMzAgZGF5c1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB1cmxQYXR0ZXJuOiBuZXcgUmVnRXhwKFwiLmNodW5rLS4rLmpzXCIpLFxuICAgICAgICAgICAgICBoYW5kbGVyOiBcIkNhY2hlRmlyc3RcIixcbiAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICAgIGNhY2hlTmFtZTogXCJjaHVua1wiLFxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcbiAgICAgICAgICAgICAgICAgIG1heEVudHJpZXM6IDUwLFxuICAgICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogOTAsIC8vIDw9PSA5MCBkYXlzXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgICBzaG9ydF9uYW1lOiBcIlRvZG8uUG5nXCIsXG4gICAgICAgICAgbmFtZTogXCJUb2RvLlBuZ1wiLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOlxuICAgICAgICAgICAgXCJUb2RvLlBuZyBpcyBhIHdoaXRlYm9hcmQgdG9vbCB0aGF0IGxldHMgeW91IGVhc2lseSBza2V0Y2ggZGlhZ3JhbXMgdGhhdCBoYXZlIGEgaGFuZC1kcmF3biBmZWVsIHRvIHRoZW0uXCIsXG4gICAgICAgICAgaWNvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3JjOiBcImFuZHJvaWQtY2hyb21lLTE5MngxOTIucG5nXCIsXG4gICAgICAgICAgICAgIHNpemVzOiBcIjE5MngxOTJcIixcbiAgICAgICAgICAgICAgdHlwZTogXCJpbWFnZS9wbmdcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHNyYzogXCJhcHBsZS10b3VjaC1pY29uLnBuZ1wiLFxuICAgICAgICAgICAgICB0eXBlOiBcImltYWdlL3BuZ1wiLFxuICAgICAgICAgICAgICBzaXplczogXCIxODB4MTgwXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzcmM6IFwiZmF2aWNvbi0zMngzMi5wbmdcIixcbiAgICAgICAgICAgICAgc2l6ZXM6IFwiMzJ4MzJcIixcbiAgICAgICAgICAgICAgdHlwZTogXCJpbWFnZS9wbmdcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHNyYzogXCJmYXZpY29uLTE2eDE2LnBuZ1wiLFxuICAgICAgICAgICAgICBzaXplczogXCIxNngxNlwiLFxuICAgICAgICAgICAgICB0eXBlOiBcImltYWdlL3BuZ1wiLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHN0YXJ0X3VybDogXCIvXCIsXG4gICAgICAgICAgaWQ6IFwiVG9kby5QbmdcIixcbiAgICAgICAgICBkaXNwbGF5OiBcInN0YW5kYWxvbmVcIixcbiAgICAgICAgICB0aGVtZV9jb2xvcjogXCIjMTIxMjEyXCIsXG4gICAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogXCIjZmZmZmZmXCIsXG4gICAgICAgICAgZmlsZV9oYW5kbGVyczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBhY3Rpb246IFwiL1wiLFxuICAgICAgICAgICAgICBhY2NlcHQ6IHtcbiAgICAgICAgICAgICAgICBcImFwcGxpY2F0aW9uL3ZuZC5leGNhbGlkcmF3K2pzb25cIjogW1wiLmV4Y2FsaWRyYXdcIl0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIGNyZWF0ZUh0bWxQbHVnaW4oe1xuICAgICAgICBtaW5pZnk6IHRydWUsXG4gICAgICB9KSxcbiAgICBdLFxuICAgIHB1YmxpY0RpcjogXCIuLi9wdWJsaWNcIixcbiAgfTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQ0EsUUFBTSxnQkFBZ0I7QUFDdEIsUUFBTSxxQkFBcUI7QUFPM0IsV0FBTyxRQUFRLHFCQUFxQixNQUFNO0FBQ3hDLFVBQUk7QUFFSixhQUFPO0FBQUEsUUFDTCxNQUFNO0FBQUEsUUFDTixTQUFTO0FBQUEsUUFDVCxPQUFPLEdBQUcsRUFBRSxRQUFRLEdBQUc7QUFDckIsa0JBQVEsWUFBWTtBQUFBLFFBQ3RCO0FBQUEsUUFDQSxVQUFVLE1BQU0sSUFBSTtBQUdsQixjQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsNkJBQTZCLEdBQUc7QUFDeEQsbUJBQU87QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFJSSxhQUFhO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBVWIsYUFBYTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQVViLGFBQWE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFVYixhQUFhO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsVUFPMUI7QUFFQSxjQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsMkJBQTJCLEdBQUc7QUFDdEQsbUJBQU8sS0FBSztBQUFBLGNBQ1Y7QUFBQSxjQUNBO0FBQUE7QUFBQTtBQUFBLGFBR0csYUFBYTtBQUFBLGFBQ2Isa0JBQWtCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZ0JBT2YsYUFBYTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZ0JBUWIsYUFBYTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7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
