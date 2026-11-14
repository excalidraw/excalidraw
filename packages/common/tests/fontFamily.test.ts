import {
  FONT_FAMILY,
  FONT_PROVIDER_SEPARATOR,
  createProviderFontFamily,
  getCustomFontCSSFamily,
  getFontFamilyString,
  parseProviderFontFamily,
} from "@excalidraw/common";

import type { FontFamily } from "@excalidraw/common";

describe("parseProviderFontFamily", () => {
  it("should parse a provider-qualified family", () => {
    expect(parseProviderFontFamily("google:Roboto")).toEqual({
      providerId: "google",
      familyName: "Roboto",
    });
  });

  it("should preserve whitespace and casing in the family name", () => {
    expect(parseProviderFontFamily("google:Lilita One")).toEqual({
      providerId: "google",
      familyName: "Lilita One",
    });
  });

  it("should split on the first separator only", () => {
    // so that family names may themselves contain a separator
    expect(parseProviderFontFamily("a:b:c")).toEqual({
      providerId: "a",
      familyName: "b:c",
    });
  });

  it("should return null when there is no separator", () => {
    expect(parseProviderFontFamily("Roboto")).toBe(null);
    expect(parseProviderFontFamily("")).toBe(null);
  });

  it("should return null for a leading separator (empty provider)", () => {
    expect(parseProviderFontFamily(":Roboto")).toBe(null);
    expect(parseProviderFontFamily(":")).toBe(null);
  });

  it("should return null for a trailing separator (empty family)", () => {
    expect(parseProviderFontFamily("google:")).toBe(null);
  });
});

describe("createProviderFontFamily", () => {
  it("should join the provider id and the family name", () => {
    expect(createProviderFontFamily("google", "Roboto")).toBe("google:Roboto");
  });

  it("should round-trip through parseProviderFontFamily", () => {
    const family = createProviderFontFamily("google", "Lilita One");

    expect(parseProviderFontFamily(family)).toEqual({
      providerId: "google",
      familyName: "Lilita One",
    });
  });

  it("should round-trip a family name containing the separator", () => {
    const family = createProviderFontFamily("google", "Foo:Bar");

    expect(family).toBe(`google${FONT_PROVIDER_SEPARATOR}Foo:Bar`);
    expect(parseProviderFontFamily(family)).toEqual({
      providerId: "google",
      familyName: "Foo:Bar",
    });
  });
});

describe("getCustomFontCSSFamily", () => {
  it("should generate a readable name from the family part", () => {
    expect(getCustomFontCSSFamily("google:Press Start 2P")).toMatch(
      /^xf-press-start-2p-[0-9a-f]{8}$/,
    );
  });

  it("should be stable for the same id", () => {
    expect(getCustomFontCSSFamily("google:Roboto")).toBe(
      getCustomFontCSSFamily("google:Roboto"),
    );
  });

  it("should tell apart ids which CSS or a slug alone would merge", () => {
    const pairs = [
      // CSS matches family names case-insensitively
      ["google:Abc", "google:aBC"],
      ["google:Ä", "google:ä"],
      // nothing of these survives into the slug
      ["google:あいう", "google:かきく"],
      ["google:Foo Bar", "google:Foo-Bar"],
      // the same family name in two catalogs
      ["google:Roboto", "com.acme.fonts:Roboto"],
      // lone surrogates, which UTF-8 would turn into one character
      ["google:\ud800", "google:\ud801"],
    ];

    for (const [a, b] of pairs) {
      expect(getCustomFontCSSFamily(a)).not.toBe(getCustomFontCSSFamily(b));
    }
  });

  it("should always be a plain CSS identifier", () => {
    const ids = [
      "google:Press Start 2P",
      'google:"quoted" \\ name',
      "google:</style><x>",
      "google:a;b{c}d,e/*f*/",
      "google:line\nbreak\ttab\u0000nul",
      "google:nbsp\u00a0and\ufffe",
      "google:\ud800",
      "google:あいう",
      "google:😀",
      `google:${"x".repeat(10_000)}`,
      // not provider-qualified, i.e. kept as is by `restore`
      "Comic Sans MS",
      "",
    ];

    for (const id of ids) {
      const cssFamily = getCustomFontCSSFamily(id);
      expect(cssFamily).toMatch(/^xf-[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(cssFamily.length).toBeLessThanOrEqual(60);
    }
  });
});

describe("getFontFamilyString", () => {
  it("should refer to a custom family by its generated name, with fallbacks", () => {
    const fontFamily = "google:Roboto";

    expect(getFontFamilyString({ fontFamily })).toBe(
      `${getCustomFontCSSFamily(fontFamily)}, sans-serif, Segoe UI Emoji`,
    );
  });

  it("should never hand a bare name to CSS", () => {
    // would otherwise render in the installed font on some machines only
    const fontFamily = "Comic Sans MS" as FontFamily;

    expect(getFontFamilyString({ fontFamily })).not.toContain("Comic Sans MS");
    expect(getFontFamilyString({ fontFamily })).toMatch(/^xf-comic-sans-ms-/);
  });

  it("should fall back for values which aren't a family at all", () => {
    for (const fontFamily of [9999, { family: "Roboto" }, true]) {
      expect(
        getFontFamilyString({ fontFamily: fontFamily as FontFamily }),
      ).toBe("Segoe UI Emoji");
    }
  });

  it("should keep built-in families by name", () => {
    expect(getFontFamilyString({ fontFamily: FONT_FAMILY.Nunito })).toMatch(
      /^Nunito, /,
    );
  });
});
