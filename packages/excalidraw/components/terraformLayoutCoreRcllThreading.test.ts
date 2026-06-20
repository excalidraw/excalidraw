/**
 * Regression: `layoutTerraformFromSources` (the worker/headless path the app
 * actually uses) must FORWARD the RCLL pipeline toggles to the pipeline body.
 *
 * Bug (fixed 2026-06-20): the `sceneContext` literal forwarded swimlaneLaneRise /
 * subnetDeBand / reorder but DROPPED `pipelineRankSeparate` (+ straighten /
 * deDensify / staircaseBandOverlap), so those toggles did nothing from the
 * dialog/URL even though every layer above passed them. The engine-level
 * `terraformPipelineRankSeparate.test.ts` missed it because it calls the builder
 * directly, bypassing this hop. This test exercises the real entry.
 */
import { describe, expect, it } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getTerraformImportPresetSourcesFromDb } from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";
import { layoutTerraformFromSources } from "./terraformLayoutCore";
import { STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS } from "../test-fixtures/terraformPresetFixtures";

import type { TerraformPlanParsingSources } from "./terraformPlanParsing";

const v2Sources = () =>
  getTerraformImportPresetSourcesFromDb(
    "staging-extended-localstack-v2",
  ) as unknown as TerraformPlanParsingSources;

const sceneWidth = (elements: readonly ExcalidrawElement[]) => {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }
    minX = Math.min(minX, el.x);
    maxX = Math.max(maxX, el.x + el.width);
  }
  return maxX - minX;
};

const sceneHeight = (elements: readonly ExcalidrawElement[]) => {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }
    minY = Math.min(minY, el.y);
    maxY = Math.max(maxY, el.y + el.height);
  }
  return maxY - minY;
};

describe("layoutTerraformFromSources — RCLL toggle threading (regression)", () => {
  const build = async (opts: Record<string, unknown>) => {
    const result = await layoutTerraformFromSources(v2Sources(), {
      layoutMode: "rcll",
      pipelineCompact: true,
      ...opts,
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.scene as {
      elements: ExcalidrawElement[];
      meta: Record<string, unknown>;
    };
  };

  it(
    "forwards pipelineRankSeparate (+ rise) to the engine — wider & shorter than OFF",
    async () => {
      const off = await build({});
      const both = await build({
        pipelineSwimlaneLaneRise: true,
        pipelineRankSeparate: true,
      });

      // 1. The toggle actually reaches the engine (was dropped pre-fix).
      expect(off.meta.pipelineRankSeparate ?? false).toBe(false);
      expect(both.meta.pipelineRankSeparate).toBe(true);
      expect(both.meta.pipelineSwimlaneLaneRise).toBe(true);

      // 2. It does real work: rankSeparate composed with the lane-rise trades
      //    height for width (the documented ~+28% / -42% on v2).
      expect(sceneWidth(both.elements)).toBeGreaterThan(
        sceneWidth(off.elements),
      );
      expect(sceneHeight(both.elements)).toBeLessThan(
        sceneHeight(off.elements),
      );
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 6,
  );

  it(
    "suppresses pipelineRankSeparate without lane-rise (footgun stays observable)",
    async () => {
      const footgun = await build({ pipelineRankSeparate: true });
      expect(footgun.meta.pipelineRankSeparate ?? false).toBe(false);
      expect(footgun.meta.pipelineRankSeparateSuppressed).toBe(true);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 4,
  );
});
