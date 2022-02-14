const fs = require("fs");
const { exec, execSync } = require("child_process");
const core = require("@actions/core");

const excalidrawDir = `${__dirname}/../src/packages/excalidraw`;
const excalidrawPackage = `${excalidrawDir}/package.json`;
const pkg = require(excalidrawPackage);

const getShortCommitHash = () => {
  return execSync("git rev-parse --short HEAD").toString().trim();
};

const publish = () => {
  try {
    execSync(`yarn  --frozen-lockfile`);
    execSync(`yarn --frozen-lockfile`, { cwd: excalidrawDir });
    execSync(`yarn run build:umd`, { cwd: excalidrawDir });
    execSync(`yarn --cwd ${excalidrawDir} publish`);
    console.info("Published 🎉");
    core.setOutput(
      "result",
      `**Preview version has been shipped** :rocket:
    You can use [@excalidraw/excalidraw-preview@${pkg.version}](https://www.npmjs.com/package/@excalidraw/excalidraw-preview/v/${pkg.version}) for testing!`,
    );
  } catch (error) {
    core.setOutput("result", "package couldn't be published :warning:!");
    console.error(error);
    process.exit(1);
  }
};
// get files changed between prev and head commit
exec(`git diff --name-only HEAD^ HEAD`, async (error, stdout, stderr) => {
  if (error || stderr) {
    console.error(error);
    core.setOutput("result", ":warning: Package couldn't be published!");
    process.exit(1);
  }
  const changedFiles = stdout.trim().split("\n");
  const filesToIgnoreRegex = /src\/excalidraw-app|packages\/utils/;

  const excalidrawPackageFiles = changedFiles.filter((file) => {
    return (
      (file.indexOf("src") >= 0 || file.indexOf("package.json")) >= 0 &&
      !filesToIgnoreRegex.test(file)
    );
  });
  if (!excalidrawPackageFiles.length) {
    console.info("Skipping release as no valid diff found");
    core.setOutput("result", "Skipping release as no valid diff found");
    process.exit(0);
  }

  // update package.json
  pkg.version = `${pkg.version}-${getShortCommitHash()}`;
  pkg.name = "@excalidraw/excalidraw-next";
  // update readme
  let data = fs.readFileSync(`${excalidrawDir}/README_NEXT.md`, "utf8");

  const isPreview = process.argv.slice(2)[0] === "preview";
  console.info("isPreview", isPreview);
  if (isPreview) {
    // use pullNumber-commithash as the version for preview
    const pullRequestNumber = process.argv.slice(3)[0];
    pkg.version = `${pkg.version}-${pullRequestNumber}`;
    console.info("version=", pkg.version);
    // replace "excalidraw-next" with "excalidraw-preview"
    pkg.name = "@excalidraw/excalidraw-preview";
    data = data.replace(/excalidraw-next/g, "excalidraw-preview");
    data = data.trim();
  }

  fs.writeFileSync(excalidrawPackage, JSON.stringify(pkg, null, 2), "utf8");

  fs.writeFileSync(`${excalidrawDir}/README.md`, data, "utf8");
  console.info("Publish in progress...");
  publish();
});
