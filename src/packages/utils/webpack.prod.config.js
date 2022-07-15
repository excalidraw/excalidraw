const webpack = require("webpack");
const path = require("path");
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
const { merge } = require("webpack-merge");
const configCommon = require("../common.webpack.prod.config");

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
    ...(process.env.ANALYZER === "true" ? [new BundleAnalyzerPlugin()] : []),
  ],
};
module.exports = merge(configCommon, config);
