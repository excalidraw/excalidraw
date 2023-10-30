const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const excalidrawDir = `${__dirname}/../src/packages/excalidraw`;
const excalidrawPackage = `${excalidrawDir}/package.json`;
const pkg = require(excalidrawPackage);

// Get short commit hash
const getShortCommitHash = () => {
  return execSync("git rev-parse --short HEAD").toString().trim();
};

// Validate that necessary directories and files exist
const validatePackageContents = () => {
  const distDir = path.join(excalidrawDir, "dist");
  if (!fs.existsSync(distDir)) {
    throw new Error(`The dist directory does not exist: ${distDir}`);
  }
};

const releaseToGitHub = () => {
  try {
    // Get commit hash and generate version
    const commitHash = getShortCommitHash();
    const version = `${pkg.version}-mw-${commitHash}`;

    execSync("yarn --frozen-lockfile");
    execSync("yarn --frozen-lockfile", { cwd: excalidrawDir });
    execSync("yarn run build:umd", { cwd: excalidrawDir });


    validatePackageContents();
    execSync(
      `gh release create ${version} --title "Release ${version}" --notes "Auto-generated release" -R MotaWord/excalidraw`,
      {
        cwd: path.join(excalidrawDir),
      },
    );

    console.info(`Successfully released version ${version} to GitHub.`);
  } catch (error) {
    console.error(`Failed to release version ${pkg.version} to GitHub:`, error);
    process.exit(1);
  }
};

releaseToGitHub();
