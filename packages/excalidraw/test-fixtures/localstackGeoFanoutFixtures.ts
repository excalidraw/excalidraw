import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  hasLocalstackGeoFanoutPresetInDb,
  loadLocalstackGeoFanoutPlanDotBundlesFromDb,
  readLocalstackGeoFanoutPipelineTfdFromDb,
} from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_DIR = path.join(__dirname, "localstack-geo-fanout/bundles");

const STACK_IDS = [
  "00-consumer",
  "10-a-api-1",
  "11-a-api-2",
  "12-a-api-3",
  "20-b-api-4",
  "21-b-api-5",
  "22-b-api-6",
] as const;

export function hasLocalstackGeoFanoutFileBundles(): boolean {
  return STACK_IDS.every(
    (id) =>
      fs.existsSync(path.join(BUNDLE_DIR, `${id}.plan.json`)) &&
      fs.existsSync(path.join(BUNDLE_DIR, `${id}.graph.dot`)),
  );
}

export function loadLocalstackGeoFanoutPlanDotBundlesFromFiles() {
  return STACK_IDS.map((id) => ({
    plan: JSON.parse(
      fs.readFileSync(path.join(BUNDLE_DIR, `${id}.plan.json`), "utf8"),
    ),
    dotText: fs.readFileSync(path.join(BUNDLE_DIR, `${id}.graph.dot`), "utf8"),
    label: id,
  }));
}

export function readLocalstackGeoFanoutPipelineTfdFromFiles() {
  const tfdPath = path.join(BUNDLE_DIR, "pipeline.tfd");
  if (fs.existsSync(tfdPath)) {
    return fs.readFileSync(tfdPath, "utf8");
  }
  return fs.readFileSync(
    path.resolve(
      __dirname,
      "../../backend/terraform/localstack-geo-fanout/pipeline.tfd",
    ),
    "utf8",
  );
}

export function loadLocalstackGeoFanoutPlanDotBundles() {
  if (hasLocalstackGeoFanoutPresetInDb()) {
    return loadLocalstackGeoFanoutPlanDotBundlesFromDb();
  }
  if (hasLocalstackGeoFanoutFileBundles()) {
    return loadLocalstackGeoFanoutPlanDotBundlesFromFiles();
  }
  throw new Error(
    "localstack-geo-fanout fixtures missing. Run yarn localstack:geo-fanout:export or seed preset DB.",
  );
}

export function readLocalstackGeoFanoutPipelineTfd() {
  if (hasLocalstackGeoFanoutPresetInDb()) {
    return readLocalstackGeoFanoutPipelineTfdFromDb();
  }
  return readLocalstackGeoFanoutPipelineTfdFromFiles();
}

export function hasLocalstackGeoFanoutFixtures(): boolean {
  return (
    hasLocalstackGeoFanoutPresetInDb() || hasLocalstackGeoFanoutFileBundles()
  );
}
