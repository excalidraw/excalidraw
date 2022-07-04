const fs = require("fs");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const updateChangelog = require("./updateChangelog");

const excalidrawDir = `${__dirname}/../src/packages/excalidraw`;
const excalidrawPackage = `${excalidrawDir}/package.json`;
const originalReadMe = fs.readFileSync(`${excalidrawDir}/README.md`, "utf8");

const updateReadme = () => {
  let data = originalReadMe;

  const noteIndex = data.indexOf("#### Note");
  const installlationIndex = data.indexOf("### Installation");

  // remove note for stable readme
  data = data.slice(0, noteIndex) + data.slice(installlationIndex);

  // update readme
  fs.writeFileSync(`${excalidrawDir}/README.md`, data, "utf8");
};

const updatePackageVersion = (nextVersion) => {
  const pkg = require(excalidrawPackage);
  pkg.version = nextVersion;
  const content = `${JSON.stringify(pkg, null, 2)}\n`;
  fs.writeFileSync(excalidrawPackage, content, "utf-8");
};

const release = async (nextVersion) => {
  try {
    updateReadme();
    await updateChangelog(nextVersion);
    updatePackageVersion(nextVersion);
    await exec(`git add -u`);
    await exec(
      `git commit -m "docs: release @excalidraw/excalidraw@${nextVersion}  🎉"`,
    );
    // revert readme after release
    fs.writeFileSync(`${excalidrawDir}/README.md`, originalReadMe, "utf8");
    // /* eslint-disable no-console */
    // console.log("Done!");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

const nextVersion = process.argv.slice(2)[0];
if (!nextVersion) {
  console.error("Pass the next version to release!");
  process.exit(1);
}
release(nextVersion);
