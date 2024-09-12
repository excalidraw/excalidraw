import {
  base64ToArrayBuffer,
  stringToBase64,
  toByteString,
} from "../data/encode";
import { LOCAL_FONT_PROTOCOL } from "./metadata";
import loadWoff2 from "./wasm/woff2.loader";
import loadHbSubset from "./wasm/hb-subset.loader";

export interface Font {
  urls: URL[];
  fontFace: FontFace;
  getContent(codePoints: ReadonlySet<number>): Promise<string>;
}
export const UNPKG_FALLBACK_URL = `https://unpkg.com/${
  import.meta.env.VITE_PKG_NAME
    ? `${import.meta.env.VITE_PKG_NAME}@${import.meta.env.PKG_VERSION}` // should be provided by vite during package build
    : "@excalidraw/excalidraw" // fallback to latest package version (i.e. for app)
}/dist/prod/`;

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
   * Tries to fetch woff2 content, based on the registered urls (from first to last, treated as fallbacks).
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

      // it's dataurl (server), the font is inlined as base64, no need to fetch
      if (url.protocol === "data:") {
        const arrayBuffer = base64ToArrayBuffer(url.toString().split(",")[1]);

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
   * Tries to subset glyphs in a font based on the used codepoints, returning the font as daturl.
   *
   * @param arrayBuffer font data buffer, preferrably in the woff2 format, though others should work as well
   * @param codePoints codepoints used to subset the glyphs
   *
   * @returns font with subsetted glyphs (all glyphs in case of errors) converted into a dataurl
   */
  private static async subsetGlyphsByCodePoints(
    arrayBuffer: ArrayBuffer,
    codePoints: ReadonlySet<number>,
  ): Promise<string> {
    try {
      // lazy loaded wasm modules to avoid multiple initializations in case of concurrent triggers
      const { compress, decompress } = await loadWoff2();
      const { subset } = await loadHbSubset();

      const decompressedBinary = decompress(arrayBuffer).buffer;
      const subsetSnft = subset(decompressedBinary, codePoints);
      const compressedBinary = compress(subsetSnft.buffer);

      return ExcalidrawFont.toBase64(compressedBinary.buffer);
    } catch (e) {
      console.error("Skipped glyph subsetting", e);
      // Fallback to encoding whole font in case of errors
      return ExcalidrawFont.toBase64(arrayBuffer);
    }
  }

  private static async toBase64(arrayBuffer: ArrayBuffer) {
    let base64: string;

    if (typeof Buffer !== "undefined") {
      // node + server-side
      base64 = Buffer.from(arrayBuffer).toString("base64");
    } else {
      base64 = await stringToBase64(await toByteString(arrayBuffer), true);
    }

    return `data:font/woff2;base64,${base64}`;
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
    urls.push(new URL(assetUrl, UNPKG_FALLBACK_URL));

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
