import { beforeAll, describe, expect, it, vi } from "vitest";

import { STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS } from "../test-fixtures/terraformPresetFixtures";

import {
  stagingMultiStateLayoutSources,
  stagingMultiStatePipelineLayoutSources,
} from "./terraformLayoutSnapshotFixtures";

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

  it(
    "staging-multi-state semantic layout matches golden snapshot",
    async () => {
      const snapshot = await importLayoutSnapshot(
        stagingMultiStateLayoutSources(),
        true,
      );
      await expect(snapshot).toMatchFileSnapshot(
        "./__snapshots__/staging-multi-state.semantic.layout.snap",
      );
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );

  it(
    "staging-multi-state module layout matches golden snapshot",
    async () => {
      const snapshot = await importLayoutSnapshot(
        stagingMultiStateLayoutSources(),
        false,
      );
      await expect(snapshot).toMatchFileSnapshot(
        "./__snapshots__/staging-multi-state.module.layout.snap",
      );
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );

  it(
    "staging-multi-state pipeline layout matches golden snapshot",
    async () => {
      const snapshot = await importLayoutSnapshot(
        stagingMultiStatePipelineLayoutSources(),
        false,
        "pipeline",
      );
      await expect(snapshot).toMatchFileSnapshot(
        "./__snapshots__/staging-multi-state.pipeline.layout.snap",
      );
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );
});
