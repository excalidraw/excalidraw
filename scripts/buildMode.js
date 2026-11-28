const { build } = require("esbuild");

const buildMode = (config, mode, envVars) => {
  return build({
    ...config,
    ...(mode === "development" ? { sourcemap: true } : { minify: true }),
    define: {
      "import.meta.env": JSON.stringify(envVars[mode]),
    },
  });
};

module.exports = { buildMode };
