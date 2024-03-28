import { defineConfig, mergeConfig, loadEnv } from "vite";
import viteConfig from "./vite.config.mjs";

// To load .env.local variables
const envVars = loadEnv("", `../`);
// https://vitejs.dev/config/
export default mergeConfig(
    viteConfig,
    defineConfig({
      server: {
        port: Number(envVars.VITE_APP_PORT || 3000),
        host: '0.0.0.0',
        // open the browser
        open: false,
      },
    })
)
