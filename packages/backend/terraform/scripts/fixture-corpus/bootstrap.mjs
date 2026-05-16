#!/usr/bin/env node
/**
 * Phase 1: serial bootstrap applies → fixtures/states/state_XXX.json
 *
 *   node bootstrap.mjs [--destroy-after]
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { composeMain } from "./lib-compose.mjs";
import { accountIdFromStateFile } from "./lib-state.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
import {
  BOOTSTRAP_STEPS,
  PRESETS_DIR,
  STATES_DIR,
  TERRAFORM_ROOT,
  TF_BIN,
  WORKLOAD_TF,
} from "./paths.mjs";

function terraformVarArgs(accountId, extra = []) {
  const args = [];
  if (accountId) {
    args.push("-var", `aws_account_id=${accountId}`);
  }
  for (const f of extra) {
    args.push("-var-file", f);
  }
  return args;
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} failed with ${code}`));
      }
    });
  });
}

async function main() {
  const destroyAfter = process.argv.includes("--destroy-after");

  fs.mkdirSync(STATES_DIR, { recursive: true });

  await run("node", [path.join(SCRIPT_DIR, "build-manifest.mjs")], TERRAFORM_ROOT);

  console.log(`Bootstrap in ${TERRAFORM_ROOT}`);
  console.log(`States -> ${STATES_DIR}`);
  if (destroyAfter) {
    console.log("Teardown: full destroy after checkpoints (--destroy-after)\n");
  } else {
    console.log("Warning: resources stay in AWS. Prefer: yarn fixtures:bootstrap:destroy\n");
  }

  let accountId =
    process.env.AWS_ACCOUNT_ID || process.env.TF_VAR_aws_account_id || null;

  for (let i = 0; i < BOOTSTRAP_STEPS.length; i++) {
    const step = BOOTSTRAP_STEPS[i];
    console.log(
      `==> [${i + 1}/${BOOTSTRAP_STEPS.length}] ${step.checkpoint} (${step.title}) preset=${step.preset}`,
    );

    composeMain({ preset: step.preset, out: WORKLOAD_TF });

    await run(TF_BIN, ["init", "-input=false", "-no-color"], TERRAFORM_ROOT);

    const planBin = path.join(STATES_DIR, `${step.checkpoint}.plan.bin`);
    const varArgs = terraformVarArgs(accountId);
    await run(
      TF_BIN,
      ["plan", "-input=false", "-no-color", "-out", planBin, ...varArgs],
      TERRAFORM_ROOT,
    );

    // Saved plan carries variable values — do not pass -var/-var-file (CLI error:
    // "Too many command line arguments" / invalid with plan file).
    console.log("    Applying…");
    await run(TF_BIN, ["apply", "-input=false", "-no-color", planBin], TERRAFORM_ROOT);

    const stateOut = path.join(STATES_DIR, `${step.checkpoint}.json`);
    const child = spawn(TF_BIN, ["state", "pull"], {
      cwd: TERRAFORM_ROOT,
      stdio: ["ignore", "pipe", "inherit"],
    });
    const chunks = [];
    child.stdout.on("data", (d) => chunks.push(d));
    await new Promise((resolve, reject) => {
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error("state pull failed"))));
    });
    fs.writeFileSync(stateOut, Buffer.concat(chunks));
    console.log(`    Saved ${stateOut}`);
    accountId = accountId || accountIdFromStateFile(stateOut);
    console.log("");
  }

  if (destroyAfter) {
    console.log("==> Destroying all workload resources in AWS…");
    const albOff = path.join(PRESETS_DIR, "vars", "alb-deletion-off.tfvars");
    const varArgs = terraformVarArgs(accountId, [albOff]);
    // Disable ALB deletion protection while full stack is still in config.
    composeMain({ preset: "50-full", out: WORKLOAD_TF });
    await run(
      TF_BIN,
      ["apply", "-input=false", "-no-color", "-auto-approve", ...varArgs],
      TERRAFORM_ROOT,
    ).catch((e) => {
      console.warn("    (apply before destroy warning)", e.message);
    });
    // Shrink config to artifacts-only so destroy removes every workload module.
    composeMain({ preset: "00-artifacts-only", out: WORKLOAD_TF });
    await run(
      TF_BIN,
      ["destroy", "-input=false", "-no-color", "-auto-approve", ...varArgs],
      TERRAFORM_ROOT,
    );
    console.log(
      "    Live workload torn down. Checkpoint JSON kept under fixtures/states/",
    );
    console.log(
      "    (Deployment artifact bucket from artifacts.tf may remain — delete manually if needed.)",
    );
  }

  console.log("Bootstrap complete. Next: yarn fixtures:corpus");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
