const webpack = require("webpack");
const path = require("path");

module.exports = {
  mode: "production",
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  optimization: {
    runtimeChunk: false,
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "excalidraw-utils.min.js",
    library: "ExcalidrawUtils",
    libraryTarget: "umd",
  },
  entry: "./index.js",
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
        ],
      },
    ],
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
  ],
};
