global.__childdir = __dirname;
global.__noenv = true;
const webpack = require("webpack");
const path = require("path");
const { merge } = require("webpack-merge");
const commonConfig = require("../common.webpack.prod.config");

const config = {
  entry: { "excalidraw-utils.min": "./index.js" },
  output: {
    path: path.resolve(__dirname, "dist"),
    library: "ExcalidrawUtils",
  },
  optimization: {
    runtimeChunk: false,
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
  ],
};
module.exports = merge(commonConfig, config);
