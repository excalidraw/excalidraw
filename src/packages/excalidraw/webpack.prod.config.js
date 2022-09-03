global.__childdir = __dirname;
const path = require("path");
const { merge } = require("webpack-merge");
const commonConfig = require("../common.webpack.prod.config");

const config = {
  entry: {
    "excalidraw.production.min": "./entry.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    library: "ExcalidrawLib",
    chunkFilename: "excalidraw-assets/[name]-[contenthash].js",
    assetModuleFilename: "excalidraw-assets/[name][ext]",
  },
};
module.exports = merge(commonConfig, config);
