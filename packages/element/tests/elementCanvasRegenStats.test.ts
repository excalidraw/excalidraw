import {
  elementCanvasRegenStats,
  resetElementCanvasRegenStats,
} from "../src/renderElement";

/**
 * The regen counter is the deterministic primary metric for the Terraform LOD
 * A/B (docs/terraform-canvas-runtime-performance.md). These tests pin the two
 * properties the benchmark relies on: it is disabled by default (no prod cost),
 * and reset is exact. The live increment-on-zoom behaviour is exercised by the
 * benchmark's `--suite lod` run, where zoom regens must drop as the LOD preset
 * gets more aggressive.
 */
describe("elementCanvasRegenStats", () => {
  beforeEach(() => {
    elementCanvasRegenStats.enabled = false;
    resetElementCanvasRegenStats();
  });

  it("is disabled by default so production builds pay no instrumentation cost", () => {
    expect(elementCanvasRegenStats.enabled).toBe(false);
  });

  it("starts zeroed", () => {
    expect(elementCanvasRegenStats.total).toBe(0);
    expect(elementCanvasRegenStats.zoom).toBe(0);
  });

  it("reset zeroes both counters without touching the enabled flag", () => {
    elementCanvasRegenStats.enabled = true;
    elementCanvasRegenStats.total = 42;
    elementCanvasRegenStats.zoom = 17;

    resetElementCanvasRegenStats();

    expect(elementCanvasRegenStats.total).toBe(0);
    expect(elementCanvasRegenStats.zoom).toBe(0);
    // reset is a measurement boundary, not a teardown — it must leave the
    // counter armed so the next workload keeps counting.
    expect(elementCanvasRegenStats.enabled).toBe(true);
  });
});
