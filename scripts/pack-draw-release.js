const fs = require("fs");
const os = require("os");
const path = require("path");

const { execSync } = require("child_process");

// macOS tar otherwise adds an AppleDouble ._ file beside every packed file.
process.env.COPYFILE_DISABLE = "1";

const PACKAGES = [
  "common",
  "fractional-indexing",
  "math",
  "element",
  "excalidraw",
];
const PACKAGES_DIR = path.resolve(__dirname, "../packages");
const OUT_DIR = path.resolve(__dirname, "../release");

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

const readPackageJson = (packageName) =>
  JSON.parse(fs.readFileSync(packageJsonPath(packageName), "utf-8"));

const writePackageJson = (packageName, pkg) =>
  fs.writeFileSync(
    packageJsonPath(packageName),
    `${JSON.stringify(pkg, null, 2)}\n`,
    "utf-8",
  );

const setInternalDependencies = (pkg) => {
  if (!pkg.dependencies) {
    return pkg;
  }
  const dependencies = { ...pkg.dependencies };
  for (const packageName of PACKAGES) {
    if (!dependencies[`@excalidraw/${packageName}`]) {
      continue;
    }
    dependencies[`@excalidraw/${packageName}`] = version;
  }
  return { ...pkg, dependencies };
};

for (const packageName of PACKAGES) {
  writePackageJson(
    packageName,
    setInternalDependencies({ ...readPackageJson(packageName), version }),
  );
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
  execSync(
    `yarn pack --filename ${path.resolve(OUT_DIR, tarballName(packageName))}`,
    { cwd: path.resolve(PACKAGES_DIR, packageName), stdio: "inherit" },
  );
}

// These versions are never published to npm, so a consumer cannot resolve
// the sibling packages. The excalidraw tarball carries them as bundled
// dependencies instead, which package managers install without resolving.
const staging = fs.mkdtempSync(path.join(os.tmpdir(), "excalidraw-pack-"));
execSync(`tar -xzf ${tarballName("excalidraw")} -C ${staging}`, {
  cwd: OUT_DIR,
});
const siblings = PACKAGES.filter((packageName) => packageName !== "excalidraw");
const excalidraw = JSON.parse(
  fs.readFileSync(path.join(staging, "package/package.json"), "utf-8"),
);
const dependencies = { ...excalidraw.dependencies };
for (const packageName of siblings) {
  const target = path.join(
    staging,
    "package/node_modules/@excalidraw",
    packageName,
  );
  fs.mkdirSync(target, { recursive: true });
  execSync(
    `tar -xzf ${tarballName(packageName)} --strip-components=1 -C ${target}`,
    { cwd: OUT_DIR },
  );
  const sibling = JSON.parse(
    fs.readFileSync(path.join(target, "package.json"), "utf-8"),
  );
  for (const [name, specifier] of Object.entries(sibling.dependencies ?? {})) {
    if (name.startsWith("@excalidraw/")) {
      continue;
    }
    dependencies[name] = specifier;
  }
  dependencies[`@excalidraw/${packageName}`] = version;
}
fs.writeFileSync(
  path.join(staging, "package/package.json"),
  `${JSON.stringify(
    {
      ...excalidraw,
      dependencies,
      bundleDependencies: siblings.map(
        (packageName) => `@excalidraw/${packageName}`,
      ),
    },
    null,
    2,
  )}\n`,
  "utf-8",
);
execSync(
  `tar -czf ${path.resolve(
    OUT_DIR,
    tarballName("excalidraw"),
  )} -C ${staging} package`,
);
fs.rmSync(staging, { recursive: true, force: true });
