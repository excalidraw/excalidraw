const path = require("path");
const webpack = require("webpack");
const autoprefixer = require("autoprefixer");
const { parseEnvVariables } = require("./env.cjs");

const devServerConfig = {
  mode: "development",

  entry: {
    bundle: "./example/index.tsx",
  },
  output: {
    path: path.resolve(__dirname, "example/public"),
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
          "style-loader",
          { loader: "css-loader" },
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
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env": parseEnvVariables(
        path.resolve(__dirname, "../../.env.development"),
      ),
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
  // Server Configuration options
  devServer: {
    port: 3001,
    host: "localhost",
    hot: true,
    compress: true,
    static: {
      directory: path.join(__dirname, "./example/public"),
    },
    client: {
      progress: true,
      logging: "info",
      overlay: true, //Shows a full-screen overlay in the browser when there are compiler errors or warnings.
    },
    open: ["./"],
  },
};

module.exports = devServerConfig;
