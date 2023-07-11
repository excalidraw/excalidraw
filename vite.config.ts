import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgrPlugin from "vite-plugin-svgr";
import { ViteEjsPlugin } from "vite-plugin-ejs";
import { VitePWA } from "vite-plugin-pwa";
import eslint from "vite-plugin-eslint";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: "build",
  },
  plugins: [
    react(),
    eslint(),
    svgrPlugin(),
    ViteEjsPlugin(),
    VitePWA({
      devOptions: {
        /* set this flag to true to enable in Development mode */
        enabled: true,
      },
      workbox: {
        manifestTransforms: [
          (entries) => {
            const manifest = entries.filter((entry) => {
              return !/locales\/[\w-]+json/.test(
                typeof entry === "string" ? entry : entry.url,
              );
            });
            return { manifest };
          },
        ],
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
            urlPattern: new RegExp("locales/[^/]+.json"),
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
            src: "logo-180x180.png",
            sizes: "180x180",
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
        theme_color: "#000000",
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
