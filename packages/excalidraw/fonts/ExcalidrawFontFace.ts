import { promiseTry, LOCAL_FONT_PROTOCOL } from "@excalidraw/common";

import { subsetWoff2GlyphsByCodepoints } from "../subset/subset-main";

type DataURL = string;

export class ExcalidrawFontFace {
  public readonly urls: URL[] | DataURL[];
  public readonly fontFace: FontFace;

  private static readonly ASSETS_FALLBACK_URL = `https://esm.sh/${
    import.meta.env.PKG_NAME
      ? `${import.meta.env.PKG_NAME}@${import.meta.env.PKG_VERSION}` // is provided during package build
      : "@excalidraw/excalidraw" // fallback to the latest package version (i.e. for app)
  }/dist/prod/`;

  constructor(family: string, uri: string, descriptors?: FontFaceDescriptors) {
    this.urls = ExcalidrawFontFace.createUrls(uri);

    const sources = this.urls
      .map((url) => `url(${url}) ${ExcalidrawFontFace.getFormat(url)}`)
      .join(", ");

    this.fontFace = new FontFace(family, sources, {
      display: "swap",
      style: "normal",
      weight: "400",
      ...descriptors,
    });
  }

  /**
   * Generates CSS `@font-face` definition with the (subsetted) font source as a data url for the characters within the unicode range.
   *
   * Retrieves `undefined` otherwise.
   */
  public toCSS(characters: string): Promise<string> | undefined {
    // quick exit in case the characters are not within this font face's unicode range
    if (!this.getUnicodeRangeRegex().test(characters)) {
      return;
    }

    const codepoints = Array.from(characters).map(
      (char) => char.codePointAt(0)!,
    );

    return this.getContent(codepoints).then(
      (content) =>
        `@font-face { font-family: ${this.fontFace.family}; src: url(${content}); }`,
    );
  }

  /**
   * Tries to fetch woff2 content, based on the registered urls (from first to last, treated as fallbacks).
   *
   * @returns base64 with subsetted glyphs based on the passed codepoint, last defined url otherwise
   */
  public async getContent(codePoints: Array<number>): Promise<string> {
    let i = 0;
    const errorMessages = [];

    while (i < this.urls.length) {
      const url = this.urls[i];

      try {
        const arrayBuffer = await this.fetchFont(url);
        const base64 = await subsetWoff2GlyphsByCodepoints(
          arrayBuffer,
          codePoints,
        );

        return base64;
      } catch (e) {
        errorMessages.push(`"${url.toString()}" returned error "${e}"`);
      }

      i++;
    }

    console.error(
      `Failed to fetch font family "${this.fontFace.family}"`,
      JSON.stringify(errorMessages, undefined, 2),
    );

    // in case of issues, at least return the last url as a content
    // defaults to unpkg for bundled fonts (so that we don't have to host them forever) and http url for others
    return this.urls.length ? this.urls[this.urls.length - 1].toString() : "";
  }

  public fetchFont(url: URL | DataURL): Promise<ArrayBuffer> {
    return promiseTry(async () => {
      const response = await fetch(url, {
        // always prefer cache (even stale), otherwise it always triggers an unnecessary validation request
        // which we don't need as we are controlling freshness of the fonts with the stable hash suffix in the url
        // https://developer.mozilla.org/en-US/docs/Web/API/Request/cache
        cache: "force-cache",
        headers: {
          Accept: "font/woff2",
        },
      });

      if (!response.ok) {
        const urlString = url instanceof URL ? url.toString() : "dataurl";
        throw new Error(
          `Failed to fetch "${urlString}": ${response.statusText}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return arrayBuffer;
    });
  }

  private getUnicodeRangeRegex() {
    // using \u{h} or \u{hhhhh} to match any number of hex digits,
    // otherwise we would get an "Invalid Unicode escape" error
    // e.g. U+0-1007F -> \u{0}-\u{1007F}
    const unicodeRangeRegex = this.fontFace.unicodeRange
      .split(/,\s*/)
      .map((range) => {
        const [start, end] = range.replace("U+", "").split("-");
        if (end) {
          return `\\u{${start}}-\\u{${end}}`;
        }

        return `\\u{${start}}`;
      })
      .join("");

    return new RegExp(`[${unicodeRangeRegex}]`, "u");
  }

  private static createUrls(uri: string): URL[] | DataURL[] {
    if (uri.startsWith("data")) {
      // don't create the URL instance, as parsing the huge dataurl string is expensive
      return [uri];
    }

    if (uri.startsWith(LOCAL_FONT_PROTOCOL)) {
      // no url for local fonts
      return [];
    }

    if (uri.startsWith("http")) {
      // one url for http imports or data url
      return [new URL(uri)];
    }

    // absolute assets paths, which are found in tests and excalidraw-app build, won't work with base url, so we are stripping initial slash away
    const assetUrl: string = uri.replace(/^\/+/, "");
    const urls = ExcalidrawFontFace.getBaseUrls().map(
      (baseUrl) => new URL(assetUrl, baseUrl),
    );

    // fallback url for bundled fonts
    urls.push(new URL(assetUrl, ExcalidrawFontFace.ASSETS_FALLBACK_URL));

    return urls;
  }

  /** resolved once per `EXCALIDRAW_ASSET_PATH` value, rather than per font face */
  private static baseUrlsCache: {
    assetPath: Window["EXCALIDRAW_ASSET_PATH"];
    baseUrls: string[];
  } | null = null;

  /**
   * Resolves `EXCALIDRAW_ASSET_PATH` entries into absolute base urls.
   *
   * Never throws, so that a malformed custom asset path degrades to the other
   * entries and the CDN fallback instead of taking down the whole editor on mount.
   */
  private static getBaseUrls(): string[] {
    const assetPath = window.EXCALIDRAW_ASSET_PATH;
    const cache = ExcalidrawFontFace.baseUrlsCache;

    if (cache && cache.assetPath === assetPath) {
      return cache.baseUrls;
    }

    const basePaths =
      typeof assetPath === "string"
        ? [assetPath]
        : Array.isArray(assetPath)
        ? assetPath
        : [];

    const baseUrls: string[] = [];

    for (const basePath of basePaths) {
      // treat blank entries as not set (i.e. an unset env var rendered as ""),
      // otherwise they would resolve to the origin root
      if (!basePath.trim()) {
        continue;
      }

      try {
        baseUrls.push(ExcalidrawFontFace.normalizeBaseUrl(basePath));
      } catch (error) {
        console.warn(
          `Skipping invalid EXCALIDRAW_ASSET_PATH entry "${basePath}". Fonts will be loaded from the other entries, if any, or from "${ExcalidrawFontFace.ASSETS_FALLBACK_URL}".`,
          error,
        );
      }
    }

    ExcalidrawFontFace.baseUrlsCache = { assetPath, baseUrls };

    return baseUrls;
  }

  private static getFormat(url: URL | DataURL) {
    if (!(url instanceof URL)) {
      // format is irrelevant for data url
      return "";
    }

    try {
      const parts = new URL(url).pathname.split(".");

      if (parts.length === 1) {
        return "";
      }

      return `format('${parts.pop()}')`;
    } catch (error) {
      return "";
    }
  }

  private static normalizeBaseUrl(baseUrl: string) {
    // `new URL(asset, base)` requires `base` to be an absolute url, so relative
    // paths ("/", "./assets", "assets") are resolved against `location.origin`,
    // i.e. the same way no matter which page the editor is mounted on
    const url = ExcalidrawFontFace.parseUrl(baseUrl.trim());
    if (/^[a-z]:$/i.test(url.protocol)) {
      throw new Error(`"${baseUrl}" is a file path, not an url`);
    }

    // ensure there is a trailing slash, otherwise url won't be correctly concatenated
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;

    if (!url.pathname.startsWith("/")) {
      throw new Error(`"${baseUrl}" can't be used as a base url`);
    }

    return url.toString();
  }

  private static parseUrl(baseUrl: string) {
    try {
      // absolute urls are parsed on their own, as `new URL()` throws on an
      // invalid base even when it's not used, and the origin is "null" in
      // opaque origins (i.e. sandboxed iframes, `file://` pages in Firefox)
      return new URL(baseUrl);
    } catch {
      return new URL(baseUrl, window.location.origin);
    }
  }
}
