import { FONT_FAMILY } from "@excalidraw/common";

import { getFontPreviewText, loadFontPreviewText } from "./fontPreviewText";

import type { FontProviders } from "../../types";

// the cache is module-wide - each test uses its own families
const providers = (
  getPreviewText?: (familyName: string) => string | Promise<string>,
): FontProviders => ({
  google: {
    icon: <span />,
    resolve: vi.fn(),
    availableFonts: [],
    getPreviewText,
  },
});

describe("font preview text", () => {
  it("caches a synchronous answer right away", () => {
    const getPreviewText = vi.fn(() => "あ");
    expect(
      loadFontPreviewText("google:Sync JP", providers(getPreviewText)),
    ).toBe(null);
    expect(getFontPreviewText("google:Sync JP")).toBe("あ");
    expect(getPreviewText).toHaveBeenCalledWith("Sync JP");

    // asked once
    loadFontPreviewText("google:Sync JP", providers(getPreviewText));
    expect(getPreviewText).toHaveBeenCalledTimes(1);
  });

  it("shows Aa until an async answer settles, asking once", async () => {
    let resolve!: (text: string) => void;
    const getPreviewText = vi.fn(
      () => new Promise<string>((r) => (resolve = r)),
    );
    const first = loadFontPreviewText(
      "google:Async KR",
      providers(getPreviewText),
    );
    const second = loadFontPreviewText(
      "google:Async KR",
      providers(getPreviewText),
    );
    expect(second).toBe(first);
    expect(getPreviewText).toHaveBeenCalledTimes(1);
    expect(getFontPreviewText("google:Async KR")).toBe("Aa");

    resolve("한");
    await first;
    expect(getFontPreviewText("google:Async KR")).toBe("한");
  });

  it("falls back to Aa", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      loadFontPreviewText(
        FONT_FAMILY.Nunito,
        providers(() => "x"),
      ),
    ).toBe(null);
    expect(getFontPreviewText(FONT_FAMILY.Nunito)).toBe("Aa");

    loadFontPreviewText(
      "google:Empty",
      providers(() => ""),
    );
    expect(getFontPreviewText("google:Empty")).toBe("Aa");

    loadFontPreviewText(
      "other:Unknown",
      providers(() => "x"),
    );
    expect(getFontPreviewText("other:Unknown")).toBe("Aa");

    loadFontPreviewText(
      "google:Throws",
      providers(() => {
        throw new Error("boom");
      }),
    );
    expect(getFontPreviewText("google:Throws")).toBe("Aa");

    await loadFontPreviewText(
      "google:Rejects",
      providers(() => Promise.reject(new Error("boom"))),
    );
    expect(getFontPreviewText("google:Rejects")).toBe("Aa");

    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});
