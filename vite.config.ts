import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgrPlugin from "vite-plugin-svgr";
import { ViteEjsPlugin } from "vite-plugin-ejs";
import { VitePWA } from "vite-plugin-pwa";
import checker from "vite-plugin-checker";

// To load .env.local variables
const envVars = loadEnv("", process.cwd());

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: Number(envVars.VITE_APP_PORT || 3000),
    // open the browser
    open: true,
  },
  build: {
    outDir: "build",
    rollupOptions: {
      output: {
        // Creating separate chunk for locales except for en and percentages.json so they
        // can be cached at runtime and not merged with
        // app precache. en.json and percentages.json are needed for first load
        // or fallback hence not clubbing with locales so first load followed by offline mode works fine. This is how CRA used to work too.
        manualChunks(id) {
          if (
            id.includes("src/locales") &&
            id.match(/en.json|percentages.json/) === null
          ) {
            const index = id.indexOf("locales/");
            // Taking the substring after "locales/"
            return `locales/${id.substring(index + 8)}`;
          }
        },
      },
    },
    sourcemap: true,
  },
  plugins: [
    react(),
    checker({
      typescript: true,
      eslint:
        envVars.VITE_APP_ENABLE_ESLINT === "false"
          ? undefined
          : { lintCommand: 'eslint "./src/**/*.{js,ts,tsx}"' },
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
        enabled: false,
      },

      workbox: {
        // Don't push fonts and locales to app precache
        globIgnores: ["fonts.css", "**/locales/**", "service-worker.js"],
        runtimeCaching: [
          {
            urlPattern: new RegExp("/.+.(ttf|woff2|otf)"),
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 90, // <== 90 days
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
        ],
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
            sizes: "256x256",
          },
        ],
        start_url: "/",
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
  ],
  publicDir: "./public",
});
