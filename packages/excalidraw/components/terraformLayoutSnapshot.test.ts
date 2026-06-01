import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  hasTerraformBackendFile,
  loadStagingMultiStatePlanDotBundlesFromDb,
  readStagingMultiStatePipelineTfdFromDb,
  readTerraformBackendFile,
} from "../test-fixtures/terraformPresetFixtures";

import {
  buildTerraformLayoutSnapshot,
  serializeTerraformLayoutSnapshot,
} from "./terraformLayoutSnapshot";
import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

describe("terraform layout golden snapshots", () => {
  beforeAll(() => {
    if (process.env.VITEST_TERRAFORM_VERBOSE !== "1") {
      vi.spyOn(console, "log").mockImplementation(() => {});
    }
  });

  async function importLayoutSnapshot(
    sources: Parameters<typeof terraformPlanParsingFromSources>[0],
    semanticLayout: boolean,
    layoutMode?: "module" | "semantic" | "pipeline",
  ) {
    const res = await terraformPlanParsingFromSources(sources, {
      semanticLayout,
      ...(layoutMode ? { layoutMode } : {}),
    });
    expect(res.ok).toBe(true);
    const body = await res.json();
    return serializeTerraformLayoutSnapshot(buildTerraformLayoutSnapshot(body));
  }

  it("staging-multi-state semantic layout matches golden snapshot", async () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const tfd = readStagingMultiStatePipelineTfdFromDb();
    const snapshot = await importLayoutSnapshot(
      {
        planDotBundles: bundles,
        states: [],
        stateLabels: [],
        tfdTexts: [tfd],
        tfdLabels: ["pipeline.tfd"],
      },
      true,
    );
    await expect(snapshot).toMatchFileSnapshot(
      "./__snapshots__/staging-multi-state.semantic.layout.snap",
    );
  }, 180_000);

  it("staging-multi-state module layout matches golden snapshot", async () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const tfd = readStagingMultiStatePipelineTfdFromDb();
    const snapshot = await importLayoutSnapshot(
      {
        planDotBundles: bundles,
        states: [],
        stateLabels: [],
        tfdTexts: [tfd],
        tfdLabels: ["pipeline.tfd"],
      },
      false,
    );
    await expect(snapshot).toMatchFileSnapshot(
      "./__snapshots__/staging-multi-state.module.layout.snap",
    );
  }, 180_000);

  it("staging-multi-state pipeline layout matches golden snapshot", async () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const tfd = readTerraformBackendFile("staging-multi-state/pipeline.tfd");
    const snapshot = await importLayoutSnapshot(
      {
        planDotBundles: bundles,
        states: [],
        stateLabels: [],
        tfdTexts: [tfd],
        tfdLabels: ["pipeline.tfd"],
      },
      false,
      "pipeline",
    );
    await expect(snapshot).toMatchFileSnapshot(
      "./__snapshots__/staging-multi-state.pipeline.layout.snap",
    );
  }, 180_000);

  it("allplanmodules semantic layout matches golden snapshot", async () => {
    const plan = JSON.parse(readTerraformBackendFile("allplanmodules.json"));
    const dot = readTerraformBackendFile("allplanmodules.dot");
    const tfd = readTerraformBackendFile("allplanmodules.tfd");
    const state = hasTerraformBackendFile("terraform_allplanmodules.tfstate")
      ? readTerraformBackendFile("terraform_allplanmodules.tfstate")
      : null;

    const snapshot = await importLayoutSnapshot(
      {
        planDotBundles: [{ plan, dotText: dot, label: "main" }],
        states: state ? [state] : [],
        stateLabels: state ? ["terraform_allplanmodules.tfstate"] : [],
        tfdTexts: [tfd],
        tfdLabels: ["allplanmodules.tfd"],
      },
      true,
    );
    await expect(snapshot).toMatchFileSnapshot(
      "./__snapshots__/allplanmodules.semantic.layout.snap",
    );
  }, 180_000);

  it("allplanmodules module layout matches golden snapshot", async () => {
    const plan = JSON.parse(readTerraformBackendFile("allplanmodules.json"));
    const dot = readTerraformBackendFile("allplanmodules.dot");
    const tfd = readTerraformBackendFile("allplanmodules.tfd");
    const state = hasTerraformBackendFile("terraform_allplanmodules.tfstate")
      ? readTerraformBackendFile("terraform_allplanmodules.tfstate")
      : null;

    const snapshot = await importLayoutSnapshot(
      {
        planDotBundles: [{ plan, dotText: dot, label: "main" }],
        states: state ? [state] : [],
        stateLabels: state ? ["terraform_allplanmodules.tfstate"] : [],
        tfdTexts: [tfd],
        tfdLabels: ["allplanmodules.tfd"],
      },
      false,
    );
    await expect(snapshot).toMatchFileSnapshot(
      "./__snapshots__/allplanmodules.module.layout.snap",
    );
  }, 180_000);
});
