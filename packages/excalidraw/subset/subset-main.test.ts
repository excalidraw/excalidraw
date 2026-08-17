import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

/**
 * When worker-based font subsetting fails, `subsetWoff2GlyphsByCodepoints`
 * falls back to the main thread and still returns a correct result. The
 * fallback is expected and recoverable, so it must be reported as a warning
 * rather than an error — hosts that bundle the package (e.g. via webpack) hit
 * this on every load and surface console errors to their users.
 *
 * See https://github.com/excalidraw/excalidraw/issues/9317
 */
describe("subsetWoff2GlyphsByCodepoints", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("logs a warning, not an error, when falling back to the main thread", async () => {
    // force the worker path, then make worker construction fail the way a
    // bundled host does (the URL resolves outside the serving origin)
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new DOMException(
            "Failed to construct 'Worker'",
            "SecurityError",
          );
        }
      },
    );

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { subsetWoff2GlyphsByCodepoints } = await import("./subset-main");

    // a non-woff2 buffer is enough: we only care about the fallback logging,
    // and the main-thread path resolves rather than throwing
    const result = await subsetWoff2GlyphsByCodepoints(new ArrayBuffer(8), [
      65,
    ]);

    expect(typeof result).toBe("string");
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "Failed to use workers for subsetting, falling back to the main thread.",
      expect.anything(),
    );
  });
});
