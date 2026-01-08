#!/usr/bin/env node

/**
 * Build script for Electron files (main.ts and preload.ts)
 * Compiles TypeScript to JavaScript in the electron directory
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const electronDir = path.join(__dirname, "../electron");
const tsConfigPath = path.join(electronDir, "tsconfig.json");

console.log("Building Electron files...");

try {
  // Compile TypeScript files in electron directory
  execSync(`npx tsc --project ${tsConfigPath}`, {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });

  console.log("✓ Electron files compiled successfully");
} catch (error) {
  console.error("✗ Failed to compile Electron files");
  process.exit(1);
}
