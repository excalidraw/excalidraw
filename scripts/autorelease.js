const fs = require("fs");
const { exec, execSync } = require("child_process");

const excalidrawDir = `${__dirname}/../src/packages/excalidraw`;
const excalidrawPackage = `${excalidrawDir}/package.json`;
const pkg = require(excalidrawPackage);

const getShortCommitHash = () => {
  return execSync("git rev-parse --short HEAD").toString().trim();
};
exec(
  "git diff origin/master --cached --name-only",
  async (error, stdout, stderr) => {
    if (error || stderr) {
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
    pkg.version = `${pkg.version}-${getShortCommitHash()}`;
    pkg.name = "aakansha-excalidraw";
    await fs.writeFileSync(
      excalidrawPackage,
      JSON.stringify(pkg, null, 2),
      "utf8",
    );

    execSync(`yarn --cwd ${excalidrawDir} build:umd`);
    execSync(`yarn --cwd ${excalidrawDir} publish`);
  },
);
