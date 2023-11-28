const prodConfig = require("./webpack.prod.config");
const devConfig = require("./webpack.dev.config");

const isProd = process.env.NODE_ENV === "production";

const config = isProd ? prodConfig : devConfig;
const outputFile = isProd
  ? "excalidraw-with-preact.production.min"
  : "excalidraw-with-preact.development";

const preactWebpackConfig = {
  ...config,
  entry: {
    [outputFile]: "./entry.js",
  },
  externals: {
    ...config.externals,
    "react-dom/client": {
      root: "ReactDOMClient",
      commonjs2: "react-dom/client",
      commonjs: "react-dom/client",
      amd: "react-dom/client",
    },
    "react/jsx-runtime": {
      root: "ReactJSXRuntime",
      commonjs2: "react/jsx-runtime",
      commonjs: "react/jsx-runtime",
      amd: "react/jsx-runtime",
    },
  },
};
module.exports = preactWebpackConfig;
