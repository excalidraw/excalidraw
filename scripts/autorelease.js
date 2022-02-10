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
  } catch (error) {
    console.error(error);
  }
};
console.log(process.argv);

// get files changed between prev and head commit
exec(`git diff --name-only HEAD^ HEAD`, async (error, stdout, stderr) => {
  if (error || stderr) {
    console.error(error);
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
    process.exit(0);
  }

  const isPreview = process.argv.slice(3)[0] === "preview";
  // update package.json
  pkg.version = `${pkg.version}-${getShortCommitHash()}`;
  pkg.name = isPreview
    ? "@excalidraw/excalidraw-preview"
    : "@excalidraw/excalidraw-next";
  fs.writeFileSync(excalidrawPackage, JSON.stringify(pkg, null, 2), "utf8");

  // update readme
  let data = fs.readFileSync(`${excalidrawDir}/README_NEXT.md`, "utf8");
  // replace "excalidraw-next" with "excalidraw-preview"
  if (isPreview) {
    data = data.replace(/excalidraw-next/g, "excalidraw-preview");
    data = data.trim();
  }
  fs.writeFileSync(`${excalidrawDir}/README.md`, data, "utf8");
  //publish();
});
