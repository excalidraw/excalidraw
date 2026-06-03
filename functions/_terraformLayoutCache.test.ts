import { describe, expect, it } from "vitest";

import {
  buildLayoutCacheKey,
  compressLayoutCacheScene,
  decompressLayoutCacheScene,
  MODULE_LAYOUT_PACKS,
} from "./_terraformLayoutCache";

describe("_terraformLayoutCache", () => {
  it("buildLayoutCacheKey encodes version preset view and module pack", () => {
    expect(
      buildLayoutCacheKey("abc123", "staging-multi-state-expanded", "semantic"),
    ).toBe("vabc123/staging-multi-state-expanded/semantic");
    expect(
      buildLayoutCacheKey(
        "abc123",
        "staging-multi-state-expanded",
        "module",
        "box",
      ),
    ).toBe("vabc123/staging-multi-state-expanded/module/box");
    expect(MODULE_LAYOUT_PACKS).toContain("rectpacking");
  });

  it("round-trips scene gzip payload", async () => {
    const scene = {
      elements: [{ id: "a", type: "rectangle" }],
      meta: { layoutEngine: "topology" },
    };
    const stored = await compressLayoutCacheScene(scene);
    expect(stored.startsWith("gz:b64:")).toBe(true);
    const restored = await decompressLayoutCacheScene(stored);
    expect(restored).toEqual(scene);
  });
});
