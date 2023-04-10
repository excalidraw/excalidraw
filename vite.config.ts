import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgrPlugin from "vite-plugin-svgr";
import envCompatible from "vite-plugin-env-compatible";
import { ViteEjsPlugin } from "vite-plugin-ejs";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: 'build',
  },
  plugins: [
    react(),
    svgrPlugin(),
    envCompatible(),
    // This is needed in order to use the same env API format that CRA uses with the EJS templating
    // Vite by default uses import.meta.env
    ViteEjsPlugin((config) => {
      const envs = loadEnv(config.mode, "./");
      const templatingEnvs = {
        process: {
          env: {
            ...envs,
          },
        },
      };

      return templatingEnvs;
    }),
  ],
  publicDir: "./public",
});
