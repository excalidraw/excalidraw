const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
const { merge } = require("webpack-merge");
const { parseEnvVariables } = require("./env");
const configCommon = require("../common.webpack.prod.config");

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
  optimization: {
    minimizer: [
      new TerserPlugin({
        test: /\.js($|\?)/i,
      }),
    ],
  },
  plugins: [
    ...(process.env.ANALYZER === "true" ? [new BundleAnalyzerPlugin()] : []),
    new webpack.DefinePlugin({
      "process.env": parseEnvVariables(
        path.resolve(__dirname, "../../../.env.production"),
      ),
    }),
  ],
};
module.exports = merge(configCommon, config);
