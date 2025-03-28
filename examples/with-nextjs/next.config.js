/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: "build",
  typescript: {
    // The ts config doesn't work with `jsx: preserve" and if updated to `react-jsx` it gets overwritten by next js throwing ts errors hence I am ignoring build errors until this is fixed.
    ignoreBuildErrors: true,
  },
  // This is needed as in pages router the code for importing types throws error as it's outside next js app
  transpilePackages: ["../"],
};

module.exports = nextConfig;
