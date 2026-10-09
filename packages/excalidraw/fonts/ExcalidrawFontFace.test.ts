import { ExcalidrawFontFace } from "./ExcalidrawFontFace";

const ASSET_PATH = "EXCALIDRAW_ASSET_PATH";
const DEFAULT_ASSET_PATH = window.EXCALIDRAW_ASSET_PATH;

/** the woff2 uri as registered by the bundled font definitions */
const FONT_URI = "/Excalifont/Excalifont-Regular.woff2";

const setAssetPath = (value: string | string[] | undefined) => {
  Object.defineProperty(window, ASSET_PATH, {
    value,
    writable: true,
    configurable: true,
  });
};

const urlsFor = (assetPath: string | string[] | undefined) => {
  setAssetPath(assetPath);
  return new ExcalidrawFontFace("Excalifont", FONT_URI).urls.map(String);
};

describe("ExcalidrawFontFace", () => {
  afterEach(() => {
    setAssetPath(DEFAULT_ASSET_PATH);
  });

  describe("resolves EXCALIDRAW_ASSET_PATH without throwing", () => {
    // regression test for #8870, where a non-absolute asset path made the
    // constructor throw `TypeError: Failed to construct 'URL': Invalid URL`,
    // which took down the whole editor on mount
    const cases: Array<[name: string, assetPath: string, expected: string]> = [
      ["bare relative path", "assets", "http://localhost:3000/assets/"],
      [
        "nested bare relative path",
        "assets/fonts",
        "http://localhost:3000/assets/fonts/",
      ],
      ["empty string", "", "http://localhost:3000/"],
      ["root-relative path", "/assets", "http://localhost:3000/assets/"],
      ["dot-relative path", "./assets", "http://localhost:3000/assets/"],
      [
        "surrounding whitespace",
        "  /assets  ",
        "http://localhost:3000/assets/",
      ],
      [
        "absolute url",
        "https://cdn.example.com/fonts",
        "https://cdn.example.com/fonts/",
      ],
      [
        "absolute url with trailing slash",
        "https://cdn.example.com/fonts/",
        "https://cdn.example.com/fonts/",
      ],
    ];

    for (const [name, assetPath, expected] of cases) {
      it(`${name}: ${JSON.stringify(assetPath)}`, () => {
        let urls: string[] = [];

        expect(() => {
          urls = urlsFor(assetPath);
        }).not.toThrow();

        expect(urls[0]).toBe(`${expected}Excalifont/Excalifont-Regular.woff2`);
      });
    }
  });

  it("resolves every entry of an array asset path", () => {
    const urls = urlsFor(["https://cdn.example.com/fonts", "assets"]);

    expect(urls.slice(0, 2)).toEqual([
      "https://cdn.example.com/fonts/Excalifont/Excalifont-Regular.woff2",
      "http://localhost:3000/assets/Excalifont/Excalifont-Regular.woff2",
    ]);
  });

  it("always appends the bundled-font fallback url last", () => {
    const withAssetPath = urlsFor("https://cdn.example.com/fonts");
    const withoutAssetPath = urlsFor(undefined);

    expect(withAssetPath).toHaveLength(2);
    expect(withoutAssetPath).toHaveLength(1);
    // the fallback is the same regardless of what the asset path resolved to
    expect(withAssetPath.at(-1)).toBe(withoutAssetPath.at(-1));
    expect(withAssetPath.at(-1)).toContain(
      "Excalifont/Excalifont-Regular.woff2",
    );
  });

  it("keeps the bundled-font fallback when an entry cannot be resolved", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // a protocol-prefixed but structurally invalid url can't be resolved, and
    // must not prevent the fallback from being registered
    const urls = urlsFor("http://");

    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("Excalifont/Excalifont-Regular.woff2");
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  it("does not build a url for data and local sources", () => {
    expect(
      new ExcalidrawFontFace("Excalifont", "data:font/woff2;base64,AAA").urls,
    ).toEqual(["data:font/woff2;base64,AAA"]);
    expect(
      new ExcalidrawFontFace("Helvetica", "local://Helvetica").urls,
    ).toEqual([]);
  });
});
