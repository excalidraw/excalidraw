const fs = require("fs");
const { exec, execSync } = require("child_process");

const excalidrawDir = `${__dirname}/../src/packages/excalidraw`;
const excalidrawPackage = `${excalidrawDir}/package.json`;
const pkg = require(excalidrawPackage);

const getShortCommitHash = () => {
  return execSync("git rev-parse --short HEAD").toString().trim();
};

const commitHash = getShortCommitHash();
exec(`git show --name-only ${commitHash}`, async (error, stdout, stderr) => {
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
  pkg.version = `${pkg.version}-${commitHash}`;
  pkg.name = "aakansha-excalidraw";
  await fs.writeFileSync(
    excalidrawPackage,
    JSON.stringify(pkg, null, 2),
    "utf8",
  );
  console.log("pkg updated");

  execSync(`yarn --cwd ${excalidrawDir} build:umd`);
  console.log("pkg build");

  execSync(`yarn --cwd ${excalidrawDir} publish`);
  console.log("publish");
});
