import { FONT_FAMILY, FONT_FAMILY_FALLBACKS } from "@excalidraw/common";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { Fonts } from "../fonts/Fonts";

import { textFixture } from "./fixtures/elementFixture";

const JAPANESE_FONT_URI = "https://example.invalid/japanese-handwriting.woff2";

describe("replacing registered font faces", () => {
  let registered: typeof Fonts.registered;

  beforeEach(() => {
    registered = new Map(Fonts.registered);
  });

  afterEach(() => {
    Fonts.registered.clear();
    for (const [family, font] of registered) {
      Fonts.registered.set(family, font);
    }
    vi.restoreAllMocks();
  });

  it("replaces fallback faces while preserving metrics and unrelated families", () => {
    const previous = Fonts.registered.get(FONT_FAMILY_FALLBACKS.Xiaolai)!;
    const primary = Fonts.registered.get(FONT_FAMILY.Excalifont);

    Fonts.registerFontFaces("Xiaolai", [
      {
        uri: JAPANESE_FONT_URI,
        descriptors: { unicodeRange: "U+3040-30FF, U+4E00-9FFF" },
      },
    ]);

    const replacement = Fonts.registered.get(FONT_FAMILY_FALLBACKS.Xiaolai)!;
    expect(replacement.metadata).toEqual(previous.metadata);
    expect(replacement.fontFaces).toHaveLength(1);
    expect(replacement.fontFaces[0].fontFace.family).toBe("Xiaolai");
    expect(replacement.fontFaces[0].urls.map(String)).toEqual([
      JAPANESE_FONT_URI,
    ]);
    expect(Fonts.registered.get(FONT_FAMILY.Excalifont)).toBe(primary);
    expect(previous.fontFaces).not.toContain(replacement.fontFaces[0]);
  });

  it("removes superseded faces from the owning font set without removing unrelated faces", async () => {
    const fontFaceSet = Object.assign(new Set<FontFace>(), {
      check: vi.fn(() => true),
      load: vi.fn(async () => []),
    });
    const ownerDocument = document.implementation.createHTMLDocument();
    Object.defineProperty(ownerDocument, "fonts", { value: fontFaceSet });
    const unrelatedFace = new FontFace(
      "Host application's font",
      "local(Arial)",
    );
    fontFaceSet.add(unrelatedFace);

    await Fonts.loadElementsFonts([], ownerDocument);
    const previous = Fonts.registered.get(FONT_FAMILY_FALLBACKS.Xiaolai)!;
    expect(
      previous.fontFaces.every(({ fontFace }) => fontFaceSet.has(fontFace)),
    ).toBe(true);

    Fonts.registerFontFaces("Xiaolai", [{ uri: JAPANESE_FONT_URI }]);
    await Fonts.loadElementsFonts([], ownerDocument);

    const replacement = Fonts.registered.get(FONT_FAMILY_FALLBACKS.Xiaolai)!;
    expect(
      previous.fontFaces.some(({ fontFace }) => fontFaceSet.has(fontFace)),
    ).toBe(false);
    expect(fontFaceSet.has(replacement.fontFaces[0].fontFace)).toBe(true);
    expect(fontFaceSet.has(unrelatedFace)).toBe(true);
  });

  it("embeds the replacement fallback in exported CJK font declarations", async () => {
    Fonts.registerFontFaces("Xiaolai", [{ uri: JAPANESE_FONT_URI }]);
    const fallback = Fonts.registered.get(FONT_FAMILY_FALLBACKS.Xiaolai)!;
    const primary = Fonts.registered.get(FONT_FAMILY.Excalifont)!;
    // Font subsetting/fetching is outside this registration contract. Supply
    // the generated CSS while leaving the export's family selection intact.
    for (const face of primary.fontFaces) {
      vi.spyOn(face, "toCSS").mockImplementation(() => undefined);
    }
    const css =
      "@font-face { font-family: Xiaolai; src: url(japanese-subset); }";
    vi.spyOn(fallback.fontFaces[0], "toCSS").mockResolvedValue(css);

    const declarations = await Fonts.generateFontFaceDeclarations([
      {
        ...(textFixture as ExcalidrawTextElement),
        type: "text",
        fontFamily: FONT_FAMILY.Excalifont,
        text: "漢字",
        originalText: "漢字",
      },
    ]);

    expect(declarations).toEqual([css]);
  });

  it("rejects unknown families without changing the registry", () => {
    expect(() =>
      Fonts.registerFontFaces(
        "Unknown family" as Parameters<typeof Fonts.registerFontFaces>[0],
        [{ uri: JAPANESE_FONT_URI }],
      ),
    ).toThrow(/unknown|unsupported|unregistered/i);
    expect(Fonts.registered).toEqual(registered);
  });

  it("rejects an empty replacement without wiping out the family", () => {
    expect(() => Fonts.registerFontFaces("Xiaolai", [])).toThrow(
      /empty|at least one/i,
    );
    expect(Fonts.registered).toEqual(registered);
  });

  it("rejects local font families whose faces are managed by the host", () => {
    expect(() =>
      Fonts.registerFontFaces("Helvetica", [{ uri: JAPANESE_FONT_URI }]),
    ).toThrow(/local|system/i);
    expect(Fonts.registered).toEqual(registered);
  });
});
