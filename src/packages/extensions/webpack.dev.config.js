global.__childdir = __dirname;
const path = require("path");
const { merge } = require("webpack-merge");
const commonConfig = require("../common.webpack.dev.config");

const outputDir = process.env.EXAMPLE === "true" ? "example/public" : "dist";
const config = {
  entry: {
    "excalidraw-extensions.development": "./index.ts",
  },
  output: {
    path: path.resolve(__dirname, outputDir),
    library: "ExcalidrawExtensionsLib",
    chunkFilename: "excalidraw-extensions-assets-dev/[name]-[contenthash].js",
    assetModuleFilename: "excalidraw-extensions-assets-dev/[name][ext]",
  },
};
module.exports = merge(commonConfig, config);
