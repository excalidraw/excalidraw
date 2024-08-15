import { defineConfig } from "vite";
import vitePluginConditionalCompile from "vite-plugin-conditional-compile";
import { woff2BrowserPlugin } from "./scripts/woff2/woff2-vite-plugins";

export default defineConfig({
  plugins: [
    vitePluginConditionalCompile({
      include: [/^.*(excalidraw-app\/)?App.tsx$/],
    }),
    woff2BrowserPlugin(),
  ],
});
