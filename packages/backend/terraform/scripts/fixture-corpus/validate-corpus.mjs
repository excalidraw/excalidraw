#!/usr/bin/env node
/**
 * Validate .corpus/ exports: meta present, plan/dot paired, optional expect checks.
 *
 *   node validate-corpus.mjs [--case case-042]
 */
import fs from "node:fs";
import path from "node:path";

import { CORPUS_DIR, MANIFEST_PATH } from "./paths.mjs";
import { countActions } from "./plan-hash.mjs";

function parseArgs(argv) {
  const opts = { case: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--case" && argv[i + 1]) {
      opts.case = argv[++i];
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      opts.help = true;
    }
  }
  return opts;
}

function checkExpect(expect, counts) {
  if (!expect) {
    return null;
  }
  const totalCreates = counts.create;
  const totalDeletes = counts.delete;
  const totalUpdates = counts.update;
  const totalNoops = counts["no-op"];

  if (expect.createsMin != null && totalCreates < expect.createsMin) {
    return `creates ${totalCreates} < min ${expect.createsMin}`;
  }
  if (expect.createsMax != null && totalCreates > expect.createsMax) {
    return `creates ${totalCreates} > max ${expect.createsMax}`;
  }
  if (expect.deletesMin != null && totalDeletes < expect.deletesMin) {
    return `deletes ${totalDeletes} < min ${expect.deletesMin}`;
  }
  if (expect.deletesMax != null && totalDeletes > expect.deletesMax) {
    return `deletes ${totalDeletes} > max ${expect.deletesMax}`;
  }
  if (expect.updatesMin != null && totalUpdates < expect.updatesMin) {
    return `updates ${totalUpdates} < min ${expect.updatesMin}`;
  }
  if (expect.noopsMin != null && totalNoops < expect.noopsMin) {
    return `no-ops ${totalNoops} < min ${expect.noopsMin}`;
  }
  return null;
}

function validateCase(testCase) {
  const caseDir = path.join(CORPUS_DIR, testCase.id);
  const planPath = path.join(caseDir, "plan.json");
  const dotPath = path.join(caseDir, "graph.dot");
  const metaPath = path.join(caseDir, "meta.json");

  if (!fs.existsSync(planPath)) {
    return `missing plan.json (run yarn fixtures:corpus)`;
  }
  if (!fs.existsSync(dotPath)) {
    return `missing graph.dot`;
  }
  if (!fs.existsSync(metaPath)) {
    return `missing meta.json`;
  }

  const planText = fs.readFileSync(planPath, "utf8");
  let plan;
  try {
    plan = JSON.parse(planText);
  } catch {
    return `invalid plan.json`;
  }

  if (!plan.format_version) {
    return `plan.json missing format_version`;
  }
  if (!Array.isArray(plan.resource_changes)) {
    return `plan.json missing resource_changes`;
  }

  const counts = countActions(plan);
  const expectErr = checkExpect(testCase.expect, counts);
  if (expectErr) {
    return expectErr;
  }

  return null;
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log("Usage: validate-corpus.mjs [--case id]");
    process.exit(0);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  let cases = manifest.cases;
  if (opts.case) {
    cases = cases.filter((c) => c.id === opts.case);
  }

  let failed = 0;
  for (const c of cases) {
    const err = validateCase(c);
    if (err) {
      console.error(`FAIL ${c.id}: ${err}`);
      failed++;
    } else if (fs.existsSync(path.join(CORPUS_DIR, c.id, "plan.json"))) {
      console.log(`ok   ${c.id}`);
    } else {
      console.log(`skip ${c.id} (not generated)`);
    }
  }

  if (failed) {
    process.exit(1);
  }
}

main();
