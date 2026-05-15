#!/usr/bin/env node
/**
 * Phase 2: run checkpoint-plan recipes (plan-only against frozen state).
 *
 *   node run-recipes.mjs [--jobs 8] [--case case-042] [--force]
 *   node run-recipes.mjs --serial [--continue-on-error] [--skip-missing-state]
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { composeMain } from "./lib-compose.mjs";
import { accountIdFromStateFile } from "./lib-state.mjs";
import { prepareTerraformRoot } from "./lib-tf-root.mjs";
import {
  CORPUS_DIR,
  MANIFEST_PATH,
  PRESETS_DIR,
  STATES_DIR,
  TF_BIN,
} from "./paths.mjs";
import { countActions, planChangesFingerprint } from "./plan-hash.mjs";
import { createLogger } from "./logger.mjs";

function parseArgs(argv) {
  const opts = {
    jobs: 4,
    case: null,
    force: false,
    serial: false,
    failFast: false,
    continueOnError: false,
    skipMissingState: false,
    limit: null,
    checkpoint: null,
    cleanTf: true,
    logFile: null,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--jobs" && argv[i + 1]) {
      opts.jobs = Math.max(1, Number(argv[++i]) || 4);
    } else if (a === "--case" && argv[i + 1]) {
      opts.case = argv[++i];
    } else if (a === "--force") {
      opts.force = true;
    } else if (a === "--serial") {
      opts.serial = true;
      opts.jobs = 1;
      opts.failFast = true;
    } else if (a === "--fail-fast") {
      opts.failFast = true;
    } else if (a === "--continue-on-error") {
      opts.continueOnError = true;
      opts.failFast = false;
    } else if (a === "--skip-missing-state") {
      opts.skipMissingState = true;
    } else if (a === "--limit" && argv[i + 1]) {
      opts.limit = Math.max(1, Number(argv[++i]) || 1);
    } else if (a === "--checkpoint" && argv[i + 1]) {
      opts.checkpoint = argv[++i];
    } else if (a === "--no-clean-tf") {
      opts.cleanTf = false;
    } else if (a === "--log-file" && argv[i + 1]) {
      opts.logFile = path.resolve(argv[++i]);
    } else if (a === "--help" || a === "-h") {
      opts.help = true;
    }
  }
  if (opts.continueOnError) {
    opts.failFast = false;
  }
  return opts;
}

function run(cmd, args, cwd, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(`${cmd} ${args.join(" ")} failed (${code}):\n${stderr}`),
        );
      }
    });
  });
}

function removeTerraformWorkdir(caseDir) {
  const tfRoot = path.join(caseDir, "tf");
  if (fs.existsSync(tfRoot)) {
    fs.rmSync(tfRoot, { recursive: true, force: true });
  }
}

async function runCase(testCase, opts, log) {
  const tCase = Date.now();
  const idx =
    opts.caseIndex != null && opts.caseTotal != null
      ? ` progress=${opts.caseIndex}/${opts.caseTotal}`
      : "";
  const caseDir = path.join(CORPUS_DIR, testCase.id);
  const stateFile = path.join(STATES_DIR, `${testCase.stateCheckpoint}.json`);
  if (!fs.existsSync(stateFile)) {
    if (opts.skipMissingState) {
      log?.info(
        `SKIP ${testCase.id}${idx} reason=missing_state checkpoint=${testCase.stateCheckpoint}`,
      );
      return {
        skipped: true,
        id: testCase.id,
        reason: `missing state ${testCase.stateCheckpoint}`,
      };
    }
    throw new Error(`Missing ${stateFile}. Run: yarn fixtures:bootstrap`);
  }

  if (
    !testCase.force &&
    fs.existsSync(path.join(caseDir, "plan.json")) &&
    fs.existsSync(path.join(caseDir, "meta.json"))
  ) {
    log?.info(
      `SKIP ${testCase.id}${idx} reason=already_generated preset=${testCase.preset}`,
    );
    return { skipped: true, id: testCase.id, reason: "already generated" };
  }

  log?.info(
    `BEGIN ${testCase.id}${idx} preset=${testCase.preset} state=${testCase.stateCheckpoint}`,
  );

  fs.mkdirSync(caseDir, { recursive: true });

  const workloadPath = path.join(caseDir, "main.workload.tf");
  composeMain({ preset: testCase.preset, out: workloadPath });

  const tfRoot = prepareTerraformRoot(caseDir, {
    workloadPath,
    statePath: stateFile,
  });

  const accountId = accountIdFromStateFile(stateFile);
  if (!accountId) {
    throw new Error(
      `Could not read aws_account_id from ${stateFile}. Set AWS_ACCOUNT_ID or bootstrap with caller identity in state.`,
    );
  }

  const varArgs = [
    "-var",
    `aws_account_id=${accountId}`,
    ...(testCase.tfvars || []).flatMap((v) => [
      "-var-file",
      path.join(PRESETS_DIR, "vars", v.endsWith(".tfvars") ? v : `${v}.tfvars`),
    ]),
  ];

  const refreshFlag = testCase.refresh ? [] : ["-refresh=false"];
  const planBin = path.join(caseDir, "plan.bin");

  await run(TF_BIN, ["init", "-input=false", "-no-color"], tfRoot);

  await run(
    TF_BIN,
    [
      "plan",
      ...refreshFlag,
      "-input=false",
      "-no-color",
      "-out",
      planBin,
      ...varArgs,
    ],
    tfRoot,
  );

  const { stdout: planJson } = await run(
    TF_BIN,
    ["show", "-json", planBin],
    tfRoot,
  );
  fs.writeFileSync(path.join(caseDir, "plan.json"), planJson);

  const { stdout: dot } = await run(
    TF_BIN,
    ["graph", `-plan=${planBin}`],
    tfRoot,
  );
  fs.writeFileSync(path.join(caseDir, "graph.dot"), dot);

  const fingerprint = planChangesFingerprint(planJson);
  const actionCounts = countActions(planJson);

  const meta = {
    id: testCase.id,
    title: testCase.title,
    preset: testCase.preset,
    stateCheckpoint: testCase.stateCheckpoint,
    tfvars: testCase.tfvars || [],
    fingerprint,
    actionCounts,
    durationMs: Date.now() - tCase,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(caseDir, "meta.json"), JSON.stringify(meta, null, 2));

  if (opts.cleanTf) {
    removeTerraformWorkdir(caseDir);
  }

  log?.info(
    `END   ${testCase.id}${idx} ok duration=${log.elapsed(tCase)} creates=${actionCounts.create} updates=${actionCounts.update} deletes=${actionCounts.delete} noops=${actionCounts["no-op"]} fingerprint=${fingerprint.slice(0, 12)}…`,
  );

  return { skipped: false, id: testCase.id, fingerprint, actionCounts };
}

async function pool(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

async function runSerial(cases, runOpts, { failFast, log }) {
  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    try {
      const r = await runCase(
        c,
        {
          ...runOpts,
          caseIndex: i + 1,
          caseTotal: cases.length,
        },
        log,
      );
      results.push(r);
    } catch (e) {
      log.error(
        `FAIL ${c.id} index=${i + 1}/${cases.length}: ${e.message}`,
      );
      results.push({ error: e.message, id: c.id });
      if (failFast) {
        log.warn(
          `Stopped after ${c.id} (--serial / --fail-fast). Remaining ${cases.length - i - 1} cases not run.`,
        );
        break;
      }
    }
  }
  return results;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(`Usage: run-recipes.mjs [options]

Options:
  --jobs N                 Parallel workers (default 4)
  --serial                 Run one case at a time; stop on first failure
  --continue-on-error      With --serial: keep going after failures
  --skip-missing-state     Skip cases whose checkpoint state file is absent
  --case id                Single case only
  --limit N                Run at most N cases (manifest order, after filters)
  --checkpoint state_070   Only cases that use this checkpoint file
  --no-clean-tf            Keep case-NNN/tf/ after each run (providers; for debugging)
  --log-file path          Also append to this file (or set FIXTURES_LOG_FILE)
  --force                  Regenerate even if plan.json exists
`);
    process.exit(0);
  }

  const log = createLogger({
    logFile: opts.logFile || process.env.FIXTURES_LOG_FILE || undefined,
  });
  const tRun = Date.now();

  try {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  let cases = manifest.cases;
  if (opts.case) {
    cases = cases.filter((c) => c.id === opts.case);
    if (!cases.length) {
      throw new Error(`Unknown case: ${opts.case}`);
    }
  }

  if (opts.checkpoint) {
    const ck = opts.checkpoint.replace(/\.json$/, "");
    cases = cases.filter((c) => c.stateCheckpoint === ck);
    if (!cases.length) {
      throw new Error(`No manifest cases use stateCheckpoint ${ck}`);
    }
  }

  const totalInManifest = cases.length;
  if (opts.limit != null) {
    cases = cases.slice(0, opts.limit);
  }

  fs.mkdirSync(CORPUS_DIR, { recursive: true });
  fs.mkdirSync(STATES_DIR, { recursive: true });

  const stateFiles = fs
    .readdirSync(STATES_DIR)
    .filter((f) => f.endsWith(".json"));
  if (stateFiles.length) {
    log.info(
      `Checkpoints on disk: ${stateFiles.map((f) => f.replace(/\.json$/, "")).join(", ")}`,
    );
  } else {
    log.warn(
      "No checkpoint states in fixtures/states/. Run: yarn fixtures:bootstrap  or  yarn fixtures:seed-state-070",
    );
  }

  const withForce = cases.map((c) => ({ ...c, force: opts.force }));
  const mode = opts.serial ? "serial" : `parallel jobs=${opts.jobs}`;
  const limitNote =
    opts.limit != null && totalInManifest > withForce.length
      ? ` (limit ${opts.limit} of ${totalInManifest})`
      : "";
  const checkpointNote = opts.checkpoint ? ` checkpoint=${opts.checkpoint}` : "";
  log.info(
    `RUN run-recipes${limitNote}${checkpointNote} (${mode}) caseCount=${withForce.length} tf=${TF_BIN}` +
      (log.logFile ? ` logFile=${log.logFile}` : ""),
  );

  const runOpts = {
    skipMissingState: opts.skipMissingState,
    cleanTf: opts.cleanTf,
  };

  const results = opts.serial
    ? await runSerial(withForce, runOpts, { failFast: opts.failFast, log })
    : await pool(withForce, opts.jobs, async (c, i) => {
        try {
          const r = await runCase(
            c,
            {
              ...runOpts,
              caseIndex: i + 1,
              caseTotal: withForce.length,
            },
            log,
          );
          return r;
        } catch (e) {
          log.error(
            `FAIL ${c.id} progress=${i + 1}/${withForce.length}: ${e.message}`,
          );
          return { error: e.message, id: c.id };
        }
      });

  const failed = results.filter((r) => r?.error);
  const ran = results.filter((r) => r && !r.skipped && !r.error);
  const skipped = results.filter((r) => r?.skipped);
  log.info(
    `SUMMARY ok=${ran.length} skipped=${skipped.length} failed=${failed.length} wall=${log.elapsed(tRun)}`,
  );
  if (failed.length) {
    log.error(`Failed IDs: ${failed.map((r) => r.id).join(", ")}`);
  }

  if (ran.length === 0 && skipped.length > 0 && failed.length === 0) {
    log.error(
      "All cases were skipped (missing checkpoint state or already generated). If you only have state_070: yarn fixtures:seed-state-070  then add --checkpoint state_070",
    );
    process.exitCode = 1;
  }
  if (failed.length) {
    process.exitCode = 1;
  }
  } finally {
    log.close();
  }
  if (process.exitCode === 1) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
