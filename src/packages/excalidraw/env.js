const dotenv = require("dotenv");
const { readFileSync } = require("fs");

const parseEnvVariables = (filepath) => {
  return Object.entries(dotenv.parse(readFileSync(filepath))).reduce(
    (env, [key, value]) => {
      env[key] = JSON.stringify(value);
      return env;
    },
    {},
  );
};

module.exports = { parseEnvVariables };
