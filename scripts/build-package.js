const { build } = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");
const { externalGlobalPlugin } = require("esbuild-plugin-external-global");

const createESMBundle = async () => {
  await build({
    entryPoints: ["index.tsx"],
    bundle: true,
    format: "esm",
    outdir: "dist/esm",
    plugins: [
      sassPlugin(),
      externalGlobalPlugin({
        react: "React",
        "react-dom": "ReactDOM",
      }),
    ],
    define: {
      "import.meta.env": "{}",
    },
    splitting: true,
    chunkNames: "excalidraw-assets/[name]-[hash]",
    loader: {
      ".woff2": "dataurl",
    },
  });
};
createESMBundle();
