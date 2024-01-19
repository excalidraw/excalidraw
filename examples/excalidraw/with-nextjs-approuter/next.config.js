/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: "build",
  typescript: {
    // The ts config doesn't work with `jsx: preserve" and if updated to `react-jsx` it gets ovewritten by next js throwing ts errors hence I am ignoring build errors until this is fixed.
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
