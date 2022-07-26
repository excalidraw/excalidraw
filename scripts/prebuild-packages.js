#!/usr/bin/env node

// Run this script from `src/packages/*/`
const fs = require("fs");
const path = require("path");
const { argv, exit } = require("process");

if (argv.length < 3) {
  console.error("Must provide package name");
  exit(1);
}
const pkg = argv[2];

// What we iterate over to link
const bins = ["cross-env", "tsc", "webpack"];

// Directories
const dirsA = ["packages"];
const dirsB = ["node_modules", ".bin"];
const dots = ["..", ".."];
const targetDir = path.join(...dots, ...dirsB);

// Iteratively create symlinks in the specified package's node bin directory
// to the necessary bin files located in the common `src/packages` node bin
// directory.

const pkgPath = path.join(...dots, ...dirsA, pkg, ...dirsB);
if (!fs.existsSync(pkgPath)) {
  fs.mkdir(pkgPath, { recursive: true }, (e) => e && console.info(e));
}
for (const j in bins) {
  const binPath = path.join(pkgPath, bins[j]);
  const targetBin = path.join("..", targetDir, bins[j]);
  if (!fs.existsSync(binPath)) {
    fs.symlink(targetBin, binPath, "file", (e) => e && console.info(e));
  }
}
