const path = require("path");
const webpack = require("webpack");

module.exports = {
  entry: {
    excalidraw: [
      path.join(__dirname, "public/fonts.css"),
      path.join(__dirname, "src/export.tsx"),
    ],
  },
  output: {
    path: path.join(__dirname, "dist"),
    filename: "[name].js",
    library: "Excalidraw",
    libraryTarget: "umd",
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".css", ".scss"],
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.s[ac]ss$/i,
        use: ["style-loader", "css-loader", "sass-loader"],
      },
      {
        test: /\.(jpg|jpeg|png|woff|woff2|eot|ttf|svg)$/,
        use: [
          {
            loader: "url-loader",
            options: {
              limit: Infinity,
            },
          },
        ],
      },
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
  externals: ["react", "react-dom"],
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
  ],
};
