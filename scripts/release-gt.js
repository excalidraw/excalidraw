const { execSync } = require("child_process");
const path = require('path');
const excalidrawDir = `${__dirname}/../src/packages/excalidraw`;
const excalidrawPackage = `${excalidrawDir}/package.json`;
const pkg = require(excalidrawPackage);

const getShortCommitHash = () => {
  return execSync("git rev-parse --short HEAD").toString().trim();
};

const releaseToGitHub = () => {
  try {
    const commitHash = getShortCommitHash();
    const version = `${pkg.version}-mw-${commitHash}`;
    execSync(`yarn  --frozen-lockfile`);
    execSync(`yarn --frozen-lockfile`, { cwd: excalidrawDir });
    execSync(`yarn run build:umd`, { cwd: excalidrawDir });
    // Explicitly specify the repo
    execSync(`gh release create ${version} --title "Release ${version}" --notes "Auto-generated release" -R MotaWord/excalidraw`, {
      cwd: path.join(excalidrawDir)  // Adjust this path to your repo's root directory
    });

    console.info(`Released ${version} to GitHub!`);
  } catch (error) {
    console.error("Failed to create GitHub release:", error);
    process.exit(1);
  }
};

releaseToGitHub();
