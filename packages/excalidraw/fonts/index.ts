import type Scene from "../scene/Scene";
import type { ValueOf } from "../utility-types";
import type { ExcalidrawTextElement, FontFamilyValues } from "../element/types";
import { ShapeCache } from "../scene/ShapeCache";
import { isTextElement } from "../element";
import { getFontString } from "../utils";
import { FONT_FAMILY } from "../constants";
import {
  LOCAL_FONT_PROTOCOL,
  FONT_METADATA,
  RANGES,
  type FontMetadata,
} from "./metadata";
import { ExcalidrawFont, type Font } from "./ExcalidrawFont";
import { getContainerElement } from "../element/textElement";

import Virgil from "./assets/Virgil-Regular.woff2";
import Excalifont from "./assets/Excalifont-Regular.woff2";
import Assistant from "./assets/Assistant-Regular.woff2";
import Cascadia from "./assets/CascadiaMono-Regular.woff2";
import Geist from "./assets/GeistMono-Regular.woff2";
import ComicShanns from "./assets/ComicShanns-Regular.woff2";
import LiberationSans from "./assets/LiberationSans-Regular.woff2";

import LilitaLatin from "https://fonts.gstatic.com/s/lilitaone/v15/i7dPIFZ9Zz-WBtRtedDbYEF8RXi4EwQ.woff2";
import LilitaLatinExt from "https://fonts.gstatic.com/s/lilitaone/v15/i7dPIFZ9Zz-WBtRtedDbYE98RXi4EwSsbg.woff2";

import NunitoLatin from "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshdTQ3j6zbXWjgeg.woff2";
import NunitoLatinExt from "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshdTo3j6zbXWjgevT5.woff2";
import NunitoCyrilic from "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshdTA3j6zbXWjgevT5.woff2";
import NunitoCyrilicExt from "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshdTk3j6zbXWjgevT5.woff2";
import NunitoVietnamese from "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshdTs3j6zbXWjgevT5.woff2";

export class Fonts {
  // it's ok to track fonts across multiple instances only once, so let's use
  // a static member to reduce memory footprint
  private static readonly loadedFontsCache = new Set<string>();

  private static _registered:
    | Map<
        number,
        {
          metadata: FontMetadata;
          fontFaces: Font[];
        }
      >
    | undefined;

  public static get registered() {
    if (!Fonts._registered) {
      // lazy load the fonts
      Fonts._registered = Fonts.init();
    }

    return Fonts._registered;
  }

  public get registered() {
    return Fonts.registered;
  }

  private readonly scene: Scene;

  public get sceneFamilies() {
    return Array.from(
      this.scene.getNonDeletedElements().reduce((families, element) => {
        if (isTextElement(element)) {
          families.add(element.fontFamily);
        }
        return families;
      }, new Set<number>()),
    );
  }

  constructor({ scene }: { scene: Scene }) {
    this.scene = scene;
  }

  /**
   * if we load a (new) font, it's likely that text elements using it have
   * already been rendered using a fallback font. Thus, we want invalidate
   * their shapes and rerender. See #637.
   *
   * Invalidates text elements and rerenders scene, provided that at least one
   * of the supplied fontFaces has not already been processed.
   */
  public onLoaded = (fontFaces: readonly FontFace[]) => {
    if (
      // bail if all fonts with have been processed. We're checking just a
      // subset of the font properties (though it should be enough), so it
      // can technically bail on a false positive.
      fontFaces.every((fontFace) => {
        const sig = `${fontFace.family}-${fontFace.style}-${fontFace.weight}-${fontFace.unicodeRange}`;
        if (Fonts.loadedFontsCache.has(sig)) {
          return true;
        }
        Fonts.loadedFontsCache.add(sig);
        return false;
      })
    ) {
      return false;
    }

    let didUpdate = false;

    const elementsMap = this.scene.getNonDeletedElementsMap();

    for (const element of this.scene.getNonDeletedElements()) {
      if (isTextElement(element)) {
        didUpdate = true;
        ShapeCache.delete(element);
        const container = getContainerElement(element, elementsMap);
        if (container) {
          ShapeCache.delete(container);
        }
      }
    }

    if (didUpdate) {
      this.scene.triggerUpdate();
    }
  };

  public load = async () => {
    // Add all registered font faces into the `document.fonts` (if not added already)
    for (const { fontFaces } of Fonts.registered.values()) {
      for (const { fontFace, url } of fontFaces) {
        if (
          url.protocol !== LOCAL_FONT_PROTOCOL &&
          !window.document.fonts.has(fontFace)
        ) {
          window.document.fonts.add(fontFace);
        }
      }
    }

    const loaded = await Promise.all(
      this.sceneFamilies.map(async (fontFamily) => {
        const fontString = getFontString({
          fontFamily,
          fontSize: 16,
        });

        // WARN: without "text" param it does not have to mean that all font faces are loaded, instead it could be just one!
        if (!window.document.fonts.check(fontString)) {
          try {
            // WARN: browser prioritizes loading only font faces with unicode ranges for characters which are present in the document (html & canvas), other font faces could stay unloaded
            // we might want to retry here, i.e.  in case CDN is down, but so far I didn't experience any issues - maybe it handles retry-like logic under the hood
            return await window.document.fonts.load(fontString);
          } catch (e) {
            // don't let it all fail if just one font fails to load
            console.error(
              `Failed to load font: "${fontString}" with error "${e}", given the following registered font:`,
              JSON.stringify(Fonts.registered.get(fontFamily), undefined, 2),
            );
          }
        }

        return Promise.resolve();
      }),
    );

    this.onLoaded(loaded.flat().filter(Boolean) as FontFace[]);
  };

  /**
   * WARN: should be called just once on init, even across multiple instances.
   */
  private static init() {
    const fonts = {
      registered: new Map<
        ValueOf<typeof FONT_FAMILY>,
        { metadata: FontMetadata; fontFaces: Font[] }
      >(),
    };

    const _register = register.bind(fonts);

    _register("Virgil", FONT_METADATA[FONT_FAMILY.Virgil], {
      uri: Virgil,
    });

    _register("Excalifont", FONT_METADATA[FONT_FAMILY.Excalifont], {
      uri: Excalifont,
    });

    // keeping for backwards compatibility reasons, uses system font (Helvetica on MacOS, Arial on Win)
    _register("Helvetica", FONT_METADATA[FONT_FAMILY.Helvetica], {
      uri: LOCAL_FONT_PROTOCOL,
    });

    // used for server-side pdf & png export instead of helvetica (technically does not need metrics, but kept for consistency)
    _register(
      "Liberation Sans",
      FONT_METADATA[FONT_FAMILY["Liberation Sans"]],
      {
        uri: LiberationSans,
      },
    );

    // used for frame labels on export
    _register("Assistant", FONT_METADATA[FONT_FAMILY.Assistant], {
      uri: Assistant,
    });

    _register("Cascadia", FONT_METADATA[FONT_FAMILY.Cascadia], {
      uri: Cascadia,
    });

    _register("Geist", FONT_METADATA[FONT_FAMILY.Geist], {
      uri: Geist,
    });

    _register("Comic Shanns", FONT_METADATA[FONT_FAMILY["Comic Shanns"]], {
      uri: ComicShanns,
    });

    _register(
      "Lilita One",
      FONT_METADATA[FONT_FAMILY["Lilita One"]],
      { uri: LilitaLatinExt, descriptors: { unicodeRange: RANGES.LATIN_EXT } },
      { uri: LilitaLatin, descriptors: { unicodeRange: RANGES.LATIN } },
    );

    _register(
      "Nunito",
      FONT_METADATA[FONT_FAMILY.Nunito],
      {
        uri: NunitoCyrilicExt,
        descriptors: { unicodeRange: RANGES.CYRILIC_EXT },
      },
      { uri: NunitoCyrilic, descriptors: { unicodeRange: RANGES.CYRILIC } },
      {
        uri: NunitoVietnamese,
        descriptors: { unicodeRange: RANGES.VIETNAMESE },
      },
      { uri: NunitoLatinExt, descriptors: { unicodeRange: RANGES.LATIN_EXT } },
      { uri: NunitoLatin, descriptors: { unicodeRange: RANGES.LATIN } },
    );

    return fonts.registered;
  }
}

/**
 * Register a new font.
 *
 * @param family font family
 * @param metadata font metadata
 * @param params array of the rest of the FontFace parameters [uri: string, descriptors: FontFaceDescriptors?] ,
 */
function register(
  this:
    | Fonts
    | {
        registered: Map<
          ValueOf<typeof FONT_FAMILY>,
          { metadata: FontMetadata; fontFaces: Font[] }
        >;
      },
  family: string,
  metadata: FontMetadata,
  ...params: Array<{ uri: string; descriptors?: FontFaceDescriptors }>
) {
  // TODO: likely we will need to abandon number "id" in order to support custom fonts
  const familyId = FONT_FAMILY[family as keyof typeof FONT_FAMILY];
  const registeredFamily = this.registered.get(familyId);

  if (!registeredFamily) {
    this.registered.set(familyId, {
      metadata,
      fontFaces: params.map(
        ({ uri, descriptors }) => new ExcalidrawFont(family, uri, descriptors),
      ),
    });
  }

  return this.registered;
}

/**
 * Calculates vertical offset for a text with alphabetic baseline.
 */
export const getVerticalOffset = (
  fontFamily: ExcalidrawTextElement["fontFamily"],
  fontSize: ExcalidrawTextElement["fontSize"],
  lineHeightPx: number,
) => {
  const { unitsPerEm, ascender, descender } =
    Fonts.registered.get(fontFamily)?.metadata.metrics ||
    FONT_METADATA[FONT_FAMILY.Virgil].metrics;

  const fontSizeEm = fontSize / unitsPerEm;
  const lineGap =
    (lineHeightPx - fontSizeEm * ascender + fontSizeEm * descender) / 2;

  const verticalOffset = fontSizeEm * ascender + lineGap;
  return verticalOffset;
};

/**
 * Gets line height forr a selected family.
 */
export const getLineHeight = (fontFamily: FontFamilyValues) => {
  const { lineHeight } =
    Fonts.registered.get(fontFamily)?.metadata.metrics ||
    FONT_METADATA[FONT_FAMILY.Excalifont].metrics;

  return lineHeight as ExcalidrawTextElement["lineHeight"];
};
