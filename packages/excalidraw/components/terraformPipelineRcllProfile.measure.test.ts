import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getTerraformImportPresetSourcesFromDb } from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";
import { STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS } from "../test-fixtures/terraformPresetFixtures";

import { resolveSourcesWithTfdComposition } from "./terraformImportCompositionResolve";
import {
  setTerraformImportProfilerEnabled,
  terraformImportProfilerReset,
  terraformImportProfilerSummary,
} from "./terraformImportProfiler";
import { buildTerraformPipelineRcllExcalidrawScene } from "./terraformPipelineLayoutRcll";
import {
  applyTfdOverlayToNodes,
  buildTerraformLocalImportNodesMap,
} from "./terraformPlanParsing";

import type { TerraformImportPresetSources } from "./terraformImportPresetsTypes";

/**
 * Layer 4 RCA measurement harness (read-only): runs the exact slow RCLL
 * config (staging-extended-localstack-v2, Compact, All-resources,
 * deBandLevel "none", every optional stage on) through the real pipeline
 * builder and dumps the profiler summary to the scratchpad dir for offline
 * analysis. This test intentionally does NOT assert on timing numbers —
 * wall-clock is machine-noise-sensitive. It only asserts the build
 * succeeds and produces elements.
 *
 * Output: a JSON file per run (overwritten each run) under
 * VITEST_TERRAFORM_PROFILE_MEASURE_OUT, or the default scratchpad path.
 */

const OUT_PATH =
  process.env.VITEST_TERRAFORM_PROFILE_MEASURE_OUT ??
  join(tmpdir(), "terraform-rcll-profile", "rca-profile-run.json");

const SLOW_BASE_OPTIONS = {
  compact: true,
  deBandLevel: "none",
  crossingMin: true,
  straighten: true,
  reorder: true,
  rankSeparate: true,
  columnCompact: true,
  swimlaneLaneRise: true,
  staircaseBandOverlap: true,
} as const;

async function buildV2(options: Record<string, unknown>) {
  const raw = getTerraformImportPresetSourcesFromDb(
    "staging-extended-localstack-v2",
  );
  if (!raw) {
    throw new Error("staging-extended-localstack-v2 preset missing");
  }
  const sources = resolveSourcesWithTfdComposition(
    raw as TerraformImportPresetSources,
  );
  const bundle = sources.planDotBundles[0]!;
  const graph = graphlibDot.read("digraph G {}\n");
  const nodes = buildTerraformLocalImportNodesMap(bundle.plan, graph, [], {});
  applyTfdOverlayToNodes(nodes, sources.tfdTexts, sources.tfdLabels);
  const scene = await buildTerraformPipelineRcllExcalidrawScene(
    nodes,
    bundle.plan,
    options,
  );
  const elements = scene.elements as ExcalidrawElement[];
  return { meta: scene.meta, elements };
}

function writeArtifact(partial: Record<string, unknown>, merge: boolean): void {
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  let existing: Record<string, unknown> = {};
  if (merge) {
    try {
      existing = JSON.parse(readFileSync(OUT_PATH, "utf8")) as Record<
        string,
        unknown
      >;
    } catch {
      existing = {};
    }
  }
  writeFileSync(
    OUT_PATH,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), ...existing, ...partial },
      null,
      2,
    ),
    "utf8",
  );
}

describe("RCLL pipeline RCA — Layer 4 profiler measurement (read-only)", () => {
  it(
    "all-resources (includeAncillary: true) — captures profiler summary",
    async () => {
      setTerraformImportProfilerEnabled(true);
      terraformImportProfilerReset();
      const t0 = performance.now();
      const result = await buildV2({
        ...SLOW_BASE_OPTIONS,
        includeAncillary: true,
      });
      const wallClockMs = performance.now() - t0;
      const summary = terraformImportProfilerSummary();

      expect(result.elements.length).toBeGreaterThan(0);

      // eslint-disable-next-line no-console -- intentional RCA measurement output
      console.log(
        "[rca-layer4:all-resources]",
        JSON.stringify({ wallClockMs, summary }),
      );
      writeArtifact({ allResources: { wallClockMs, summary } }, false);
      setTerraformImportProfilerEnabled(null);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );

  it(
    "dataflow-only (includeAncillary: false) — captures profiler summary",
    async () => {
      setTerraformImportProfilerEnabled(true);
      terraformImportProfilerReset();
      const t0 = performance.now();
      const result = await buildV2({
        ...SLOW_BASE_OPTIONS,
        includeAncillary: false,
      });
      const wallClockMs = performance.now() - t0;
      const summary = terraformImportProfilerSummary();

      expect(result.elements.length).toBeGreaterThan(0);

      // eslint-disable-next-line no-console -- intentional RCA measurement output
      console.log(
        "[rca-layer4:dataflow-only]",
        JSON.stringify({ wallClockMs, summary }),
      );
      writeArtifact({ dataflowOnly: { wallClockMs, summary } }, true);
      setTerraformImportProfilerEnabled(null);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );
});
