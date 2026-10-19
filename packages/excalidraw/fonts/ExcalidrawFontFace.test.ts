import { ExcalidrawFontFace } from "./ExcalidrawFontFace";

const createFontFace = (descriptors?: FontFaceDescriptors) => {
  const fontFace = new ExcalidrawFontFace(
    "Excalifont",
    "https://example.com/Excalifont.woff2",
    descriptors,
  );

  // simulate a non-browser `FontFace` implementation — the polyfills needed to
  // run exports in node commonly don't expose `unicodeRange` at all (#10604)
  Reflect.deleteProperty(fontFace.fontFace, "unicodeRange");

  // we're only exercising the unicode-range gate, so skip fetching & subsetting
  vi.spyOn(fontFace, "getContent").mockResolvedValue("data:font/woff2;base64,");

  return fontFace;
};

describe("ExcalidrawFontFace", () => {
  it("generates css when the host FontFace doesn't expose a unicode range", async () => {
    await expect(createFontFace().toCSS("Hello")).resolves.toContain(
      "@font-face",
    );
  });

  it("honors the declared unicode range when the host FontFace doesn't expose it", async () => {
    // cyrillic-only subset
    const descriptors = { unicodeRange: "U+400-45f" };

    expect(createFontFace(descriptors).toCSS("Hello")).toBeUndefined();
    await expect(
      createFontFace(descriptors).toCSS("Привет"),
    ).resolves.toContain("@font-face");
  });
});
