const fs = require("fs");
const { exec, execSync } = require("child_process");
const core = require("@actions/core");

const excalidrawDir = `${__dirname}/../src/packages/excalidraw`;
const excalidrawPackage = `${excalidrawDir}/package.json`;
const pkg = require(excalidrawPackage);
const isPreview = process.argv.slice(2)[0] === "preview";

const getShortCommitHash = () => {
  return execSync("git rev-parse --short HEAD").toString().trim();
};

const publish = () => {
  const tag = isPreview ? "preview" : "next";

  try {
    execSync(`yarn  --frozen-lockfile`);
    execSync(`yarn --frozen-lockfile`, { cwd: excalidrawDir });
    execSync(`yarn run build:umd`, { cwd: excalidrawDir });
    execSync(`yarn --cwd ${excalidrawDir} publish --tag ${tag}`);
    console.info(`Published ${pkg.name}@${tag}🎉`);
    core.setOutput(
      "result",
      `**Preview version has been shipped** :rocket:
    You can use [@excalidraw/excalidraw@${pkg.version}](https://www.npmjs.com/package/@excalidraw/excalidraw/v/${pkg.version}) for testing!`,
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
  let version = `${pkg.version}-${getShortCommitHash()}`;

  // update readme

  if (isPreview) {
    // use pullNumber-commithash as the version for preview
    const pullRequestNumber = process.argv.slice(3)[0];
    version = `${pkg.version}-${pullRequestNumber}-${getShortCommitHash()}`;
  }
  pkg.version = version;

  fs.writeFileSync(excalidrawPackage, JSON.stringify(pkg, null, 2), "utf8");

  console.info("Publish in progress...");
  publish();
});
