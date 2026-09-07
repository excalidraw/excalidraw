import { promiseTry, LOCAL_FONT_PROTOCOL } from "@excalidraw/common";

import { subsetWoff2GlyphsByCodepoints } from "../subset/subset-main";

type DataURL = string;

export class ExcalidrawFontFace {
  public readonly urls: URL[] | DataURL[];
  public readonly fontFace: FontFace;

  /**
   * The family as we know it, i.e. "Excalifont" or "google:Roboto" - our
   * source of truth. Prefer it over `fontFace.family`, the browser's
   * *serialized* CSS value, which comes back quoted for some families.
   */
  public readonly family: string;

  /**
   * The family as a CSS `<family-name>`, always quoted - for *emitted CSS*
   * only. Plenty of real families are not a valid ident sequence: our
   * provider-qualified ones (":" is not an ident character), but also catalog
   * names with a digit-leading word, i.e. "Press Start 2P". Quoting covers all
   * of them; strict implementations throw a SyntaxError on the rest.
   */
  private readonly cssFontFamily: string;
  private readonly descriptors?: FontFaceDescriptors;

  private static readonly ASSETS_FALLBACK_URL = `https://esm.sh/${
    import.meta.env.PKG_NAME
      ? `${import.meta.env.PKG_NAME}@${import.meta.env.PKG_VERSION}` // is provided during package build
      : "@excalidraw/excalidraw" // fallback to the latest package version (i.e. for app)
  }/dist/prod/`;

  constructor(family: string, uri: string, descriptors?: FontFaceDescriptors) {
    this.urls = ExcalidrawFontFace.createUrls(uri);
    this.family = family;
    this.cssFontFamily = JSON.stringify(family);
    this.descriptors = descriptors;

    const sources = this.urls
      .map((url) => `url(${url}) ${ExcalidrawFontFace.getFormat(url)}`)
      .join(", ");

    // WARN: the raw family, *not* `cssFontFamily` - it takes the name itself,
    // so a pre-quoted value double-quotes and matches nothing
    this.fontFace = new FontFace(this.family, sources, {
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

    // carry the face's distinguishing descriptors into the declaration, or a
    // multi-weight / italic / unicode-ranged family collapses into one bucket
    // and viewers match the wrong face. From our own descriptors, as browser
    // `FontFace` serialization differs per engine; defaults are omitted
    const cssDescriptors = [
      this.descriptors?.style &&
        this.descriptors.style !== "normal" &&
        `font-style: ${this.descriptors.style};`,
      this.descriptors?.weight &&
        this.descriptors.weight !== "400" &&
        `font-weight: ${this.descriptors.weight};`,
      this.descriptors?.unicodeRange &&
        `unicode-range: ${this.descriptors.unicodeRange};`,
    ]
      .filter(Boolean)
      .join(" ");

    return this.getContent(codepoints).then(
      (content) =>
        `@font-face { font-family: ${
          this.cssFontFamily
        }; src: url(${content});${
          cssDescriptors ? ` ${cssDescriptors}` : ""
        } }`,
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
      `Failed to fetch font family "${this.family}"`,
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
    // prefer our own descriptor - `fontFace.unicodeRange` is the browser's
    // serialization of it (and a hardcoded stub in tests). A real gate here
    // also keeps non-intersecting faces out of exports entirely
    const unicodeRange =
      this.descriptors?.unicodeRange ?? this.fontFace.unicodeRange;

    // using \u{h} or \u{hhhhh} to match any number of hex digits,
    // otherwise we would get an "Invalid Unicode escape" error
    // e.g. U+0-1007F -> \u{0}-\u{1007F}
    const unicodeRangeRegex = unicodeRange
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
    urls.push(new URL(assetUrl, ExcalidrawFontFace.ASSETS_FALLBACK_URL));

    return urls;
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
