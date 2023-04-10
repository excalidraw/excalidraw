import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgrPlugin from "vite-plugin-svgr";
import envCompatible from "vite-plugin-env-compatible";
import {ViteEjsPlugin} from "vite-plugin-ejs";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), svgrPlugin(), envCompatible(), ViteEjsPlugin()],
  publicDir: "./public",
});
