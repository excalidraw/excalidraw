const fs = require("fs");
const path = require("path");

const { execSync } = require("child_process");

const PACKAGES = [
  "common",
  "fractional-indexing",
  "math",
  "element",
  "excalidraw",
];
const PACKAGES_DIR = path.resolve(__dirname, "../packages");
const OUT_DIR = path.resolve(__dirname, "../release");
const REPO = "redaphid/excalidraw";

const version = process.argv
  .find((argument) => argument.startsWith("--version="))
  ?.split("=")[1];

if (!version) {
  console.error(
    "Usage: node scripts/pack-draw-release.js --version=0.19.0-draw.N",
  );
  process.exit(1);
}

const packageJsonPath = (packageName) =>
  path.resolve(PACKAGES_DIR, packageName, "package.json");

const tarballName = (packageName) => `excalidraw-${packageName}-${version}.tgz`;

const tarballUrl = (packageName) =>
  `https://github.com/${REPO}/releases/download/v${version}/${tarballName(
    packageName,
  )}`;

const readPackageJson = (packageName) =>
  JSON.parse(fs.readFileSync(packageJsonPath(packageName), "utf-8"));

const writePackageJson = (packageName, pkg) =>
  fs.writeFileSync(
    packageJsonPath(packageName),
    `${JSON.stringify(pkg, null, 2)}\n`,
    "utf-8",
  );

const withInternalDependencies = (pkg, toSpecifier) => {
  if (!pkg.dependencies) {
    return pkg;
  }
  const dependencies = { ...pkg.dependencies };
  for (const packageName of PACKAGES) {
    if (!dependencies[`@excalidraw/${packageName}`]) {
      continue;
    }
    dependencies[`@excalidraw/${packageName}`] = toSpecifier(packageName);
  }
  return { ...pkg, dependencies };
};

// The committed package.jsons keep plain versions so the yarn workspace
// resolves locally; only the packed copies point at the release tarballs,
// since these versions are never published to npm.
for (const packageName of PACKAGES) {
  const pkg = withInternalDependencies(
    { ...readPackageJson(packageName), version },
    () => version,
  );
  writePackageJson(packageName, pkg);
}

execSync("yarn --frozen-lockfile", { stdio: "inherit" });
execSync("yarn rm:build", { stdio: "inherit" });
for (const packageName of PACKAGES) {
  execSync("yarn run build:esm", {
    cwd: path.resolve(PACKAGES_DIR, packageName),
    stdio: "inherit",
  });
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR);
for (const packageName of PACKAGES) {
  const committed = readPackageJson(packageName);
  writePackageJson(
    packageName,
    withInternalDependencies(committed, tarballUrl),
  );
  try {
    execSync(
      `yarn pack --filename ${path.resolve(OUT_DIR, tarballName(packageName))}`,
      { cwd: path.resolve(PACKAGES_DIR, packageName), stdio: "inherit" },
    );
  } finally {
    writePackageJson(packageName, committed);
  }
}
