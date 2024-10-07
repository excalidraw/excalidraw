const webpack = require("webpack");
const path = require("path");
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

module.exports = {
  mode: "production",
  entry: { "excalidraw-math.min": "./index.js" },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    library: "ExcalidrawMath",
    libraryTarget: "umd",
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".css", ".scss"],
  },
  optimization: {
    runtimeChunk: false,
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js)$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              configFile: path.resolve(__dirname, "../tsconfig.prod.json"),
            },
          },
          {
            loader: "babel-loader",

            options: {
              presets: [
                "@babel/preset-env",
                ["@babel/preset-react", { runtime: "automatic" }],
                "@babel/preset-typescript",
              ],
              plugins: [["@babel/plugin-transform-runtime"]],
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
    ...(process.env.ANALYZER === "true" ? [new BundleAnalyzerPlugin()] : []),
  ],
};
