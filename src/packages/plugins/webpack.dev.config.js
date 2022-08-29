global.__childdir = __dirname;
const path = require("path");
const { merge } = require("webpack-merge");
const configCommon = require("../common.webpack.dev.config");

const outputDir = process.env.EXAMPLE === "true" ? "example/public" : "dist";
const config = {
  entry: {
    "excalidraw-plugins.development": "./index.ts",
  },
  output: {
    path: path.resolve(__dirname, outputDir),
    library: "ExcalidrawPluginsLib",
    chunkFilename: "excalidraw-plugins-assets-dev/[name]-[contenthash].js",
    assetModuleFilename: "excalidraw-plugins-assets-dev/[name][ext]",
  },
};
module.exports = merge(configCommon, config);
