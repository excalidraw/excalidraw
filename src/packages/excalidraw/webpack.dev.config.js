const path = require("path");
const webpack = require("webpack");
const { merge } = require("webpack-merge");
const { parseEnvVariables } = require("./env");
const configCommon = require("../common.webpack.dev.config");

const outputDir = process.env.EXAMPLE === "true" ? "example/public" : "dist";
const config = {
  entry: {
    "excalidraw.development": "./entry.js",
  },
  output: {
    path: path.resolve(__dirname, outputDir),
    library: "ExcalidrawLib",
    chunkFilename: "excalidraw-assets-dev/[name]-[contenthash].js",
    assetModuleFilename: "excalidraw-assets-dev/[name][ext]",
  },
  plugins: [
    new webpack.EvalSourceMapDevToolPlugin({ exclude: /vendor/ }),
    new webpack.DefinePlugin({
      "process.env": parseEnvVariables(
        path.resolve(__dirname, "../../../.env.development"),
      ),
    }),
  ],
};
module.exports = merge(configCommon, config);
