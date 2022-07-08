const dotenv = require("dotenv");
const { readFileSync } = require("fs");
const pkg = require("./package.json");
const parseEnvVariables = (filepath) => {
  const envVars = Object.entries(dotenv.parse(readFileSync(filepath))).reduce(
    (env, [key, value]) => {
      env[key] = JSON.stringify(value);
      return env;
    },
    {},
  );
  envVars.PKG_NAME = JSON.stringify(pkg.name);
  envVars.PKG_VERSION = JSON.stringify(pkg.version);
  envVars.IS_EXCALIDRAW_PLUGINS_NPM_PACKAGE = JSON.stringify(true);
  return envVars;
};

module.exports = { parseEnvVariables };
