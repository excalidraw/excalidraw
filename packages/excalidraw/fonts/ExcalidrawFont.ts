import { ENV } from "../constants";
import { stringToBase64, toByteString } from "../data/encode";

export interface Font {
  url: URL;
  fontFace: FontFace;
  getContent(): Promise<string>;
}

const BASE_URL = `https://unpkg.com/${import.meta.env.VITE_PKG_NAME}@${
  import.meta.env.PKG_VERSION
}/dist/prod/`;

export class ExcalidrawFont implements Font {
  public readonly url: URL;
  public readonly fontFace: FontFace;

  constructor(family: string, uri: string, descriptors?: FontFaceDescriptors) {
    // base urls will be applied for relative `uri`'s only
    this.url = new URL(
      // absolute paths won't work with baseurl in tests, so we are stripping it away
      import.meta.env.MODE === ENV.TEST && uri.startsWith("/")
        ? uri.slice(1)
        : uri,
      window.EXCALIDRAW_ASSET_PATH ?? BASE_URL,
    );

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
