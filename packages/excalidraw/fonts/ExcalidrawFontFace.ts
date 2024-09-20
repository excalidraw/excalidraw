import { LOCAL_FONT_PROTOCOL } from "./metadata";
import { subsetWoff2GlyphsByCodepoints } from "./subset/subset-main";

export interface IExcalidrawFontFace {
  urls: URL[];
  fontFace: FontFace;
  toCSS(
    characters: string,
    codePoints: Array<number>,
  ): Promise<string> | undefined;
}

export class ExcalidrawFontFace implements IExcalidrawFontFace {
  public readonly urls: URL[];
  public readonly fontFace: FontFace;

  private static readonly UNPKG_FALLBACK_URL = `https://unpkg.com/${
    import.meta.env.VITE_PKG_NAME
      ? `${import.meta.env.VITE_PKG_NAME}@${import.meta.env.PKG_VERSION}` // should be provided by vite during package build
      : "@excalidraw/excalidraw" // fallback to latest package version (i.e. for app)
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
  public toCSS(
    characters: string,
    codePoints: Array<number>,
  ): Promise<string> | undefined {
    // quick exit in case the characters are not within this font face's unicode range
    if (!this.getUnicodeRangeRegex().test(characters)) {
      return;
    }

    return this.getContent(codePoints).then(
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
        const response = await fetch(url, {
          headers: {
            Accept: "font/woff2",
          },
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const base64 = await subsetWoff2GlyphsByCodepoints(
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

  private getUnicodeRangeRegex() {
    // TODO: consider having actual unicode ranges for all the fonts or even splitting the exiting fonts based on the ranges
    const ranges = this.fontFace.unicodeRange
      .split(", ")
      .map((range) => {
        const [start, end] = range.replace("U+", "").split("-");
        if (end) {
          return `\\u${start}-\\u${end}`;
        }
        return `\\u${start}`;
      })
      .join("");

    return new RegExp(`[${ranges}]`);
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
    urls.push(new URL(assetUrl, ExcalidrawFontFace.UNPKG_FALLBACK_URL));

    return urls;
  }

  private static getFormat(url: URL) {
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
