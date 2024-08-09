import { LOCAL_FONT_PROTOCOL } from "./metadata";

export interface Font {
  urls: URL[];
  fontFace: FontFace;
  getContent(codePoints: ReadonlySet<number>): Promise<string>;
}
export const UNPKG_PROD_URL = `https://unpkg.com/${
  import.meta.env.VITE_PKG_NAME
    ? `${import.meta.env.VITE_PKG_NAME}@${import.meta.env.PKG_VERSION}` // should be provided by vite during package build
    : "@excalidraw/excalidraw" // fallback to latest package version (i.e. for app)
}/dist/prod/`;

/** caches for lazy loaded chunks, reused across concurrent calls and separate editor instances */
let fontEditorCache: Promise<typeof import("fonteditor-core")> | null = null;
let brotliCache: Promise<typeof import("fonteditor-core").woff2> | null = null;

export class ExcalidrawFont implements Font {
  public readonly urls: URL[];
  public readonly fontFace: FontFace;

  constructor(family: string, uri: string, descriptors?: FontFaceDescriptors) {
    this.urls = ExcalidrawFont.createUrls(uri);

    const sources = this.urls
      .map((url) => `url(${url}) ${ExcalidrawFont.getFormat(url)}`)
      .join(", ");

    this.fontFace = new FontFace(family, sources, {
      display: "swap",
      style: "normal",
      weight: "400",
      ...descriptors,
    });
  }

  /**
   * Tries to fetch woff2 content, based on the registered urls.
   *
   * NOTE: assumes usage of `dataurl` outside the browser environment
   *
   * @returns base64 with subsetted glyphs based on the passed codepoint, last defined url otherwise
   */
  public async getContent(codePoints: ReadonlySet<number>): Promise<string> {
    let i = 0;
    const errorMessages = [];

    while (i < this.urls.length) {
      const url = this.urls[i];

      // it's dataurl, the font is inlined as base64, no need to fetch
      if (url.protocol === "data:") {
        const arrayBuffer = Buffer.from(
          url.toString().split(",")[1],
          "base64",
        ).buffer;

        const base64 = await ExcalidrawFont.subsetGlyphsByCodePoints(
          arrayBuffer,
          codePoints,
        );

        return base64;
      }

      try {
        const response = await fetch(url, {
          headers: {
            Accept: "font/woff2",
          },
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const base64 = await ExcalidrawFont.subsetGlyphsByCodePoints(
            arrayBuffer,
            codePoints,
          );
          return base64;
        }

        // response not ok, try to continue
        errorMessages.push(
          `"${url.toString()}" returned status "${response.status}"`,
        );
      } catch (e) {
        errorMessages.push(`"${url.toString()}" returned error "${e}"`);
      }

      i++;
    }

    console.error(
      `Failed to fetch font "${
        this.fontFace.family
      }" from urls "${this.urls.toString()}`,
      JSON.stringify(errorMessages, undefined, 2),
    );

    // in case of issues, at least return the last url as a content
    // defaults to unpkg for bundled fonts (so that we don't have to host them forever) and http url for others
    return this.urls.length ? this.urls[this.urls.length - 1].toString() : "";
  }

  /**
   * Converts a font data as arraybuffer into a dataurl (base64) with subsetted glyphs based on the specified `codePoints`.
   *
   * NOTE: only glyphs are subsetted, other metadata as GPOS tables stay, consider filtering those as well in the future
   *
   * @param arrayBuffer font data buffer, preferrably in the woff2 format, though others should work as well
   * @param codePoints codepoints used to subset the glyphs
   *
   * @returns font with subsetted glyphs converted into a dataurl
   */
  private static async subsetGlyphsByCodePoints(
    arrayBuffer: ArrayBuffer,
    codePoints: ReadonlySet<number>,
  ): Promise<string> {
    // checks for the cache first to avoid triggering the import multiple times in case of concurrent calls
    if (!fontEditorCache) {
      fontEditorCache = import("fonteditor-core");
    }

    const { Font, woff2 } = await fontEditorCache;

    // checks for the cache first to avoid triggering the init multiple times in case of concurrent calls
    if (!brotliCache) {
      brotliCache = woff2.init("/wasm/woff2.wasm");
    }

    await brotliCache;

    const font = Font.create(arrayBuffer, {
      type: "woff2",
      kerning: true,
      hinting: true,
      // subset the glyhs based on the specified codepoints!
      subset: [...codePoints],
    });

    return font.toBase64({ type: "woff2", hinting: true });
  }

  private static createUrls(uri: string): URL[] {
    if (uri.startsWith(LOCAL_FONT_PROTOCOL)) {
      // no url for local fonts
      return [];
    }

    if (uri.startsWith("http") || uri.startsWith("data")) {
      // one url for http imports or data url
      return [new URL(uri)];
    }

    // absolute assets paths, which are found in tests and excalidraw-app build, won't work with base url, so we are stripping initial slash away
    const assetUrl: string = uri.replace(/^\/+/, "");
    const urls: URL[] = [];

    if (typeof window.EXCALIDRAW_ASSET_PATH === "string") {
      const normalizedBaseUrl = this.normalizeBaseUrl(
        window.EXCALIDRAW_ASSET_PATH,
      );

      urls.push(new URL(assetUrl, normalizedBaseUrl));
    } else if (Array.isArray(window.EXCALIDRAW_ASSET_PATH)) {
      window.EXCALIDRAW_ASSET_PATH.forEach((path) => {
        const normalizedBaseUrl = this.normalizeBaseUrl(path);
        urls.push(new URL(assetUrl, normalizedBaseUrl));
      });
    }

    // fallback url for bundled fonts
    urls.push(new URL(assetUrl, UNPKG_PROD_URL));

    return urls;
  }

  private static getFormat(url: URL) {
    try {
      const pathname = new URL(url).pathname;
      const parts = pathname.split(".");

      if (parts.length === 1) {
        return "";
      }

      return `format('${parts.pop()}')`;
    } catch (error) {
      return "";
    }
  }

  private static normalizeBaseUrl(baseUrl: string) {
    let result = baseUrl;

    // in case user passed a root-relative url (~absolute path),
    // like "/" or "/some/path", or relative (starts with "./"),
    // prepend it with `location.origin`
    if (/^\.?\//.test(result)) {
      result = new URL(
        result.replace(/^\.?\/+/, ""),
        window?.location?.origin,
      ).toString();
    }

    // ensure there is a trailing slash, otherwise url won't be correctly concatenated
    result = `${result.replace(/\/+$/, "")}/`;

    return result;
  }
}
