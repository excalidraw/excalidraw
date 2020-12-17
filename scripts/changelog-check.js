const { exec } = require("child_process");

const normalizePath = (path) => path.replace(/\\+/g, "/").trim().toLowerCase();

const IGNORED_PATHS = [
  "src/excalidraw-app",
  "packages/utils",
  "CHANGELOG.md",
  "README.md",
].map(normalizePath);

exec("git diff origin/master --cached --name-only", (error, stdout, stderr) => {
  if (error || stderr) {
    process.exit(1);
  }

  if (!stdout || stdout.includes("packages/excalidraw/CHANGELOG.MD")) {
    process.exit(0);
  }

  const changedFiles = stdout.trim().split("\n").map(normalizePath);

  const excalidrawPackageFiles = changedFiles.filter((filename) => {
    return (
      filename.includes("src") &&
      !IGNORED_PATHS.find((ignoredPath) => filename.includes(ignoredPath))
    );
  });

  if (excalidrawPackageFiles.length) {
    process.exit(1);
  }
  process.exit(0);
});
