/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const configPath = path.join(process.cwd(), ".size-limit.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

function findFiles(basePath, pattern) {
  const results = [];

  const parts = pattern.split("/");
  let recursive = false;
  const dirParts = [];
  let filePattern = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === "**") {
      recursive = true;
    } else if (i === parts.length - 1) {
      filePattern = part;
    } else {
      dirParts.push(part);
      if (part.endsWith("**")) {
        recursive = true;
        dirParts[dirParts.length - 1] = part.slice(0, -2);
      }
    }
  }

  while (dirParts.length > 0 && dirParts[dirParts.length - 1] === "**") {
    dirParts.pop();
    recursive = true;
  }

  function fileMatches(name, pattern) {
    if (pattern === null || pattern === "**" || pattern === "*") {
      return true;
    }
    if (pattern.startsWith("*.")) {
      return name.endsWith(pattern.slice(1));
    }
    if (pattern.startsWith("*")) {
      return name.endsWith(pattern.slice(1));
    }
    return name === pattern;
  }

  function walkDir(dir, out) {
    if (!fs.existsSync(dir)) {
      return;
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive) {
          walkDir(fullPath, out);
        }
      } else if (entry.isFile()) {
        if (fileMatches(entry.name, filePattern)) {
          out.push(fullPath);
        }
      }
    }
  }

  const searchDir = path.join(basePath, dirParts.join("/"));
  walkDir(searchDir, results);

  return results;
}

function parseLimit(limit) {
  const match = limit.match(/([\d.]+)\s*(kB|MB|GB|B)?/i);
  if (!match) {
    return 0;
  }
  const value = parseFloat(match[1]);
  const unit = (match[2] || "B").toUpperCase();
  const multipliers = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
  return Math.round(value * (multipliers[unit] || 1));
}

const results = [];
let failed = false;

for (const check of config) {
  const { path: globPattern, limit } = check;
  const basePath = process.cwd();
  const files = findFiles(basePath, globPattern);

  let totalSize = 0;
  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      totalSize += stat.size;
    } catch (e) {
      // ignore missing files
    }
  }

  const sizeLimit = parseLimit(limit);
  const passed = totalSize <= sizeLimit;

  results.push({
    name: globPattern,
    size: totalSize,
    running: 0,
    loading: 0,
    passed,
  });

  if (!passed) {
    failed = true;
  }
}

fs.writeFileSync(
  path.join(process.cwd(), ".size-limit-report.json"),
  JSON.stringify(results, null, 2),
);

console.log(JSON.stringify(results, null, 2));

if (failed) {
  process.exit(1);
}
