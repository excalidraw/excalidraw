const wp = require("@cypress/webpack-preprocessor");

const webpackOptions = {
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/],
        use: [
          {
            loader: "ts-loader",
            options: {
              // skip typechecking for speed
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
};

const options = {
  webpackOptions,
};

module.exports = wp(options);
