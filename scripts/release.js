const fs = require("fs");
const path = require("path");

const { execSync } = require("child_process");

const updateChangelog = require("./updateChangelog");

// skipping utils for now, as it has independent release process
const PACKAGES = ["common", "element", "math", "excalidraw"];
const PACKAGES_DIR = path.resolve(`${__dirname}/../packages`);

const validatePackageName = (packageName) => {
  if (!PACKAGES.includes(packageName)) {
    console.error(`Package "${packageName}" not found!`);
    process.exit(1);
  }
};

const getPackageJsonPath = (packageName) => {
  validatePackageName(packageName);
  return path.resolve(`${PACKAGES_DIR}/${packageName}/package.json`);
};

const updatePackageJsons = (nextVersion) => {
  const packageJsons = new Map();

  for (const packageName of PACKAGES) {
    const pkg = require(getPackageJsonPath(packageName));

    pkg.version = nextVersion;

    if (pkg.dependencies) {
      for (const dependencyName of PACKAGES) {
        if (!pkg.dependencies[`@excalidraw/${dependencyName}`]) {
          continue;
        }

        pkg.dependencies[`@excalidraw/${dependencyName}`] = nextVersion;
      }
    }

    packageJsons.set(packageName, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  // modify once, to avoid inconsistent state
  for (const packageName of PACKAGES) {
    const content = packageJsons.get(packageName);
    fs.writeFileSync(getPackageJsonPath(packageName), content, "utf-8");
  }
};

const getParams = () => {
  // tag: test (default), next (~autorelease), latest (~stable release)
  // version: 20.0.0 for latest, nothing for next and test
  // ci: true or false, default is false
  let [tag, version, ci] = process.argv.slice(2);

  if (!tag) {
    // test is default tag
    tag = "test";
  }

  if (tag !== "latest" && tag !== "next" && tag !== "test") {
    console.error(`Unsupported tag "${tag}", use "latest", "next" or "test".`);
    process.exit(1);
  }

  if (tag === "latest" && !version) {
    console.error("Pass the version to make the latest stable release!");
    process.exit(1);
  }

  if (tag !== "latest" && version) {
    console.error(`Do not pass the version for tag "${tag}".`);
    process.exit(1);
  }

  if (!version || version === "-") {
    // set the next version based on the excalidraw package version + commit hash
    const excalidrawPackageVersion = require(getPackageJsonPath(
      "excalidraw",
    )).version;

    const hash = getShortCommitHash();

    // ensuring idempotency
    if (!excalidrawPackageVersion.includes("hash")) {
      version = `${excalidrawPackageVersion}-${hash}`;
    }
  }

  console.info(`Running with tag "${tag}" and version "${version}"...`);

  return [tag, version, !!ci];
};

const getShortCommitHash = () => {
  return execSync("git rev-parse --short HEAD").toString().trim();
};

const askToCommit = (tag, ci, nextVersion) => {
  if (tag !== "latest") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Do you want to commit these changes? (Y/n): ", (answer) => {
      rl.close();

      if (answer.toLowerCase() === "y") {
        execSync(`git add -u`);
        execSync(
          `git commit -m "docs: release @excalidraw/excalidraw@${nextVersion}  🎉"`,
        );
      } else {
        console.warn("Skipping commit. Don't forget to commit manually later!");
      }

      resolve();
    });
  });
};

const buildPackages = () => {
  console.info("Running yarn install...");
  execSync(`yarn --frozen-lockfile`);

  console.info("Removing existing build artifacts...");
  execSync(`yarn rm:build`);

  console.info("Building packages...");
  for (const packageName of PACKAGES) {
    execSync(`yarn run build:esm`, {
      cwd: path.resolve(`${PACKAGES_DIR}/${packageName}`),
    });
  }
};

const askToPublish = (tag, version) => {
  return new Promise((resolve) => {
    const rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Do you want to publish these changes? (Y/n): ", (answer) => {
      rl.close();

      if (answer.toLowerCase() === "y") {
        publishPackages(tag);
      } else {
        console.info("Skipping publish.");
      }

      resolve();
    });
  });
};

const publishPackages = (tag, version) => {
  // for (const packageName of PACKAGES) {
  //   execSync(`yarn --cwd ${PACKAGES_DIR}/${packageName} publish --tag ${tag}`);
  //   console.info(
  //     `Published "@excalidraw/${packageName}@${version}" with tag "${tag}" 🎉`,
  //   );
  // }
};

/** main */
(async () => {
  const [tag, version, ci] = getParams();

  buildPackages();

  if (tag === "latest") {
    updateChangelog(version);
  }

  updatePackageJsons(version);

  if (!ci) {
    await askToCommit(tag, version);
    await askToPublish(tag);
  } else {
    publishPackages(tag);
  }
})();
