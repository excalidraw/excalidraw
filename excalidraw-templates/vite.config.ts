import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { generateHandler } from "./api/generate.js";

// Mounts the api/generate.ts Node handler directly into Vite's dev server
// at POST /api/generate. Dev-only convenience so the prototype doesn't
// need a separate server process; a real deployment (Vercel-style) would
// pick up api/generate.ts as a serverless function on its own.
function apiPlugin(): Plugin {
  return {
    name: "excalidraw-templates-api",
    configureServer(server) {
      server.middlewares.use("/api/generate", (req, res) => {
        generateHandler(req, res).catch((err: unknown) => {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(err) }));
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Loaded into this Node process (not the client bundle) so
  // api/generate.ts can read ANTHROPIC_API_KEY via process.env. Vite only
  // exposes VITE_-prefixed vars to client code via import.meta.env, so
  // this never reaches the browser.
  const env = loadEnv(mode, process.cwd(), "");
  if (env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  }
  if (env.ANTHROPIC_WORKSPACE_ID) {
    process.env.ANTHROPIC_WORKSPACE_ID = env.ANTHROPIC_WORKSPACE_ID;
  }

  return {
    plugins: [react(), apiPlugin()],
  };
});
