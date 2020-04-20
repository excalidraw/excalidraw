const path = require("path");
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  mode: "production",
  entry: {
    "excalidraw.min": "./src/excalidraw_wrapper.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    library: "Excalidraw",
    libraryTarget: "umd",
    filename: "[name].js",
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".css", ".scss"],
  },
  module: {
    rules: [
      {
        test: /\.(sa|sc|c)ss$/,
        exclude: /node_modules/,
        use: [
          MiniCssExtractPlugin.loader,
          { loader: "css-loader", options: { url: false } },
          "sass-loader",
        ],
      },
      {
        test: /\.(ts|tsx|js|jsx|mjs)$/,
        exclude: /node_modules\/(?!(roughjs|socket.io-client|browser-nativefs)\/).*/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              configFile: "tsconfig.prod.json",
            },
          },
          {
            loader: "babel-loader",
            options: {
              presets: [
                "@babel/preset-env",
                "@babel/preset-react",
                "@babel/preset-typescript",
              ],
              plugins: [
                "@babel/plugin-proposal-object-rest-spread",
                "@babel/plugin-transform-arrow-functions",
                "transform-class-properties",
                "@babel/plugin-transform-async-to-generator",
              ],
            },
          },
        ],
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        test: /\.min\.js($|\?)/i,
      }),
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 2,
      }),
    ],
  },
  plugins: [new MiniCssExtractPlugin({ filename: "[name].css" })],
  externals: {
    react: {
      root: "React",
      commonjs2: "react",
      commonjs: "react",
      amd: "react",
    },
    "react-dom": {
      root: "ReactDOM",
      commonjs2: "react-dom",
      commonjs: "react-dom",
      amd: "react-dom",
    },
  },
};
