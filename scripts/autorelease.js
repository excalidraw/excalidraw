const fs = require("fs");
const { exec, execSync } = require("child_process");

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
  } catch (e) {
    console.error(e);
  }
};

// get files changed between prev and head commit
exec(`git diff --name-only HEAD^ HEAD`, async (error, stdout, stderr) => {
  if (error || stderr) {
    console.error(error);
    process.exit(1);
  }

  const changedFiles = stdout.trim().split("\n");
  const filesToIgnoreRegex = /src\/excalidraw-app|packages\/utils/;

  const excalidrawPackageFiles = changedFiles.filter((file) => {
    return file.indexOf("src") >= 0 && !filesToIgnoreRegex.test(file);
  });

  if (!excalidrawPackageFiles.length) {
    process.exit(0);
  }

  // update package.json
  pkg.version = `${pkg.version}-${getShortCommitHash()}`;
  pkg.name = "@excalidraw/excalidraw-next";
  fs.writeFileSync(excalidrawPackage, JSON.stringify(pkg, null, 2), "utf8");

  // update readme
  const data = fs.readFileSync(`${excalidrawDir}/README_NEXT.md`, "utf8");
  fs.writeFileSync(`${excalidrawDir}/README.md`, data, "utf8");

  publish();
});
