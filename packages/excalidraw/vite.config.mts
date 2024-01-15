import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// To load .env.local variables
const envVars = loadEnv("", `../../`);
// https://vitejs.dev/config/
export default defineConfig({
  root: "../../examples/excalidraw/with-script-in-browser/public",
  server: {
    port: 3001,
    // open the browser
    open: true,
  },
  publicDir: "public",
});
