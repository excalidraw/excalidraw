import { describe, expect, it } from "vitest";

import { getTerraformImportPresetSourcesFromDb } from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";

import { layoutTerraformViaWorkers } from "./terraformLayoutWorkerClient";

/** GitHub Actions runners are ~1.5× slower than local for 25-stack semantic layout. */
const PERF_BUDGET_MS = process.env.CI ? 240_000 : 120_000;
const PERF_TEST_TIMEOUT_MS = process.env.CI ? 300_000 : 120_000;

describe("terraform import performance", () => {
  it(
    "staging-multi-state-expanded semantic import completes within budget",
    async () => {
      const sources = getTerraformImportPresetSourcesFromDb(
        "staging-multi-state-expanded",
      );
      expect(sources).not.toBeNull();
      expect(sources!.planDotBundles.length).toBe(25);

      const t0 = performance.now();
      const body = await layoutTerraformViaWorkers(
        {
          planDotBundles: sources!.planDotBundles,
          states: [],
          stateLabels: [],
          tfdTexts: sources!.tfdTexts,
          tfdLabels: sources!.tfdLabels,
        },
        { semanticLayout: true },
      );
      const ms = performance.now() - t0;

      const elements = body.elements;
      expect(Array.isArray(elements)).toBe(true);
      expect((elements as unknown[]).length).toBeGreaterThan(0);

      // Regression guard: 25-stack expanded semantic import (budget allows CI variance).
      expect(ms).toBeLessThan(PERF_BUDGET_MS);
      if (process.env.VITEST_TERRAFORM_VERBOSE === "1") {
        // eslint-disable-next-line no-console -- opt-in perf diagnostics
        console.log(
          `staging-multi-state-expanded semantic import: ${Math.round(ms)}ms, ${
            (elements as unknown[]).length
          } elements`,
        );
      }
    },
    PERF_TEST_TIMEOUT_MS,
  );
});
