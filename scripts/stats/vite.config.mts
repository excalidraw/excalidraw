import { defineConfig, mergeConfig } from "vite";

import appConfig from "../../excalidraw-app/vite.config.mts";

import { bundleStatsPlugin } from "./bundle-stats-plugin.mts";

/**
 * The app's production build plus `bundle-stats.json` (`yarn stats:bundle`,
 * run from `excalidraw-app/` like the app's own build). The stats aren't part
 * of the deployed builds, so they only cost CI the extra compression.
 */
export default defineConfig(async (env) => {
  const config =
    typeof appConfig === "function" ? await appConfig(env) : await appConfig;

  return mergeConfig(config, { plugins: [bundleStatsPlugin()] });
});
