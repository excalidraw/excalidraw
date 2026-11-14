import { describe, expect, it } from "vitest";

import { ExcalidrawFontFace } from "./ExcalidrawFontFace";

describe("ExcalidrawFontFace", () => {
  it("does not add the CDN fallback when an asset path is configured", () => {
    const fontFace = new ExcalidrawFontFace("Test", "fonts/test.woff2");

    expect(fontFace.urls.map((url) => url.toString())).toEqual([
      new URL(
        "fonts/test.woff2",
        window.EXCALIDRAW_ASSET_PATH as string,
      ).toString(),
    ]);
  });
});
