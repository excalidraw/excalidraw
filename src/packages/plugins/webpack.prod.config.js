global.__childdir = __dirname;
const path = require("path");
const { merge } = require("webpack-merge");
const commonConfig = require("../common.webpack.prod.config");

const config = {
  entry: {
    "excalidraw-plugins.production.min": "./index.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    library: "ExcalidrawPluginsLib",
    chunkFilename: "excalidraw-plugins-assets/[name]-[contenthash].js",
    assetModuleFilename: "excalidraw-plugins-assets/[name][ext]",
  },
};
module.exports = merge(commonConfig, config);
