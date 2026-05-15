#!/usr/bin/env node
/** Emit fixtures/manifest.json with 100 checkpoint-plan recipes. */
import fs from "node:fs";
import path from "node:path";

import { BOOTSTRAP_STEPS, MANIFEST_PATH } from "./paths.mjs";

function caseRow(id, row) {
  return {
    id: `case-${String(id).padStart(3, "0")}`,
    recipe: "checkpoint-plan",
    refresh: false,
    ...row,
  };
}

function buildCases() {
  const cases = [];
  let n = 1;

  const presetsGreenfield = [
    "10-storage",
    "20-queue",
    "30-network",
    "35-writer",
    "40-writer-alb",
    "45-reader",
    "50-full",
    "50-full-no-monitoring",
  ];
  for (const preset of presetsGreenfield) {
    cases.push(
      caseRow(n++, {
        title: `greenfield from state_000 → ${preset}`,
        stateCheckpoint: "state_000",
        preset,
        tags: ["greenfield"],
        expect: { createsMin: 1 },
      }),
    );
  }

  const checkpoints = BOOTSTRAP_STEPS.map((s) => s.checkpoint);
  const forward = [
    { from: "state_000", preset: "10-storage" },
    { from: "state_010", preset: "20-queue" },
    { from: "state_010", preset: "30-network" },
    { from: "state_020", preset: "30-network" },
    { from: "state_020", preset: "35-writer" },
    { from: "state_030", preset: "35-writer" },
    { from: "state_030", preset: "40-writer-alb" },
    { from: "state_040", preset: "40-writer-alb" },
    { from: "state_040", preset: "45-reader" },
    { from: "state_050", preset: "45-reader" },
    { from: "state_050", preset: "50-full" },
    { from: "state_060", preset: "50-full" },
    { from: "state_060", preset: "50-full-no-monitoring" },
    { from: "state_070", preset: "50-full" },
  ];
  for (const f of forward) {
    cases.push(
      caseRow(n++, {
        title: `incremental add ${f.from} → ${f.preset}`,
        stateCheckpoint: f.from,
        preset: f.preset,
        tags: ["add"],
        expect: { createsMin: 1 },
      }),
    );
  }

  const shrinkTargets = [
    { from: "state_070", preset: "50-full-no-monitoring", tags: ["del"], expect: { deletesMin: 1 } },
    { from: "state_070", preset: "45-reader-no-writer", tags: ["del", "mixed"], expect: { deletesMin: 1 } },
    { from: "state_070", preset: "45-reader", tags: ["del"], expect: { deletesMin: 1 } },
    { from: "state_070", preset: "40-writer-alb", tags: ["del"], expect: { deletesMin: 1 } },
    { from: "state_070", preset: "35-writer", tags: ["del"], expect: { deletesMin: 1 } },
    { from: "state_070", preset: "30-network-only", tags: ["del"], expect: { deletesMin: 1 } },
    { from: "state_070", preset: "20-queue-only", tags: ["del"], expect: { deletesMin: 1 } },
    { from: "state_070", preset: "10-storage-only", tags: ["del"], expect: { deletesMin: 1 } },
    { from: "state_070", preset: "00-artifacts-only", tags: ["del"], expect: { deletesMin: 1 } },
    { from: "state_060", preset: "45-reader", tags: ["add"], expect: { createsMin: 1 } },
    { from: "state_050", preset: "40-writer-alb", tags: ["add"], expect: { createsMin: 1 } },
    { from: "state_040", preset: "35-writer", tags: ["add"], expect: { createsMin: 1 } },
    { from: "state_030", preset: "30-network", tags: ["add"], expect: { createsMin: 1 } },
    { from: "state_020", preset: "20-queue", tags: ["add"], expect: { createsMin: 1 } },
    { from: "state_010", preset: "10-storage", tags: ["add"], expect: { createsMin: 1 } },
    { from: "state_060", preset: "50-full-no-monitoring", tags: ["del"], expect: { deletesMin: 1 } },
    { from: "state_050", preset: "35-writer", tags: ["del", "mixed"], expect: { deletesMin: 1 } },
    { from: "state_040", preset: "30-network-only", tags: ["del"], expect: { deletesMin: 1 } },
    { from: "state_030", preset: "20-queue-only", tags: ["del"], expect: { deletesMin: 1 } },
    { from: "state_020", preset: "10-storage-only", tags: ["del"], expect: { deletesMin: 1 } },
  ];
  for (const s of shrinkTargets) {
    cases.push(
      caseRow(n++, {
        title: `shrink ${s.from} → ${s.preset}`,
        stateCheckpoint: s.from,
        preset: s.preset,
        tags: s.tags,
        expect: s.expect,
      }),
    );
  }

  const varCombos = [
    { tfvars: ["nat-single.tfvars"], preset: "50-full" },
    { tfvars: ["nat-multi.tfvars"], preset: "50-full" },
    { tfvars: ["alb-idle-120.tfvars"], preset: "50-full" },
    { tfvars: ["alb-deletion-off.tfvars"], preset: "50-full" },
    { tfvars: ["nat-single.tfvars"], preset: "30-network" },
    { tfvars: ["nat-single.tfvars"], preset: "40-writer-alb" },
    { tfvars: ["nat-multi.tfvars"], preset: "35-writer" },
    { tfvars: ["alb-idle-120.tfvars"], preset: "40-writer-alb" },
    { tfvars: ["alb-deletion-off.tfvars"], preset: "40-writer-alb" },
    { tfvars: ["nat-single.tfvars", "alb-idle-120.tfvars"], preset: "50-full" },
  ];
  for (const v of varCombos) {
    cases.push(
      caseRow(n++, {
        title: `vars on state_070 preset ${v.preset}: ${v.tfvars.join(",")}`,
        stateCheckpoint: "state_070",
        preset: v.preset,
        tfvars: v.tfvars,
        tags: ["vars", "update"],
        expect: { createsMin: 0 },
      }),
    );
  }

  const patches = [
    { preset: "35-writer-test1", state: "state_070", tags: ["update"] },
    { preset: "35-writer-test1", state: "state_040", tags: ["update"] },
    { preset: "50-full", state: "state_070", tags: ["noop"], expect: { noopsMin: 1 } },
    { preset: "50-full", state: "state_060", tags: ["add"] },
    { preset: "50-full-no-monitoring", state: "state_070", tags: ["del"], expect: { deletesMin: 7 } },
    { preset: "45-reader", state: "state_070", tags: ["del"] },
    { preset: "30-network", state: "state_000", tags: ["greenfield"] },
    { preset: "35-writer", state: "state_030", tags: ["add"] },
    { preset: "40-writer-alb", state: "state_040", tags: ["add"] },
  ];
  for (const p of patches) {
    cases.push(
      caseRow(n++, {
        title: `patch plan ${p.state} → ${p.preset}`,
        stateCheckpoint: p.stateCheckpoint || p.state,
        preset: p.preset,
        tags: p.tags,
        expect: p.expect || {},
      }),
    );
  }

  while (cases.length < 100) {
    const i = cases.length;
    const ck = checkpoints[i % checkpoints.length];
    const preset = BOOTSTRAP_STEPS[i % BOOTSTRAP_STEPS.length].preset;
    cases.push(
      caseRow(n++, {
        title: `matrix filler ${ck} → ${preset}`,
        stateCheckpoint: ck,
        preset,
        tags: ["matrix"],
      }),
    );
  }

  return cases.slice(0, 100);
}

const manifest = {
  version: 1,
  description:
    "100 real Terraform checkpoint-plan recipes. Run bootstrap-checkpoints.sh once, then run-recipes.mjs.",
  bootstrap: BOOTSTRAP_STEPS,
  cases: buildCases(),
};

fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log(`Wrote ${MANIFEST_PATH} (${manifest.cases.length} cases)`);
