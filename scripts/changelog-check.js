const { exec } = require("child_process");

function changeLogCheck() {
  exec(
    "git diff origin/master --cached --name-only",
    (error, stdout, stderr) => {
      if (error || stderr) {
        process.exit(1);
        return;
      }

      if (!stdout) {
        process.exit(0);
      }

      const changedFiles = stdout.trim().split("\n");
      const filesToIgnoreRegex = /src\/excalidraw-app|packages\/utils/;
      const excalidrawPackageFiles = changedFiles.filter((file) => {
        return file.indexOf("src") >= 0 && !filesToIgnoreRegex.test(file);
      });
      if (excalidrawPackageFiles.length) {
        process.exit(1);
      }
      process.exit(0);
    },
  );
}
changeLogCheck();
