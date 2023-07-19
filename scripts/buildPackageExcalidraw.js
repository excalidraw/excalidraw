const { execSync } = require("child_process");

const excalidrawDir = `${__dirname}/../src/packages/excalidraw`;

const build = () => {
  try {
    execSync(`yarn  --frozen-lockfile`);
    execSync(`yarn --frozen-lockfile`, { cwd: excalidrawDir });
    execSync(`yarn run build:umd`, { cwd: excalidrawDir });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

build();
