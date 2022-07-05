const fs = require("fs");
const { execSync } = require("child_process");

const excalidrawDir = `${__dirname}/../src/packages/excalidraw`;
const excalidrawPackage = `${excalidrawDir}/package.json`;
const pkg = require(excalidrawPackage);

const originalReadMe = fs.readFileSync(`${excalidrawDir}/README.md`, "utf8");

const updateReadme = () => {
  const excalidrawIndex = originalReadMe.indexOf("### Excalidraw");

  // remove note for stable readme
  const data = originalReadMe.slice(excalidrawIndex);

  // update readme
  fs.writeFileSync(`${excalidrawDir}/README.md`, data, "utf8");
};

const publish = () => {
  try {
    execSync(`yarn  --frozen-lockfile`);
    execSync(`yarn --frozen-lockfile`, { cwd: excalidrawDir });
    execSync(`yarn run build:umd`, { cwd: excalidrawDir });
    execSync(`yarn --cwd ${excalidrawDir} publish`);
  } catch (error) {
    console.error(error);
  }
};

const release = () => {
  updateReadme();
  console.info("Note for stable readme removed");

  publish();
  console.info(`Published ${pkg.version}!`);

  // revert readme after release
  fs.writeFileSync(`${excalidrawDir}/README.md`, originalReadMe, "utf8");
  console.info("Readme reverted");
};

release();
