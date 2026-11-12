import {
  FONT_PROVIDER_SEPARATOR,
  createProviderFontFamily,
  parseProviderFontFamily,
} from "@excalidraw/common";

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
