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

/**
 * Element ids/seeds are non-deterministic across builds in the same process: ids
 * come from a global sequential counter (parallel-but-offset between runs),
 * `groupIds` are random nanoids, and `seed`/`versionNonce` are random integers.
 * To assert layout byte-identity we canonicalize: strip the random scalars and
 * remap every id-reference (id, frameId, groupIds, boundElements, bindings) to a
 * first-appearance token. Two structurally identical scenes then deep-equal.
 */
const canonicalize = (elements: readonly ExcalidrawElement[]) => {
  const map = new Map<string, string>();
  let n = 0;
  const tok = (s: string) => {
    if (!map.has(s)) {
      map.set(s, `T${n++}`);
    }
    return map.get(s)!;
  };
  for (const el of elements) {
    const e = el as unknown as Record<string, any>;
    tok(e.id);
    if (e.frameId) {
      tok(e.frameId);
    }
    for (const g of (e.groupIds as string[]) ?? []) {
      tok(g);
    }
    for (const b of (e.boundElements as { id: string }[]) ?? []) {
      tok(b.id);
    }
    if (e.startBinding?.elementId) {
      tok(e.startBinding.elementId);
    }
    if (e.endBinding?.elementId) {
      tok(e.endBinding.elementId);
    }
  }
  return elements.map((el) => {
    const c = JSON.parse(JSON.stringify(el)) as Record<string, any>;
    delete c.seed;
    delete c.versionNonce;
    delete c.version;
    delete c.updated;
    c.id = map.get(c.id) ?? c.id;
    if (c.frameId) {
      c.frameId = map.get(c.frameId) ?? c.frameId;
    }
    if (Array.isArray(c.groupIds)) {
      c.groupIds = c.groupIds.map((g: string) => map.get(g) ?? g);
    }
    if (Array.isArray(c.boundElements)) {
      c.boundElements = c.boundElements.map((b: { id: string }) => ({
        ...b,
        id: map.get(b.id) ?? b.id,
      }));
    }
    if (c.startBinding?.elementId) {
      c.startBinding.elementId =
        map.get(c.startBinding.elementId) ?? c.startBinding.elementId;
    }
    if (c.endBinding?.elementId) {
      c.endBinding.elementId =
        map.get(c.endBinding.elementId) ?? c.endBinding.elementId;
    }
    return c;
  });
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

  it(
    "forwards pipelineColumnPacking=compact (M5c) to the engine — observable on v2",
    async () => {
      const off = await build({});
      const none = await build({ pipelineColumnPacking: "none" });
      const compact = await build({ pipelineColumnPacking: "compact" });

      // 1. `none` is the literal default — OFF byte-identical (canonicalized
      //    elements deep-equal; raw ids/seeds are non-deterministic per run),
      //    and it must not advertise the packing meta.
      expect(canonicalize(none.elements)).toEqual(canonicalize(off.elements));
      expect(none.meta.pipelineColumnPacking).toBeUndefined();
      expect(off.meta.rcllColumnCompact ?? false).toBe(false);

      // 2. `compact` reaches the engine: enum echoed, M5c milestone, stats surfaced.
      expect(compact.meta.pipelineColumnPacking).toBe("compact");
      expect(compact.meta.rcllColumnCompact).toBe(true);
      expect(compact.meta.rcllMilestone).toBe("M5c");
      const placement = (
        compact.meta.rcllStageMeta as {
          placement?: Record<string, number>;
        }
      ).placement;
      expect(placement?.columnCompactApplied).toBeDefined();

      // 3. The measure-gated pass never makes the diagram worse: width is
      //    non-increasing and CON-12 holds (no backward / same-column leaf edge).
      //    On v2 the swimlanes are already dense ⇒ a measured no-op (moved 0),
      //    which must be OFF byte-identical (the safe-fallback path).
      expect(sceneWidth(compact.elements)).toBeLessThanOrEqual(
        sceneWidth(off.elements),
      );
      const gates = compact.meta.gates as
        | { acyclicBackwardEdges?: number; acyclicSameColumnEdges?: number }
        | undefined;
      expect(gates?.acyclicBackwardEdges ?? 0).toBe(0);
      expect(gates?.acyclicSameColumnEdges ?? 0).toBe(0);
      if ((placement?.columnCompactMovedCount ?? 0) === 0) {
        expect(canonicalize(compact.elements)).toEqual(
          canonicalize(off.elements),
        );
      }
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 8,
  );

  it(
    "pipelineColumnPacking=compact is deterministic (CON-8)",
    async () => {
      const a = await build({ pipelineColumnPacking: "compact" });
      const b = await build({ pipelineColumnPacking: "compact" });
      expect(canonicalize(a.elements)).toEqual(canonicalize(b.elements));
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 8,
  );
});
