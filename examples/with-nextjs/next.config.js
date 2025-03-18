/** @type {import('next').NextConfig} */
module.exports = {
  distDir: "build",
  typescript: {
    // Temporarily ignore build errors until the TS config mismatch is resolved
    ignoreBuildErrors: true,
  },
  // Transpile sibling/parent packages in a monorepo
  transpilePackages: ["../"],
  webpack(config, { isServer }) {
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
