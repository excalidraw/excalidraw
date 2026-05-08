import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_TLDRAW_APP_PORT) || 3001,
      open: true,
    },
    envDir: "../",
  };
});
