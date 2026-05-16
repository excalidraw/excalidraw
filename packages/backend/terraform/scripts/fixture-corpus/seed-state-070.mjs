#!/usr/bin/env node
/** Copy legacy terraform_allplanmodules.tfstate → fixtures/states/state_070.json if present. */
import fs from "node:fs";
import path from "node:path";

import { STATES_DIR, TERRAFORM_ROOT } from "./paths.mjs";

const legacy = path.join(TERRAFORM_ROOT, "terraform_allplanmodules.tfstate");
const dest = path.join(STATES_DIR, "state_070.json");

if (!fs.existsSync(legacy)) {
  console.error(`Not found: ${legacy}`);
  process.exit(1);
}

fs.mkdirSync(STATES_DIR, { recursive: true });
fs.copyFileSync(legacy, dest);
console.log(`Copied → ${dest}`);
