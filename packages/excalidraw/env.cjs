const dotenv = require("dotenv");
const { readFileSync } = require("fs");
const pkg = require("./package.json");
const parseEnvVariables = (filepath) => {
  const envVars = Object.entries(dotenv.parse(readFileSync(filepath))).reduce(
    (env, [key, value]) => {
      env[key] = value;
      return env;
    },
    {},
  );
  envVars.VITE_PKG_NAME = pkg.name;
  envVars.VITE_PKG_VERSION = pkg.version;
  envVars.VITE_IS_EXCALIDRAW_NPM_PACKAGE = true;
  return envVars;
};

module.exports = { parseEnvVariables };
