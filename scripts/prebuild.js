const fs = require("fs");
const path = require("path");

// for development purposes we want to have the service-worker.js file
// accessible from the public folder. On build though, we need to compile it
// and CRA expects that file to be in src/ folder.
const moveServiceWorkerScript = () => {
  const oldPath = path.resolve(__dirname, "../public/service-worker.js");
  const newPath = path.resolve(__dirname, "../src/service-worker.js");

  if (fs.existsSync(newPath) && !fs.existsSync(oldPath)) {
    return;
  }

  fs.rename(oldPath, newPath, (error) => {
    if (error) {
      throw error;
    }
    console.info("public/service-worker.js moved to src/");
  });
};

// -----------------------------------------------------------------------------

moveServiceWorkerScript();
