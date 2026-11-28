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
    // also re-resolves the memoized base urls, so that each test resolves its
    // asset path anew, regardless of what the previous test ended with
    urlsFor(DEFAULT_ASSET_PATH);
    document.querySelectorAll("base").forEach((base) => base.remove());
    window.history.replaceState(null, "", window.location.origin);
    vi.restoreAllMocks();
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
      [
        "protocol-relative url",
        "//cdn.example.com/fonts",
        "http://cdn.example.com/fonts/",
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

  describe("resolves relative paths against the page origin", () => {
    it("regardless of the page path", () => {
      window.history.replaceState(null, "", "/app/editor");

      expect(urlsFor("subpath-assets")[0]).toBe(
        "http://localhost:3000/subpath-assets/Excalifont/Excalifont-Regular.woff2",
      );
      expect(urlsFor("./subpath-assets")[0]).toBe(
        "http://localhost:3000/subpath-assets/Excalifont/Excalifont-Regular.woff2",
      );
      expect(urlsFor("../subpath-assets")[0]).toBe(
        "http://localhost:3000/subpath-assets/Excalifont/Excalifont-Regular.woff2",
      );
      expect(urlsFor("/subpath-assets")[0]).toBe(
        "http://localhost:3000/subpath-assets/Excalifont/Excalifont-Regular.woff2",
      );
    });

    it("ignoring <base href>", () => {
      const base = document.createElement("base");
      base.href = "https://static.example.com/build/index.html";
      document.head.appendChild(base);

      expect(urlsFor("./base-fonts/")[0]).toBe(
        "http://localhost:3000/base-fonts/Excalifont/Excalifont-Regular.woff2",
      );
      expect(urlsFor("/")[0]).toBe(
        "http://localhost:3000/Excalifont/Excalifont-Regular.woff2",
      );
    });
  });

  it("treats blank entries as not set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    window.history.replaceState(null, "", "/app/editor");

    const fallbackOnly = urlsFor(undefined);

    expect(urlsFor("")).toEqual(fallbackOnly);
    expect(urlsFor("  ")).toEqual(fallbackOnly);
    expect(urlsFor(["", "https://cdn.example.com/fonts"])).toEqual([
      "https://cdn.example.com/fonts/Excalifont/Excalifont-Regular.woff2",
      ...fallbackOnly,
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps the last path segment of a base url with a query or a hash", () => {
    expect(urlsFor("https://cdn.example.com/fonts?v=1")[0]).toBe(
      "https://cdn.example.com/fonts/Excalifont/Excalifont-Regular.woff2",
    );
    expect(urlsFor("assets#x")[0]).toBe(
      "http://localhost:3000/assets/Excalifont/Excalifont-Regular.woff2",
    );
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

    // names where the fonts come from instead, i.e. the CDN
    expect(warn.mock.calls[0][0]).toContain("https://esm.sh/");

    // warned once per asset path, not per font face
    urlsFor("http://");
    expect(warn).toHaveBeenCalledTimes(1);

    // a changed asset path is resolved again
    urlsFor(["https://cdn.example.com/fonts", "http://"]);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("skips entries which can't be fetched from, keeps custom protocols", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fallbackOnly = urlsFor(undefined);

    expect(urlsFor("C:/fonts")).toEqual(fallbackOnly);
    expect(urlsFor("c:\\fonts")).toEqual(fallbackOnly);
    expect(urlsFor("localhost:3000/fonts")).toEqual(fallbackOnly);
    expect(urlsFor("mailto:fonts")).toEqual(fallbackOnly);
    expect(warn).toHaveBeenCalledTimes(4);

    expect(urlsFor("app://bundle/fonts")[0]).toBe(
      "app://bundle/fonts/Excalifont/Excalifont-Regular.woff2",
    );
  });

  it("resolves absolute urls in an opaque origin", () => {
    // i.e. sandboxed iframes, where `location.origin` is "null"
    vi.stubGlobal("location", { ...window.location, origin: "null" });

    try {
      expect(urlsFor("https://cdn.example.com/fonts")[0]).toBe(
        "https://cdn.example.com/fonts/Excalifont/Excalifont-Regular.woff2",
      );
      expect(urlsFor("file:///app/fonts")[0]).toBe(
        "file:///app/fonts/Excalifont/Excalifont-Regular.woff2",
      );
    } finally {
      vi.unstubAllGlobals();
    }
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
