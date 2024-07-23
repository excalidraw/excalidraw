import { stringToBase64, toByteString } from "../data/encode";

export interface Font {
  url: URL;
  fontFace: FontFace;
  getContent(): Promise<string>;
}
export const UNPKG_PROD_URL = `https://unpkg.com/${
  import.meta.env.VITE_PKG_NAME
}@${import.meta.env.PKG_VERSION}/dist/prod/`;

export class ExcalidrawFont implements Font {
  public readonly url: URL;
  public readonly fontFace: FontFace;

  constructor(family: string, uri: string, descriptors?: FontFaceDescriptors) {
    // absolute assets paths, which are found in tests and excalidraw-app build, won't work with base url, so we are stripping initial slash away
    const assetUrl: string = uri.replace(/^\/+/, "");
    let baseUrl: string | undefined = undefined;

    // fallback to unpkg to form a valid URL in case of a passed relative assetUrl
    let baseUrlBuilder = window.EXCALIDRAW_ASSET_PATH || UNPKG_PROD_URL;

    // in case user passed a root-relative url (~absolute path),
    // like "/" or "/some/path", or relative (starts with "./"),
    // prepend it with `location.origin`
    if (/^\.?\//.test(baseUrlBuilder)) {
      baseUrlBuilder = new URL(
        baseUrlBuilder.replace(/^\.?\/+/, ""),
        window?.location?.origin,
      ).toString();
    }

    // ensure there is a trailing slash, otherwise url won't be correctly concatenated
    baseUrl = `${baseUrlBuilder.replace(/\/+$/, "")}/`;

    this.url = new URL(assetUrl, baseUrl);
    this.fontFace = new FontFace(family, `url(${this.url})`, {
      display: "swap",
      style: "normal",
      weight: "400",
      ...descriptors,
    });
  }

  /**
   * Fetches woff2 content based on the registered url (browser).
   *
   * Use dataurl outside the browser environment.
   */
  public async getContent(): Promise<string> {
    if (this.url.protocol === "data:") {
      // it's dataurl, the font is inlined as base64, no need to fetch
      return this.url.toString();
    }

    const response = await fetch(this.url, {
      headers: {
        Accept: "font/woff2",
      },
    });

    if (!response.ok) {
      console.error(
        `Couldn't fetch font-family "${this.fontFace.family}" from url "${this.url}"`,
        response,
      );
    }

    const mimeType = await response.headers.get("Content-Type");
    const buffer = await response.arrayBuffer();

    return `data:${mimeType};base64,${await stringToBase64(
      await toByteString(buffer),
      true,
    )}`;
  }
}
