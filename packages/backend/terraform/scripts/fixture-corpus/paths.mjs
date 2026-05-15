import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** `packages/backend/terraform` */
export const TERRAFORM_ROOT = path.resolve(__dirname, "../..");

export const FIXTURES_DIR = path.join(TERRAFORM_ROOT, "fixtures");
export const PRESETS_DIR = path.join(FIXTURES_DIR, "presets");
export const STATES_DIR = path.join(FIXTURES_DIR, "states");
export const CORPUS_DIR = path.join(TERRAFORM_ROOT, ".corpus");
export const MANIFEST_PATH = path.join(FIXTURES_DIR, "manifest.json");
export const WORKLOAD_TF = path.join(TERRAFORM_ROOT, "main.workload.tf");
export const GOLDEN_DIR = path.join(FIXTURES_DIR, "golden");

export const TF_BIN = process.env.TF_CLI || "terraform";

export const BOOTSTRAP_STEPS = [
  { checkpoint: "state_000", preset: "00-artifacts-only", title: "artifacts only" },
  { checkpoint: "state_010", preset: "10-storage", title: "+ data bucket" },
  { checkpoint: "state_020", preset: "20-queue", title: "+ SQS" },
  { checkpoint: "state_030", preset: "30-network", title: "+ VPC" },
  { checkpoint: "state_040", preset: "35-writer", title: "+ writer Lambda" },
  { checkpoint: "state_050", preset: "40-writer-alb", title: "+ ALB" },
  { checkpoint: "state_060", preset: "45-reader", title: "+ reader Lambda" },
  { checkpoint: "state_070", preset: "50-full", title: "+ monitoring (full stack)" },
];
