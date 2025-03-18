// next.config.js
module.exports = {
  webpack(config, { isServer }) {
    config.distDir = "build";
    config.typescript = {
      ignoreBuildErrors: true,
    };
    config.transpileModules = ["../"];

    if (!isServer) {
      config.module.rules.push({
        test: /\.worker\.(js|ts)$/,
        use: {
          loader: "worker-loader",
          options: {
            // You can tweak the filename pattern here
            filename: "static/chunks/[hash].worker.js",
          },
        },
      });
    }

    return config;
  },
};
