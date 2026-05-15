#!/usr/bin/env node
/**
 * Compose main.workload.tf from a preset (and optional patch).
 *
 *   node compose-main.mjs --preset 50-full
 *   node compose-main.mjs --preset 50-full-no-monitoring --patch patches/foo.tfpart
 */
import fs from "node:fs";
import path from "node:path";

import { PRESETS_DIR, WORKLOAD_TF } from "./paths.mjs";

function parseArgs(argv) {
  const opts = { preset: null, patch: null, out: WORKLOAD_TF };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--preset" && argv[i + 1]) {
      opts.preset = argv[++i];
    } else if (a === "--patch" && argv[i + 1]) {
      opts.patch = argv[++i];
    } else if (a === "--out" && argv[i + 1]) {
      opts.out = path.resolve(argv[++i]);
    } else if (a === "--help" || a === "-h") {
      opts.help = true;
    }
  }
  return opts;
}

function readPart(name) {
  const base = name.endsWith(".tfpart") ? name : `${name}.tfpart`;
  const file = path.join(PRESETS_DIR, base);
  if (!fs.existsSync(file)) {
    throw new Error(`Preset not found: ${file}`);
  }
  return fs.readFileSync(file, "utf8");
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help || !opts.preset) {
    console.log(`Usage: compose-main.mjs --preset <name> [--patch <file>] [--out path]`);
    process.exit(opts.help ? 0 : 1);
  }

  const header = `# Composed by fixture-corpus/compose-main.mjs\n# preset: ${opts.preset}\n\n`;
  let body = readPart(opts.preset);
  if (opts.patch) {
    const patchPath = path.isAbsolute(opts.patch)
      ? opts.patch
      : path.join(PRESETS_DIR, opts.patch);
    body += `\n${fs.readFileSync(patchPath, "utf8")}`;
  }

  fs.writeFileSync(opts.out, header + body);
  console.log(`Wrote ${opts.out} (preset=${opts.preset})`);
}

main();
