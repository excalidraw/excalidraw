global.__childdir = __dirname;
const path = require("path");
const { merge } = require("webpack-merge");
const commonConfig = require("../common.webpack.prod.config");

const config = {
  entry: {
    "excalidraw-extensions.production.min": "./index.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    library: "ExcalidrawExtensionsLib",
    chunkFilename: "excalidraw-extensions-assets/[name]-[contenthash].js",
    assetModuleFilename: "excalidraw-extensions-assets/[name][ext]",
  },
};
module.exports = merge(commonConfig, config);
