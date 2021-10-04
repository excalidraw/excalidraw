const webpack = require("webpack");
const path = require("path");
const autoprefixer = require("autoprefixer");

module.exports = {
  mode: "development",
  devtool: false,
  entry: {
    "excalidraw.development": "./entry.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    library: "Excalidraw",
    libraryTarget: "umd",
    filename: "[name].js",
    chunkFilename: "excalidraw-assets-dev/[name]-[contenthash].js",
    publicPath: "",
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
          "style-loader",
          {
            loader: "css-loader",
          },
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: [autoprefixer()],
              },
            },
          },
          "sass-loader",
        ],
      },
      {
        test: /\.(ts|tsx|js|jsx|mjs)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              configFile: path.resolve(__dirname, "../tsconfig.dev.json"),
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
                "@babel/plugin-transform-runtime",
              ],
            },
          },
        ],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: "asset/inline",
      },
    ],
  },
  optimization: {
    splitChunks: {
      chunks: "async",
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendor",
        },
      },
    },
  },
  plugins: [
    new webpack.EvalSourceMapDevToolPlugin({ exclude: /vendor/ }),
    /*new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),*/
  ],
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
