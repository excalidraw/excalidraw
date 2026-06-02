import { describe, expect, it } from "vitest";

import { STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS } from "../test-fixtures/terraformPresetFixtures";

import { layoutTerraformFromSources } from "./terraformLayoutCore";
import {
  buildTerraformImportPrepCache,
  clearTerraformImportPrepCache,
} from "./terraformImportPrepCache";
import { buildTerraformLayoutSnapshot } from "./terraformLayoutSnapshot";
import { stagingMultiStateLayoutSources } from "./terraformLayoutSnapshotFixtures";

describe("terraform import prep cache", () => {
  it(
    "semantic layout matches with prep cache built vs cold",
    async () => {
      const sources = stagingMultiStateLayoutSources();
      clearTerraformImportPrepCache();

      const cold = await layoutTerraformFromSources(sources, {
        semanticLayout: true,
      });
      expect(cold.ok).toBe(true);
      const coldSnap = buildTerraformLayoutSnapshot(
        cold.ok
          ? (cold.scene as Parameters<typeof buildTerraformLayoutSnapshot>[0])
          : {},
      );

      buildTerraformImportPrepCache(sources, { semanticLayout: true });
      const warm = await layoutTerraformFromSources(sources, {
        semanticLayout: true,
      });
      expect(warm.ok).toBe(true);
      const warmSnap = buildTerraformLayoutSnapshot(
        warm.ok
          ? (warm.scene as Parameters<typeof buildTerraformLayoutSnapshot>[0])
          : {},
      );

      expect(warmSnap).toEqual(coldSnap);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );
});
