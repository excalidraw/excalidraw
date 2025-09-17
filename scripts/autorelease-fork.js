const fs = require("fs");
const { execSync } = require("child_process");
const core = require("@actions/core");

const excalidrawDir = `${__dirname}/../src/packages/excalidraw`;
const excalidrawPackage = `${excalidrawDir}/package.json`;
const pkg = require(excalidrawPackage);

const getShortCommitHash = () => {
  return execSync("git rev-parse --short HEAD").toString().trim();
};

const publish = () => {
  try {
    const version = `${pkg.version}-${getShortCommitHash()}`;
    pkg.version = version;

    fs.writeFileSync(excalidrawPackage, JSON.stringify(pkg, null, 2), "utf8");

    execSync(`yarn --frozen-lockfile`);
    execSync(`yarn --frozen-lockfile`, { cwd: excalidrawDir });
    execSync(`yarn run build:umd`, { cwd: excalidrawDir });
    execSync(`yarn --cwd ${excalidrawDir} publish`);
    console.info(`Published ${pkg.name}@latest 🎉`);
    core.setOutput(
      "result",
      `**Latest version has been published** [@dwelle/excalidraw@${pkg.version}](https://www.npmjs.com/package/@excalidraw/excalidraw/v/${pkg.version}) :rocket:`,
    );
  } catch (error) {
    core.setOutput("result", "package couldn't be published :warning:!");
    console.error(error);
    process.exit(1);
  }
};

console.info("Publish in progress...");
publish();
