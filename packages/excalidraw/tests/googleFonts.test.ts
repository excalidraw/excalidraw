import { isValidFontProviderKey } from "../fonts";
import {
  createGoogleFontResolver,
  getGoogleFontPreviewText,
  loadMoreGoogleFonts,
  GOOGLE_FONT_BROWSE_LIMIT,
  GOOGLE_FONT_DEFAULT_PICKS,
  GOOGLE_FONT_PROVIDER_KEY,
  GoogleFontError,
  loadGoogleFontCatalog,
  searchGoogleFonts,
} from "../fonts/google";

import type { GoogleFontSource } from "../fonts/google";

const css = (
  faces: { url: string; format?: string; unicodeRange?: string }[],
) =>
  faces
    .map(
      ({ url, format = "woff2", unicodeRange }) => `/* subset */
@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(${url}) format('${format}');${
        unicodeRange ? `\n  unicode-range: ${unicodeRange};` : ""
      }
}`,
    )
    .join("\n");

const ok = (body: string) => new Response(body, { status: 200 });

describe("Google Fonts catalog", () => {
  it("uses the provider key the editor accepts", () => {
    expect(GOOGLE_FONT_PROVIDER_KEY).toBe("google");
    expect(isValidFontProviderKey(GOOGLE_FONT_PROVIDER_KEY)).toBe(true);
  });

  it("holds each family once, with usable metrics", async () => {
    const { fonts } = await loadGoogleFontCatalog();

    expect(new Set(fonts.map((font) => font.name)).size).toBe(fonts.length);
    for (const { metrics } of fonts) {
      expect(metrics.unitsPerEm).toBeGreaterThan(0);
      expect(metrics.lineHeight).toBeGreaterThan(0);
    }
  });

  it("leaves out families with no regular 400 face", async () => {
    const catalog = await loadGoogleFontCatalog();

    // `css2` only serves these with an explicit weight
    for (const name of ["Buda", "Sunflower", "UnifrakturCook", "Molle"]) {
      expect(catalog.get(name)).toBe(undefined);
    }
  });

  it("leaves out families which aren't text fonts", async () => {
    const catalog = await loadGoogleFontCatalog();

    for (const name of [
      // classified as "Symbols" by Google
      "Yarndings 20 Charted",
      "Libre Barcode 39",
      "Redacted",
      // not classified as such
      "Noto Color Emoji",
      "Jersey 10 Charted",
    ]) {
      expect(catalog.get(name)).toBe(undefined);
    }
    // letters are letters in a math family
    expect(catalog.get("STIX Two Math")).not.toBe(undefined);
    // ...but this one draws relation signs over the letter before them
    expect(catalog.get("Libertinus Math")).toBe(undefined);
  });

  it("leaves out families which are slow to draw", async () => {
    const catalog = await loadGoogleFontCatalog();

    // seconds, not milliseconds, for a line of text
    for (const name of ["Rubik Pixels", "Rubik 80s Fade", "Bitcount Ink"]) {
      expect(catalog.get(name)).toBe(undefined);
    }
    // over 10 ms, where the median family takes 1.5 ms
    for (const name of ["Protest Revolution", "Rubik Doodle Shadow"]) {
      expect(catalog.get(name)).toBe(undefined);
    }
    // the family they are variants of stays
    expect(catalog.get("Rubik")).not.toBe(undefined);
  });

  it("leaves out families whose text would jump in the text editor", async () => {
    const catalog = await loadGoogleFontCatalog();

    // browsers don't agree on their vertical metrics, or the metrics are
    // broken - so the textarea and the canvas place their text differently
    for (const name of ["Katibeh", "Tajawal", "Coiny", "Revalia", "Allkin"]) {
      expect(catalog.get(name)).toBe(undefined);
    }
    // a descender of zero alone is fine
    expect(catalog.get("Press Start 2P")).not.toBe(undefined);
  });

  it("leaves out families the canvas and the text editor lay out differently", async () => {
    const catalog = await loadGoogleFontCatalog();

    for (const name of ["Arvo", "Cherry Bomb One", "Playpen Sans", "Vibur"]) {
      expect(catalog.get(name)).toBe(undefined);
    }
    // a small gap in one browser stays
    expect(catalog.get("Caveat")).not.toBe(undefined);
  });

  it("holds every default pick", async () => {
    const catalog = await loadGoogleFontCatalog();

    expect(
      GOOGLE_FONT_DEFAULT_PICKS.filter((name) => !catalog.get(name)),
    ).toEqual([]);
  });

  it("previews a family in its own script where it has one", async () => {
    expect(await getGoogleFontPreviewText("Noto Sans JP")).toBe("あ");
    expect(await getGoogleFontPreviewText("Roboto")).toBe("");
    expect(await getGoogleFontPreviewText("Not A Font")).toBe("");
  });
});

describe("createGoogleFontResolver", () => {
  it("resolves a family into its faces, with the catalog's metrics", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL) =>
      ok(
        css([
          { url: "https://fonts.gstatic.com/a.woff2", unicodeRange: "U+0-FF" },
          { url: "https://fonts.gstatic.com/b.woff2" },
        ]),
      ),
    );

    const definition = await createGoogleFontResolver({ fetch })("Roboto");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0][0])).toBe(
      "https://fonts.googleapis.com/css2?family=Roboto&display=swap",
    );
    expect(definition.fontFaces).toEqual([
      {
        uri: "https://fonts.gstatic.com/a.woff2",
        descriptors: { unicodeRange: "U+0-FF" },
      },
      { uri: "https://fonts.gstatic.com/b.woff2" },
    ]);
    expect(definition.metadata.metrics).toEqual(
      (await loadGoogleFontCatalog()).get("Roboto")!.metrics,
    );
  });

  it("rejects a name which isn't in the catalog, without asking Google", async () => {
    const fetch = vi.fn();
    const resolve = createGoogleFontResolver({ fetch });

    // ids are exact - a differently cased name is a different id
    for (const name of ["roboto", "Material Icons Round", "Buda"]) {
      await expect(resolve(name)).rejects.toMatchObject({
        name: "GoogleFontError",
        reason: "unknown-family",
      });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retries a transient failure", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        ok(css([{ url: "https://fonts.gstatic.com/a.woff2" }])),
      );

    const definition = await createGoogleFontResolver({ fetch })("Roboto");

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(definition.fontFaces).toHaveLength(1);
  });

  it("doesn't retry an answer which won't change", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 400 }));

    await expect(
      createGoogleFontResolver({ fetch })("Roboto"),
    ).rejects.toMatchObject({ reason: "unavailable" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("explains a stylesheet without woff2 files", async () => {
    // what `css2` serves to anything but a browser's User-Agent
    const fetch = vi.fn(async () =>
      ok(css([{ url: "https://fonts.gstatic.com/a.ttf", format: "truetype" }])),
    );

    const error = await createGoogleFontResolver({ fetch })("Roboto").catch(
      (error) => error,
    );

    expect(error).toBeInstanceOf(GoogleFontError);
    expect(error.message).toContain("User-Agent");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("shares one request among concurrent calls, and keeps no result", async () => {
    const fetch = vi.fn(async () =>
      ok(css([{ url: "https://fonts.gstatic.com/a.woff2" }])),
    );
    const resolve = createGoogleFontResolver({ fetch });

    const [first, second] = await Promise.all([
      resolve("Roboto"),
      resolve("Roboto"),
    ]);
    expect(first).toBe(second);
    expect(fetch).toHaveBeenCalledTimes(1);

    await resolve("Roboto");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("takes its font files from another source", async () => {
    const source = vi.fn<GoogleFontSource>(async () => [
      { uri: "https://mirror.example/roboto.woff2" },
    ]);
    const resolve = createGoogleFontResolver({ source, fetch: vi.fn() });

    const definition = await resolve("Roboto");

    expect(source.mock.calls[0][0]).toMatchObject({ name: "Roboto" });
    expect(definition.fontFaces).toEqual([
      { uri: "https://mirror.example/roboto.woff2" },
    ]);
  });
});

describe("searchGoogleFonts", () => {
  it("lists the families containing the query, most popular first", async () => {
    const { fonts } = await loadGoogleFontCatalog();
    const result = await searchGoogleFonts(" Sans ");

    expect(result.kind).toBe("match");
    expect(result.fonts.length).toBeGreaterThan(10);
    expect(result.fonts).toEqual(
      fonts
        .filter((font) => font.name.toLowerCase().includes("sans"))
        .map((font) => font.name),
    );
  });

  it("suggests the families a typo away when nothing matches", async () => {
    expect(await searchGoogleFonts("robotto")).toEqual({
      kind: "suggestion",
      fonts: ["Roboto"],
    });
  });

  it("finds nothing for an empty query", async () => {
    expect(await searchGoogleFonts("  ")).toEqual({ kind: "match", fonts: [] });
  });

  it("honors an aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      searchGoogleFonts("rob", { signal: controller.signal }),
    ).rejects.toThrow();
  });
});

describe("loadMoreGoogleFonts", () => {
  it("pages through the most popular families", async () => {
    const { fonts } = await loadGoogleFontCatalog();
    const names = fonts.map((font) => font.name);

    expect(await loadMoreGoogleFonts({ offset: 0, limit: 20 })).toEqual(
      names.slice(0, 20),
    );
    expect(await loadMoreGoogleFonts({ offset: 20, limit: 20 })).toEqual(
      names.slice(20, 40),
    );
  });

  it("ends at the browse limit, which the search isn't bound by", async () => {
    const { fonts } = await loadGoogleFontCatalog();
    expect(fonts.length).toBeGreaterThan(GOOGLE_FONT_BROWSE_LIMIT);

    // fewer than asked for: the end
    expect(
      await loadMoreGoogleFonts({
        offset: GOOGLE_FONT_BROWSE_LIMIT - 5,
        limit: 20,
      }),
    ).toHaveLength(5);
    expect(
      await loadMoreGoogleFonts({
        offset: GOOGLE_FONT_BROWSE_LIMIT,
        limit: 20,
      }),
    ).toEqual([]);

    // i.e. the math families, which are far from the most popular ones
    const names = fonts.map((font) => font.name);
    expect(names.indexOf("STIX Two Math")).toBeGreaterThan(
      GOOGLE_FONT_BROWSE_LIMIT,
    );
    expect((await searchGoogleFonts("stix")).fonts).toContain("STIX Two Math");
  });
});
