const path = require("path");
const { merge } = require("webpack-merge");

const devConfig = require("./webpack.dev.config");

const devServerConfig = {
  entry: {
    bundle: "./example/index.js",
  },
  // Server Configuration options
  devServer: {
    port: 3001,
    host: "0.0.0.0",
    hot: true,
    proxy: {
      "/sbapi/**": {
        target: `http://0.0.0.0:3000/api`,
        secure: false,
      },
    },
    compress: true,
    static: {
      directory: path.join(__dirname, "example"),
    },
    client: {
      progress: true,
      logging: "info",
      overlay: true, //Shows a full-screen overlay in the browser when there are compiler errors or warnings.
    },
    open: ["./"],
  },
};

module.exports = merge(devServerConfig, devConfig);
