import type Scene from "../scene/Scene";
import type { ValueOf } from "../utility-types";
import type { ExcalidrawTextElement, FontFamilyValues } from "../element/types";
import { ShapeCache } from "../scene/ShapeCache";
import { isTextElement } from "../element";
import { newElementWith } from "../element/mutateElement";
import { getFontString } from "../utils";
import { FONT_FAMILY } from "../constants";
import { DEFAULT_FONT_METRICS, RANGES, type FontMetrics } from "./metrics";
import { ExcalidrawFont, type Font } from "./ExcalidrawFont";

import Virgil from "./assets/Virgil.woff2";
import Excalifont from "./assets/Excalifont.woff2";
import AssistantRegular from "./assets/Assistant-Regular.woff2";
import AssistantMedium from "./assets/Assistant-Medium.woff2";
import AssistantSemiBold from "./assets/Assistant-SemiBold.woff2";
import AssistantBold from "./assets/Assistant-Bold.woff2";
import Cascadia from "./assets/CascadiaMono-Regular.woff2";
import ComicShanns from "./assets/ComicShanns2.woff2";
import LiberationSans from "./assets/LiberationSans-Regular.woff2";

import BangersLatin from "https://fonts.gstatic.com/s/bangers/v24/FeVQS0BTqb0h60ACH55Q2J5hm24.woff2";
import BangersLatinExt from "https://fonts.gstatic.com/s/bangers/v24/FeVQS0BTqb0h60ACH5BQ2J5hm25mww.woff2";
import BangersVietnamese from "https://fonts.gstatic.com/s/bangers/v24/FeVQS0BTqb0h60ACH5FQ2J5hm25mww.woff2";

import NunitoLatin from "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshdTQ3j6zbXWjgeg.woff2";
import NunitoLatinExt from "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshdTo3j6zbXWjgevT5.woff2";
import NunitoCyrilic from "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshdTA3j6zbXWjgevT5.woff2";
import NunitoCyrilicExt from "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshdTk3j6zbXWjgevT5.woff2";
import NunitoVietnamese from "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshdTs3j6zbXWjgevT5.woff2";

import PacificoLatin from "https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6H6MmBp0u-.woff2";
import PacificoLatinExt from "https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6J6MmBp0u-zK4.woff2";
import PacificoCyrlicExt from "https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6K6MmBp0u-zK4.woff2";
import PacificoVietnamese from "https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6I6MmBp0u-zK4.woff2";

import PermanentMarker from "https://fonts.gstatic.com/s/permanentmarker/v16/Fh4uPib9Iyv2ucM6pGQMWimMp004La2Cf5b6jlg.woff2";

export class Fonts {
  // it's ok to track fonts across multiple instances only once, so let's use
  // a static member to reduce memory footprint
  private static readonly loadedFontsCache = new Set<string>();
  public static readonly registered = Fonts.init();

  private readonly scene: Scene;

  public get registered() {
    return Fonts.registered;
  }

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

    this.scene.mapElements((element) => {
      if (isTextElement(element)) {
        didUpdate = true;
        ShapeCache.delete(element);
        return newElementWith(element, {}, true);
      }
      return element;
    });

    if (didUpdate) {
      this.scene.triggerUpdate();
    }
  };

  public load = async () => {
    // Add all registered font faces into the `document.fonts` (if not added already)
    for (const { fontFaces } of Fonts.registered.values()) {
      for (const { fontFace } of fontFaces) {
        if (!window.document.fonts.has(fontFace)) {
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
   * Register a new font.
   *
   * @param family font family
   * @param metrics font metrics
   * @param params array of the rest of the FontFace parameters [uri: string, descriptors: FontFaceDescriptors?] ,
   */
  public static register(
    family: string,
    metrics: FontMetrics,
    ...params: Array<{ uri: string; descriptors?: FontFaceDescriptors }>
  ) {
    // TODO: likely we will need to abandon number "id" in order to support custom fonts
    const familyId = FONT_FAMILY[family as keyof typeof FONT_FAMILY];
    const registeredFamily = this.registered.get(familyId);

    if (!registeredFamily) {
      this.registered.set(familyId, {
        metrics,
        fontFaces: params.map(
          ({ uri, descriptors }) =>
            new ExcalidrawFont(family, uri, descriptors),
        ),
      });
    }

    return this.registered;
  }

  /**
   * WARN: should be called just once on init, even across multiple instances.
   */
  private static init() {
    const fonts = {
      registered: new Map<
        ValueOf<typeof FONT_FAMILY>,
        { metrics: FontMetrics; fontFaces: Font[] }
      >(),
    };

    const register = Fonts.register.bind(fonts);

    register("Virgil", DEFAULT_FONT_METRICS[FONT_FAMILY.Virgil], {
      uri: Virgil,
    });
    register("Excalifont", DEFAULT_FONT_METRICS[FONT_FAMILY.Excalifont], {
      uri: Excalifont,
    });

    // keeping for backwards compatibility reasons, uses system font (Helvetica on MacOS, Arial on Win)
    register("Helvetica", DEFAULT_FONT_METRICS[FONT_FAMILY.Helvetica], {
      uri: "",
    });
    register(
      "Liberation Sans",
      DEFAULT_FONT_METRICS[FONT_FAMILY["Liberation Sans"]],
      { uri: LiberationSans },
    );

    register("Cascadia", DEFAULT_FONT_METRICS[FONT_FAMILY.Cascadia], {
      uri: Cascadia,
    });

    register(
      "Comic Shanns",
      DEFAULT_FONT_METRICS[FONT_FAMILY["Comic Shanns"]],
      { uri: ComicShanns },
    );

    /** Assistant */
    register(
      "Assistant",
      DEFAULT_FONT_METRICS[FONT_FAMILY.Assistant],
      { uri: AssistantRegular },
      { uri: AssistantMedium, descriptors: { weight: "500" } },
      { uri: AssistantSemiBold, descriptors: { weight: "600" } },
      { uri: AssistantBold, descriptors: { weight: "700" } },
    );

    /** Bangers */
    register(
      "Bangers",
      DEFAULT_FONT_METRICS[FONT_FAMILY.Bangers],
      {
        uri: BangersVietnamese,
        descriptors: { unicodeRange: RANGES.VIETNAMESE },
      },
      { uri: BangersLatinExt, descriptors: { unicodeRange: RANGES.LATIN_EXT } },
      { uri: BangersLatin, descriptors: { unicodeRange: RANGES.LATIN } },
    );

    /** Nunito */
    register(
      "Nunito",
      DEFAULT_FONT_METRICS[FONT_FAMILY.Nunito],
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

    /** Pacifico */
    register(
      "Pacifico",
      DEFAULT_FONT_METRICS[FONT_FAMILY.Pacifico],
      {
        uri: PacificoCyrlicExt,
        descriptors: { unicodeRange: RANGES.CYRILIC_EXT },
      },
      {
        uri: PacificoVietnamese,
        descriptors: { unicodeRange: RANGES.VIETNAMESE },
      },
      {
        uri: PacificoLatinExt,
        descriptors: { unicodeRange: RANGES.LATIN_EXT },
      },
      { uri: PacificoLatin, descriptors: { unicodeRange: RANGES.LATIN } },
    );

    /** Permanent marker */
    register(
      "Permanent Marker",
      DEFAULT_FONT_METRICS[FONT_FAMILY["Permanent Marker"]],
      { uri: PermanentMarker, descriptors: { unicodeRange: RANGES.LATIN } },
    );

    return fonts.registered;
  }
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
    Fonts.registered.get(fontFamily)?.metrics ||
    DEFAULT_FONT_METRICS[FONT_FAMILY.Virgil];

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
    Fonts.registered.get(fontFamily)?.metrics ||
    DEFAULT_FONT_METRICS[FONT_FAMILY.Excalifont];

  return lineHeight as ExcalidrawTextElement["lineHeight"];
};
