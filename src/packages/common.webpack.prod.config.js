const path = require("path");
const autoprefixer = require("autoprefixer");
const webpack = require("webpack");
const BundleAnalyzerPlugin = require(path.resolve(
  path.join(global.__childdir, "node_modules"),
  "webpack-bundle-analyzer",
)).BundleAnalyzerPlugin;
const TerserPlugin = require("terser-webpack-plugin");
const { parseEnvVariables } =
  "__noenv" in global ? {} : require(path.resolve(global.__childdir, "./env"));

module.exports = {
  mode: "production",
  output: {
    libraryTarget: "umd",
    filename: "[name].js",
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
        exclude: /node_modules\/(?!browser-fs-access)/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              configFile: path.resolve(__dirname, "./tsconfig.prod.json"),
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
              plugins: [
                "transform-class-properties",
                "@babel/plugin-transform-runtime",
              ],
            },
          },
        ],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: "asset/resource",
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        test: /\.js($|\?)/i,
      }),
    ],
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
    ...(process.env.ANALYZER === "true" ? [new BundleAnalyzerPlugin()] : []),
    ...("__noenv" in global
      ? []
      : [
          new webpack.DefinePlugin({
            "process.env": parseEnvVariables(
              path.resolve(__dirname, "../../.env.production"),
            ),
          }),
        ]),
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
