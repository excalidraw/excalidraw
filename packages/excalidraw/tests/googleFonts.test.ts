import { isValidFontProviderKey } from "../fonts";
import {
  createGoogleFontProvider,
  createGoogleFontResolver,
  getGoogleFontKind,
  getGoogleFontPreviewText,
  loadMoreGoogleFonts,
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
  font-family: 'Open Sans';
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

  it("holds the families we offer and no other, in the order they're listed", async () => {
    const { fonts } = await loadGoogleFontCatalog();

    expect(fonts.map((font) => font.name)).toEqual(GOOGLE_FONT_DEFAULT_PICKS);
  });

  it("previews a family in its own script where it has one", async () => {
    expect(await getGoogleFontPreviewText("Zen Maru Gothic")).toBe("あ");
    expect(await getGoogleFontPreviewText("Open Sans")).toBe("");
    expect(await getGoogleFontPreviewText("Not A Font")).toBe("");
  });

  it("tells what kind of font a family is", async () => {
    expect(await getGoogleFontKind("Kalam")).toBe("hand-drawn");
    expect(await getGoogleFontKind("Fira Mono")).toBe("code");
    expect(await getGoogleFontKind("Not A Font")).toBe(undefined);
  });
});

describe("createGoogleFontProvider", () => {
  it("offers the catalog in the font picker, with the resolver it's given", async () => {
    const resolve = vi.fn();
    const provider = createGoogleFontProvider({ resolve });

    expect(provider.resolve).toBe(resolve);
    expect(provider.availableFonts).toEqual(GOOGLE_FONT_DEFAULT_PICKS);
    expect(await provider.getKind!("Kalam")).toBe("hand-drawn");
    expect(await provider.getPreviewText!("Zen Maru Gothic")).toBe("あ");
    expect(provider.search).toBe(searchGoogleFonts);
    expect(provider.loadMore).toBe(loadMoreGoogleFonts);
  });

  it("offers nothing in the picker when told so, and still tells of a scene's fonts", async () => {
    const provider = createGoogleFontProvider({ offerInPicker: false });

    expect(provider.availableFonts).toEqual([]);
    expect(provider.search).toBe(undefined);
    expect(provider.loadMore).toBe(undefined);
    expect(await provider.getKind!("Kalam")).toBe("hand-drawn");
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

    const definition = await createGoogleFontResolver({ fetch })("Open Sans");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0][0])).toBe(
      "https://fonts.googleapis.com/css2?family=Open+Sans&display=swap",
    );
    expect(definition.fontFaces).toEqual([
      {
        uri: "https://fonts.gstatic.com/a.woff2",
        descriptors: { unicodeRange: "U+0-FF" },
      },
      { uri: "https://fonts.gstatic.com/b.woff2" },
    ]);
    expect(definition.metadata.metrics).toEqual(
      (await loadGoogleFontCatalog()).get("Open Sans")!.metrics,
    );
  });

  it("rejects a name which isn't in the catalog, without asking Google", async () => {
    const fetch = vi.fn();
    const resolve = createGoogleFontResolver({ fetch });

    // ids are exact - a differently cased name is a different id
    for (const name of ["open sans", "Material Icons Round", "Roboto"]) {
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

    const definition = await createGoogleFontResolver({ fetch })("Open Sans");

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(definition.fontFaces).toHaveLength(1);
  });

  it("doesn't retry an answer which won't change", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 400 }));

    await expect(
      createGoogleFontResolver({ fetch })("Open Sans"),
    ).rejects.toMatchObject({ reason: "unavailable" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("explains a stylesheet without woff2 files", async () => {
    // what `css2` serves to anything but a browser's User-Agent
    const fetch = vi.fn(async () =>
      ok(css([{ url: "https://fonts.gstatic.com/a.ttf", format: "truetype" }])),
    );

    const error = await createGoogleFontResolver({ fetch })("Open Sans").catch(
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
      resolve("Open Sans"),
      resolve("Open Sans"),
    ]);
    expect(first).toBe(second);
    expect(fetch).toHaveBeenCalledTimes(1);

    await resolve("Open Sans");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("takes its font files from another source", async () => {
    const source = vi.fn<GoogleFontSource>(async () => [
      { uri: "https://mirror.example/roboto.woff2" },
    ]);
    const resolve = createGoogleFontResolver({ source, fetch: vi.fn() });

    const definition = await resolve("Open Sans");

    expect(source.mock.calls[0][0]).toMatchObject({ name: "Open Sans" });
    expect(definition.fontFaces).toEqual([
      { uri: "https://mirror.example/roboto.woff2" },
    ]);
  });
});

describe("searchGoogleFonts", () => {
  it("lists the families containing the query, in the catalog's order", async () => {
    const { fonts } = await loadGoogleFontCatalog();
    const result = await searchGoogleFonts(" An ");

    expect(result.kind).toBe("match");
    expect(result.fonts.length).toBeGreaterThan(1);
    expect(result.fonts).toEqual(
      fonts
        .filter((font) => font.name.toLowerCase().includes("an"))
        .map((font) => font.name),
    );
  });

  it("suggests the families a typo away when nothing matches", async () => {
    expect(await searchGoogleFonts("literrata")).toEqual({
      kind: "suggestion",
      fonts: ["Literata"],
    });
  });

  it("finds nothing for an empty query", async () => {
    expect(await searchGoogleFonts("  ")).toEqual({ kind: "match", fonts: [] });
  });

  it("honors an aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      searchGoogleFonts("zen", { signal: controller.signal }),
    ).rejects.toThrow();
  });
});

describe("loadMoreGoogleFonts", () => {
  it("pages through the catalog, to its end", async () => {
    const { fonts } = await loadGoogleFontCatalog();
    const names = fonts.map((font) => font.name);
    expect(names.length).toBeGreaterThan(5);

    expect(await loadMoreGoogleFonts({ offset: 0, limit: 5 })).toEqual(
      names.slice(0, 5),
    );
    // fewer than asked for: the end
    expect(await loadMoreGoogleFonts({ offset: 5, limit: 5 })).toEqual(
      names.slice(5),
    );
    expect(
      await loadMoreGoogleFonts({ offset: names.length, limit: 5 }),
    ).toEqual([]);
  });
});
