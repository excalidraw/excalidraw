import {
  FONT_FAMILY,
  FONT_FAMILY_FALLBACKS,
  CJK_HAND_DRAWN_FALLBACK_FONT,
  WINDOWS_EMOJI_FALLBACK_FONT,
  isSafari,
} from "../constants";
import { isTextElement } from "../element";
import { charWidth, getContainerElement } from "../element/textElement";
import { ShapeCache } from "../scene/ShapeCache";
import { getFontString, PromisePool, promiseTry } from "../utils";
import { ExcalidrawFontFace } from "./ExcalidrawFontFace";

import { CascadiaFontFaces } from "./Cascadia";
import { ComicShannsFontFaces } from "./ComicShanns";
import { EmojiFontFaces } from "./Emoji";
import { ExcalifontFontFaces } from "./Excalifont";
import { HelveticaFontFaces } from "./Helvetica";
import { LiberationFontFaces } from "./Liberation";
import { LilitaFontFaces } from "./Lilita";
import { NunitoFontFaces } from "./Nunito";
import { VirgilFontFaces } from "./Virgil";
import { XiaolaiFontFaces } from "./Xiaolai";

import { FONT_METADATA, type FontMetadata } from "./FontMetadata";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  FontFamilyValues,
} from "../element/types";
import type Scene from "../scene/Scene";
import type { ValueOf } from "../utility-types";

export class Fonts {
  // it's ok to track fonts across multiple instances only once, so let's use
  // a static member to reduce memory footprint
  public static readonly loadedFontsCache = new Set<string>();

  private static _registered:
    | Map<
        number,
        {
          metadata: FontMetadata;
          fontFaces: ExcalidrawFontFace[];
        }
      >
    | undefined;

  private static _initialized: boolean = false;

  public static get registered() {
    // lazy load the font registration
    if (!Fonts._registered) {
      Fonts._registered = Fonts.init();
    } else if (!Fonts._initialized) {
      // case when host app register fonts before they are lazy loaded
      // don't override whatever has been previously registered
      Fonts._registered = new Map([
        ...Fonts.init().entries(),
        ...Fonts._registered.entries(),
      ]);
    }

    return Fonts._registered;
  }

  public get registered() {
    return Fonts.registered;
  }

  private readonly scene: Scene;

  constructor(scene: Scene) {
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
    // bail if all fonts with have been processed. We're checking just a
    // subset of the font properties (though it should be enough), so it
    // can technically bail on a false positive.
    let shouldBail = true;

    for (const fontFace of fontFaces) {
      const sig = `${fontFace.family}-${fontFace.style}-${fontFace.weight}-${fontFace.unicodeRange}`;

      // make sure to update our cache with all the loaded font faces
      if (!Fonts.loadedFontsCache.has(sig)) {
        Fonts.loadedFontsCache.add(sig);
        shouldBail = false;
      }
    }

    if (shouldBail) {
      return;
    }

    let didUpdate = false;

    const elementsMap = this.scene.getNonDeletedElementsMap();

    for (const element of this.scene.getNonDeletedElements()) {
      if (isTextElement(element)) {
        didUpdate = true;
        ShapeCache.delete(element);

        // clear the width cache, so that we don't perform subsequent wrapping based on the stale fallback font metrics
        charWidth.clearCache(getFontString(element));

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

  /**
   * Load font faces for a given scene and trigger scene update.
   *
   * FontFaceSet loadingdone event we listen on may not always
   * fire (looking at you Safari), so on init we manually load all
   * fonts and rerender scene text elements once done.
   *
   * For Safari we we make sure to check against each loaded font face,
   * with the actual elements, otherwise fonts might remain unloaded.
   */
  public loadSceneFonts = async (): Promise<FontFace[]> => {
    const sceneFamilies = this.getSceneFamilies();
    const charsPerFamily = isSafari
      ? Fonts.getCharsPerFamily(this.scene.getNonDeletedElements())
      : undefined;

    const loaded = await Fonts.loadFontFaces(sceneFamilies, charsPerFamily);
    this.onLoaded(loaded);
    return loaded;
  };

  /**
   * Load all registered font faces.
   */
  public static loadAllFonts = async (): Promise<FontFace[]> => {
    const allFamilies = Fonts.getAllFamilies();
    return Fonts.loadFontFaces(allFamilies);
  };

  /**
   * Load font faces for passed elements - use when the scene is unavailable (i.e. export).
   */
  public static loadElementsFonts = async (
    elements: readonly ExcalidrawElement[],
  ): Promise<FontFace[]> => {
    const fontFamilies = Fonts.getUniqueFamilies(elements);
    return await Fonts.loadFontFaces(fontFamilies);
  };

  private static async loadFontFaces(
    fontFamilies: Array<ExcalidrawTextElement["fontFamily"]>,
    charsPerFamily?: Record<number, Set<string>>,
  ) {
    // add all registered font faces into the `document.fonts` (if not added already)
    for (const { fontFaces, metadata } of Fonts.registered.values()) {
      // skip registering font faces for local fonts (i.e. Helvetica)
      if (metadata.local) {
        continue;
      }

      for (const { fontFace } of fontFaces) {
        if (!window.document.fonts.has(fontFace)) {
          window.document.fonts.add(fontFace);
        }
      }
    }

    // loading 10 font faces at a time, in a controlled manner
    const iterator = Fonts.fontFacesLoader(fontFamilies, charsPerFamily);
    const concurrency = 10;
    const fontFaces = await new PromisePool(iterator, concurrency).all();
    return fontFaces.flat().filter(Boolean);
  }

  private static *fontFacesLoader(
    fontFamilies: Array<ExcalidrawTextElement["fontFamily"]>,
    charsPerFamily?: Record<number, Set<string>>,
  ): Generator<Promise<void | readonly [number, FontFace[]]>> {
    for (const [index, fontFamily] of fontFamilies.entries()) {
      const fontString = getFontString({
        fontFamily,
        fontSize: 16,
      });

      // WARN: without "text" param it does not have to mean that all font faces are loaded, instead it could be just one!
      // for Safari on init, we rather check with the actual "text" param, even though it's longer, as otherwise fonts might remain unloaded
      const text =
        isSafari && charsPerFamily
          ? Fonts.getCharacters(charsPerFamily, fontFamily)
          : "";

      if (!window.document.fonts.check(fontString, text)) {
        yield promiseTry(async () => {
          try {
            // WARN: browser prioritizes loading only font faces with unicode ranges for characters which are present in the document (html & canvas), other font faces could stay unloaded
            // we might want to retry here, i.e.  in case CDN is down, but so far I didn't experience any issues - maybe it handles retry-like logic under the hood
            const fontFaces = await window.document.fonts.load(
              fontString,
              text,
            );

            return [index, fontFaces];
          } catch (e) {
            // don't let it all fail if just one font fails to load
            console.error(
              `Failed to load font "${fontString}" from urls "${Fonts.registered
                .get(fontFamily)
                ?.fontFaces.map((x) => x.urls)}"`,
              e,
            );
          }
        });
      }
    }
  }

  /**
   * WARN: should be called just once on init, even across multiple instances.
   */
  private static init() {
    const fonts = {
      registered: new Map<
        ValueOf<typeof FONT_FAMILY | typeof FONT_FAMILY_FALLBACKS>,
        { metadata: FontMetadata; fontFaces: ExcalidrawFontFace[] }
      >(),
    };

    const init = (
      family: keyof typeof FONT_FAMILY | keyof typeof FONT_FAMILY_FALLBACKS,
      ...fontFacesDescriptors: ExcalidrawFontFaceDescriptor[]
    ) => {
      const fontFamily =
        FONT_FAMILY[family as keyof typeof FONT_FAMILY] ??
        FONT_FAMILY_FALLBACKS[family as keyof typeof FONT_FAMILY_FALLBACKS];

      // default to Excalifont metrics
      const metadata =
        FONT_METADATA[fontFamily] ?? FONT_METADATA[FONT_FAMILY.Excalifont];

      Fonts.register.call(fonts, family, metadata, ...fontFacesDescriptors);
    };

    init("Cascadia", ...CascadiaFontFaces);
    init("Comic Shanns", ...ComicShannsFontFaces);
    init("Excalifont", ...ExcalifontFontFaces);
    // keeping for backwards compatibility reasons, uses system font (Helvetica on MacOS, Arial on Win)
    init("Helvetica", ...HelveticaFontFaces);
    // used for server-side pdf & png export instead of helvetica (technically does not need metrics, but kept in for consistency)
    init("Liberation Sans", ...LiberationFontFaces);
    init("Lilita One", ...LilitaFontFaces);
    init("Nunito", ...NunitoFontFaces);
    init("Virgil", ...VirgilFontFaces);

    // fallback font faces
    init(CJK_HAND_DRAWN_FALLBACK_FONT, ...XiaolaiFontFaces);
    init(WINDOWS_EMOJI_FALLBACK_FONT, ...EmojiFontFaces);

    Fonts._initialized = true;

    return fonts.registered;
  }

  /**
   * Register a new font.
   *
   * @param family font family
   * @param metadata font metadata
   * @param fontFacesDecriptors font faces descriptors
   */
  private static register(
    this:
      | Fonts
      | {
          registered: Map<
            number,
            { metadata: FontMetadata; fontFaces: ExcalidrawFontFace[] }
          >;
        },
    family: string,
    metadata: FontMetadata,
    ...fontFacesDecriptors: ExcalidrawFontFaceDescriptor[]
  ) {
    // TODO: likely we will need to abandon number value in order to support custom fonts
    const fontFamily =
      FONT_FAMILY[family as keyof typeof FONT_FAMILY] ??
      FONT_FAMILY_FALLBACKS[family as keyof typeof FONT_FAMILY_FALLBACKS];

    const registeredFamily = this.registered.get(fontFamily);

    if (!registeredFamily) {
      this.registered.set(fontFamily, {
        metadata,
        fontFaces: fontFacesDecriptors.map(
          ({ uri, descriptors }) =>
            new ExcalidrawFontFace(family, uri, descriptors),
        ),
      });
    }

    return this.registered;
  }

  /**
   * Gets all the font families for the given scene.
   */
  public getSceneFamilies = () => {
    return Fonts.getUniqueFamilies(this.scene.getNonDeletedElements());
  };

  /**
   * Gets all the unique font families for the given elements.
   */
  public static getUniqueFamilies(
    elements: ReadonlyArray<ExcalidrawElement>,
  ): Array<ExcalidrawTextElement["fontFamily"]> {
    return Array.from(
      elements.reduce((families, element) => {
        if (isTextElement(element)) {
          families.add(element.fontFamily);
        }
        return families;
      }, new Set<number>()),
    );
  }

  /**
   * Gets all the unique characters per font family for the given scene.
   */
  public static getCharsPerFamily(
    elements: ReadonlyArray<ExcalidrawElement>,
  ): Record<number, Set<string>> {
    const charsPerFamily: Record<number, Set<string>> = {};

    for (const element of elements) {
      if (!isTextElement(element)) {
        continue;
      }

      // gather unique codepoints only when inlining fonts
      for (const char of element.originalText) {
        if (!charsPerFamily[element.fontFamily]) {
          charsPerFamily[element.fontFamily] = new Set();
        }

        charsPerFamily[element.fontFamily].add(char);
      }
    }

    return charsPerFamily;
  }

  public static getCharacters(
    charsPerFamily: Record<number, Set<string>>,
    family: number,
  ) {
    return charsPerFamily[family]
      ? Array.from(charsPerFamily[family]).join("")
      : "";
  }

  private static getAllFamilies() {
    return Array.from(Fonts.registered.keys());
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

export interface ExcalidrawFontFaceDescriptor {
  uri: string;
  descriptors?: FontFaceDescriptors;
}
