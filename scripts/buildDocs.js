const { exec } = require("child_process");

// Get files changed between prev and head commit
exec(`git diff --name-only HEAD^ HEAD`, (error, stdout, stderr) => {
  if (error || stderr) {
    console.error(error || stderr);
    process.exit(1);
  }

  const hasDocChange = stdout
    .split("\n")
    .some((file) => file.includes("docs"));

  if (!hasDocChange) {
    console.info("Skipping building docs as no valid diff found");
    process.exit(0);
  }

  // Exit code 1 to build the docs in ignoredBuildStep
  process.exit(1);
});
