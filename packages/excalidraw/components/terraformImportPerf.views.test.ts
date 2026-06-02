import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getTerraformImportPresetSourcesFromDb } from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";

import { STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS } from "../test-fixtures/terraformPresetFixtures";

import {
  terraformImportProfilerLogSummary,
  terraformImportProfilerReset,
  terraformImportProfilerSummary,
} from "./terraformImportProfiler";
import { layoutTerraformViaWorkers } from "./terraformLayoutWorkerClient";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERF_BASELINE_PATH = join(
  __dirname,
  "../test-fixtures/terraform-import-perf-baseline.json",
);

const PERF_BUDGET_SEMANTIC_MS =
  process.env.CI && process.env.VITEST_COVERAGE === "1"
    ? 540_000
    : process.env.CI
    ? 300_000
    : 120_000;

const PERF_BUDGET_PIPELINE_MS = process.env.CI ? 90_000 : 45_000;
const PERF_BUDGET_MODULE_MS = process.env.CI ? 120_000 : 60_000;

const SPAN_REGRESSION_RATIO = 1.15;

type PerfBaseline = {
  views: Record<
    string,
    { wallClockMs: number; elementCount: number; skippedLayout?: boolean }
  >;
  spans: Record<string, number>;
};

function loadBaseline(): PerfBaseline {
  return JSON.parse(readFileSync(PERF_BASELINE_PATH, "utf8")) as PerfBaseline;
}

describe("terraform import performance (all views)", () => {
  const sources = () => {
    const s = getTerraformImportPresetSourcesFromDb(
      "staging-multi-state-expanded",
    );
    if (!s) {
      throw new Error("preset missing");
    }
    return {
      planDotBundles: s.planDotBundles,
      states: [] as unknown[],
      stateLabels: [] as string[],
      tfdTexts: s.tfdTexts,
      tfdLabels: s.tfdLabels,
    };
  };

  it(
    "semantic import within budget",
    async () => {
      terraformImportProfilerReset();
      const t0 = performance.now();
      const body = await layoutTerraformViaWorkers(sources(), {
        semanticLayout: true,
      });
      const ms = performance.now() - t0;
      expect((body.elements as unknown[]).length).toBeGreaterThan(0);
      expect(ms).toBeLessThan(PERF_BUDGET_SEMANTIC_MS);
      if (process.env.VITEST_TERRAFORM_PROFILE === "1") {
        terraformImportProfilerLogSummary();
      }
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );

  it(
    "pipeline import within budget",
    async () => {
      terraformImportProfilerReset();
      const t0 = performance.now();
      const body = await layoutTerraformViaWorkers(sources(), {
        semanticLayout: false,
        layoutMode: "pipeline",
      });
      const ms = performance.now() - t0;
      expect((body.elements as unknown[]).length).toBeGreaterThan(0);
      expect(ms).toBeLessThan(PERF_BUDGET_PIPELINE_MS);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );

  it(
    "module import within budget",
    async () => {
      terraformImportProfilerReset();
      const t0 = performance.now();
      const body = await layoutTerraformViaWorkers(sources(), {
        semanticLayout: false,
      });
      const ms = performance.now() - t0;
      const elements = body.elements as unknown[];
      const meta = body.meta as { skippedLayout?: boolean } | undefined;
      if (!meta?.skippedLayout) {
        expect(elements.length).toBeGreaterThan(0);
      }
      expect(ms).toBeLessThan(PERF_BUDGET_MODULE_MS);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );

  it("span timings do not regress beyond baseline ratio", () => {
    const baseline = loadBaseline();
    if (Object.keys(baseline.spans).length === 0) {
      return;
    }
    const current = terraformImportProfilerSummary();
    const byName = new Map(current.map((r) => [r.name, r.selfMs]));
    for (const [name, baseMs] of Object.entries(baseline.spans)) {
      const cur = byName.get(name);
      if (cur == null) {
        continue;
      }
      expect(cur).toBeLessThanOrEqual(baseMs * SPAN_REGRESSION_RATIO);
    }
  });
});
