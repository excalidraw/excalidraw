import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// To load .env.local variables
const envVars = loadEnv("", `../../`);
// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3001,
    // open the browser
    open: true,
  },
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: true,
  },

  publicDir: "public",
});
