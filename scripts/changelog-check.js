const { exec } = require("child_process");

function changeLogCheck() {
  exec(
    "git diff origin/master --cached --name-only",
    (error, stdout, stderr) => {
      if (error || stderr) {
        process.exit(1);
        return;
      }

      if (!stdout || stdout.includes("packages/excalidraw/CHANGELOG.MD")) {
        process.exit(0);
      }

      const filesToIgnoreRegex = /src\/excalidraw-app|packages\/utils/;
      const excalidrawPackageFilesUpdated =
        stdout.indexOf("src") >= 0 && !filesToIgnoreRegex.test(stdout);

      if (excalidrawPackageFilesUpdated) {
        process.exit(1);
      }
      process.exit(0);
    },
  );
}
changeLogCheck();
