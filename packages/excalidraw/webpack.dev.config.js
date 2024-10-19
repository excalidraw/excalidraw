const path = require("path");
const webpack = require("webpack");
const autoprefixer = require("autoprefixer");
const { parseEnvVariables } = require("./env");
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
//const outputDir = process.env.EXAMPLE === "true" ? "example/public" : "dist";
const MiniCssExtractPlugin = require("mini-css-extract-plugin"); //zsviczian
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: "development",
  entry: {
    "excalidraw.development": "./entry.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    library: "ExcalidrawLib",
    libraryTarget: "umd",
    filename: "[name].js",
    chunkFilename: "excalidraw-assets-dev/[name]-[contenthash].js",
    assetModuleFilename: "excalidraw-assets-dev/[name][ext]",
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
          MiniCssExtractPlugin.loader, //zsviczian replacase "style-loader"
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
      // So that type module works with webpack
      // https://github.com/webpack/webpack/issues/11467#issuecomment-691873586
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.(ts|tsx|js|jsx|mjs)$/,
        exclude:
          /node_modules[\\/](?!(browser-fs-access|canvas-roundrect-polyfill))/,
        use: [
          {
            loader: "import-meta-loader",
          },
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              configFile: path.resolve(__dirname, "../tsconfig.dev.json"),
            },
          },
        ],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: "asset/resource",
        //type: "asset/inline", //zsviczian
      },
    ],
  },
  optimization: {
    /*//sideEffects: false, //zsviczian https://github.com/storybookjs/storybook/issues/15221
    splitChunks: {
      chunks: "async",
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendor",
        },
      },
    },*/
    //zsviczian: not required
  },
  plugins: [
    new MiniCssExtractPlugin({
      //zsviczian export to file
      filename: "styles.development.css",
    }),
    new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }), //zsviczian
    ...(false ? [new BundleAnalyzerPlugin()] : []), //zsviczian has no effect, however, without this I get a build error
    new webpack.DefinePlugin({
      "process.env": parseEnvVariables(
        path.resolve(__dirname, "../../.env.development"),
      ),
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'fonts/woff2/Assistant'), // Path to your font files
          to: path.resolve(__dirname, 'dist/excalidraw-assets'), // First output path
          globOptions: {
            dot: true,
            gitignore: true,
            ignore: ['*.DS_Store'], // Ignore any unwanted files
          },
        },
        {
          from: path.resolve(__dirname, 'fonts/woff2/Assistant'), // Same source path
          to: path.resolve(__dirname, 'dist/excalidraw-assets-dev'), // Second output path
          globOptions: {
            dot: true,
            gitignore: true,
            ignore: ['*.DS_Store'], // Ignore any unwanted files
          },
        },
      ],
    }),
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
