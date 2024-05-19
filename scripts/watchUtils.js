const chokidar = require("chokidar");
const path = require("path");
const { execSync } = require("child_process");

const BASE_PATH = `${path.resolve(`${__dirname}/..`)}`;
const utilsDir = `${BASE_PATH}/packages/utils/src`;
// One-liner for current directory
chokidar.watch(utilsDir).on("change", (event) => {
  console.info("Watching", event);
  try {
    execSync(`yarn workspace @excalidraw/utils run build:src`);
  } catch (err) {
    console.error("Error when building workspace", err);
  }
  console.info("BUILD DONE");
});
