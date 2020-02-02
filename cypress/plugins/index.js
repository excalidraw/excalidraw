const cypressTypeScriptPreprocessor = require("./cy-ts-preprocessor");
const {
  addMatchImageSnapshotPlugin,
} = require("cypress-image-snapshot/plugin");

module.exports = (on, config) => {
  on("file:preprocessor", cypressTypeScriptPreprocessor);
  addMatchImageSnapshotPlugin(on, config);
  return config;
};
