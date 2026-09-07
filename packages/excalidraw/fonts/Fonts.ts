import {
  FONT_FAMILY_FALLBACKS,
  CJK_HAND_DRAWN_FALLBACK_FONT,
  getFontFamilyFallbacks,
  FONT_SIZES,
  FONT_PROVIDER_SEPARATOR,
  parseProviderFontFamily,
  createProviderFontFamily,
  isCustomFontFamily,
  LOCAL_FONT_PROTOCOL,
} from "@excalidraw/common";

import { getContainerElement } from "@excalidraw/element";
import { charWidth } from "@excalidraw/element";
import { containsCJK } from "@excalidraw/element";

import {
  type FontMetadata,
  getFontString,
  reconcileLineHeight,
  setCustomFontMetadata,
  PromisePool,
  promiseTry,
} from "@excalidraw/common";

import { redrawTextBoundingBox } from "@excalidraw/element";

import { ShapeCache } from "@excalidraw/element";

import { isTextElement } from "@excalidraw/element";

import { Scene } from "@excalidraw/element";

import type { CustomFontFamily, FontFamily } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { ExcalidrawFontFace } from "./ExcalidrawFontFace";
import { defaultFontRegistry } from "./FontRegistry";

import type { FontRegistry, RegisteredFont } from "./FontRegistry";

/** definition of a custom font, returned by a font resolver */
export interface FontDefinition {
  fontFaces: readonly [
    ExcalidrawFontFaceDescriptor,
    ...ExcalidrawFontFaceDescriptor[],
  ];
  metadata: FontMetadata;
}

/**
 * Resolve a bare font family name (i.e. "Roboto") into a loadable definition.
 * A plain function type, free of UI concerns, so that headless callers can
 * supply one without constructing a full {@link FontProvider}.
 */
export type FontResolver = (familyName: string) => Promise<FontDefinition>;

/**
 * Font resolvers, keyed by provider id.
 *
 * WARN: ids are a global namespace - they get persisted into `fontFamily`
 * (i.e. "google:Roboto") and travel with the document, so the same id has to
 * denote the same font source everywhere.
 */
export type FontResolvers = Record<string, FontResolver>;

/**
 * Outcome of a custom family registration, `family` echoing the requested one:
 *
 * - `success` - registered (now, or already before)
 * - `failed` - the resolver rejected
 * - `unsupported` - not provider-qualified, or no resolver for its provider
 */
export type FontRegistrationResult<T extends string = string> = {
  family: T;
  status: "success" | "failed" | "unsupported";
};

type RegistrationOptions = {
  /**
   * mark the family as failed when its resolver rejects. The failure set is
   * registry-wide, so this is off wherever a rejection isn't an answer about
   * the family the user is looking at: search probes and headless exports.
   * Symmetrically, such an attempt doesn't consult past failures either (see
   * {@link Fonts.loadElementsFonts}).
   */
  recordFailure?: boolean;
};

type ResolvabilityOptions = {
  /** for attempts which don't record failures either - see `recordFailure` */
  ignoreFailures?: boolean;
};

export class Fonts {
  public static readonly FONT_PROVIDER_SEPARATOR = FONT_PROVIDER_SEPARATOR;

  /** the default registry's registered fonts - see {@link FontRegistry} */
  public static get registered() {
    return defaultFontRegistry.registered;
  }

  public static isFamilyLoaded = (family: FontFamily): boolean =>
    defaultFontRegistry.isFamilyLoaded(family);

  private static validateProviderKey = (provider: string) => {
    if (!provider || provider.includes(FONT_PROVIDER_SEPARATOR)) {
      throw new Error(
        `Font provider key must be non-empty and must not contain "${FONT_PROVIDER_SEPARATOR}": "${provider}"`,
      );
    }

    // CSS font-family matching is ASCII case-insensitive, so "google:Roboto"
    // and "Google:Roboto" would be distinct registry keys landing in the same
    // browser family bucket - canonical lowercase keys rule that out
    if (provider !== provider.toLowerCase()) {
      throw new Error(
        `Font provider key must be lowercase (CSS font-family matching is case-insensitive): "${provider}"`,
      );
    }
  };

  private static validateFontMetadata = (metadata: FontMetadata) => {
    const metrics = metadata?.metrics;
    if (
      !metrics ||
      !Number.isFinite(metrics.unitsPerEm) ||
      !Number.isFinite(metrics.ascender) ||
      !Number.isFinite(metrics.descender) ||
      !Number.isFinite(metrics.lineHeight) ||
      metrics.unitsPerEm <= 0 ||
      metrics.lineHeight <= 0
    ) {
      throw new Error(
        `Invalid font metadata: "metrics" must be finite numbers with positive "unitsPerEm" and "lineHeight"`,
      );
    }
    if (metadata.local) {
      throw new Error(`Invalid custom font metadata: "local" is not supported`);
    }
  };

  private static validateFontFaceDescriptors = (
    fontFaces: readonly ExcalidrawFontFaceDescriptor[],
  ) => {
    if (
      !Array.isArray(fontFaces) ||
      !fontFaces.length ||
      fontFaces.some(
        (face) =>
          typeof face?.uri !== "string" ||
          !face.uri ||
          face.uri.startsWith(LOCAL_FONT_PROTOCOL),
      )
    ) {
      throw new Error(
        `Invalid font faces: expected at least one descriptor with a non-local, non-empty string "uri"`,
      );
    }
  };

  public get onRegisteredFontsChangeEmitter() {
    return this.registry.onChangeEmitter;
  }

  public get onFailedResolutionsChangeEmitter() {
    return this.registry.cache.onFailuresChangeEmitter;
  }

  public get registered(): ReadonlyMap<FontFamily, RegisteredFont> {
    return this.registry.registered;
  }

  public get failedResolutions() {
    return this.registry.cache.failedResolutions;
  }

  /**
   * Resolution status of a custom family - see {@link FontsCache.getStatus}.
   */
  public getResolutionStatus = (family: CustomFontFamily) =>
    this.registry.cache.getStatus(family);

  /** instance-flavored {@link FontRegistry.isFamilyLoaded} */
  public isFamilyLoaded = (family: FontFamily): boolean =>
    this.registry.isFamilyLoaded(family);

  private readonly scene: Scene;

  /** the document whose `fonts` set this editor installs & loads faces into */
  private readonly ownerDocument: Document;

  /**
   * The page-global font state this editor reads & writes - the shared
   * {@link defaultFontRegistry} unless the caller opts into isolation.
   */
  public readonly registry: FontRegistry;

  /**
   * Font resolvers this editor is configured with, keyed by provider id.
   *
   * Instance-scoped, so that two editors on one page may be configured with
   * different providers. The registry they populate ({@link registered}) stays
   * global on purpose - a resolved font face is a document-level browser
   * resource, and provider ids mean the same thing everywhere, so resolving
   * once per page is a feature.
   */
  public readonly fontResolvers: FontResolvers;

  /**
   * Font faces this instance's scene has converged for (see `onLoaded`) - per
   * instance, as every editor gets the same page-global "loadingdone" event.
   */
  private readonly processedFaces = new WeakSet<FontFace>();

  /**
   * Called right before a scene mutation outside of an action. The App injects
   * `store.scheduleAction(CaptureUpdateAction.NEVER)`, keeping the repair out
   * of the next user action's undo delta - so only call it when a mutation
   * actually follows.
   */
  public readonly onBeforeSceneMutation: () => void;

  /** the App injects "a gesture is in flight" - see `runSceneRepair` */
  private readonly shouldDeferSceneMutation: () => boolean;
  private pendingSceneRepairs: Array<() => void> = [];

  constructor(
    scene: Scene,
    fontResolvers: FontResolvers = {},
    registry: FontRegistry = defaultFontRegistry,
    options?: {
      onBeforeSceneMutation?: () => void;
      shouldDeferSceneMutation?: () => boolean;
      /** defaults to the global `document` - see `ExcalidrawProps.ownerDocument` */
      ownerDocument?: Document;
    },
  ) {
    for (const provider of Object.keys(fontResolvers)) {
      Fonts.validateProviderKey(provider);
    }
    this.scene = scene;
    this.fontResolvers = fontResolvers;
    this.registry = registry;
    this.ownerDocument = options?.ownerDocument ?? document;
    this.hasResolvers = Object.keys(fontResolvers).length > 0;
    this.onBeforeSceneMutation = options?.onBeforeSceneMutation ?? (() => {});
    this.shouldDeferSceneMutation =
      options?.shouldDeferSceneMutation ?? (() => false);
  }

  private readonly hasResolvers: boolean;

  /**
   * The wholesale gate keeping custom-font work zero-cost for no-provider
   * hosts. Conservative: one registered custom family keeps every gate open.
   */
  public mayHaveCustomFonts = (): boolean =>
    this.hasResolvers || this.registry.hasCustomFamilies;

  public hasPendingSceneRepairs = (): boolean =>
    this.pendingSceneRepairs.length > 0;

  /**
   * Run a scene repair (i.e. a font reflow) outside of any action, or queue it
   * for `flushDeferredSceneRepairs` while a gesture is in flight: mutating
   * mid-drag makes the element jump under the cursor, and a `NEVER` commit
   * wins over the gesture's `EVENTUALLY`, corrupting its undo entry.
   *
   * Queued closures run late - re-fetch elements by id.
   */
  public runSceneRepair = (repair: () => void): void => {
    if (this.shouldDeferSceneMutation()) {
      this.pendingSceneRepairs.push(repair);
      return;
    }

    this.onBeforeSceneMutation();
    repair();
  };

  /** run repairs queued while a gesture was in flight - see `runSceneRepair` */
  public flushDeferredSceneRepairs = (): void => {
    // another gesture is in flight - its end reschedules the flush
    if (!this.pendingSceneRepairs.length || this.shouldDeferSceneMutation()) {
      return;
    }

    const repairs = this.pendingSceneRepairs;
    this.pendingSceneRepairs = [];

    this.onBeforeSceneMutation();
    for (const repair of repairs) {
      repair();
    }
    this.scene.triggerUpdate();
  };

  /**
   * Get all the font families for the given scene.
   */
  public getSceneFamilies = () => {
    return Fonts.getUniqueFamilies(this.scene.getNonDeletedElements());
  };

  /**
   * Whether the custom family could still need its faces loaded - not
   * registered yet (but resolvable), or registered while its faces may still
   * be unloaded: registering only installs them, leaving the fetch to whatever
   * renders them (which may never happen, or cover only some glyphs).
   */
  public shouldLoadCustomFamily = (
    family: FontFamily,
    options?: ResolvabilityOptions,
  ): family is CustomFontFamily => {
    if (!isCustomFontFamily(family)) {
      return false;
    }

    return (
      this.registry.registered.has(family) ||
      this.isResolvableFamily(family, options)
    );
  };

  private isResolvableFamily = (
    family: FontFamily,
    { ignoreFailures = false }: ResolvabilityOptions = {},
  ): family is CustomFontFamily => {
    if (!isCustomFontFamily(family)) {
      return false;
    }

    if (!ignoreFailures && this.registry.cache.failedResolutions.has(family)) {
      return false;
    }

    const parsed = parseProviderFontFamily(family);
    return !!parsed && !!this.getResolver(parsed.providerId);
  };

  /** own-property lookup, so "toString:Foo" can't resolve `Object.prototype` */
  private getResolver = (providerId: string): FontResolver | undefined =>
    Object.hasOwn(this.fontResolvers, providerId)
      ? this.fontResolvers[providerId]
      : undefined;

  /**
   * if we load a (new) font, it's likely that text elements using it have
   * already been rendered using a fallback font. Thus, we want invalidate
   * their shapes and rerender. See #637.
   *
   * Invalidates text elements and rerenders scene, provided that at least one
   * of the supplied fontFaces has not already been processed.
   */
  public onLoaded = (fontFaces: readonly FontFace[]): void => {
    const newFaces = new Set<FontFace>();
    for (const fontFace of fontFaces) {
      // "loaded" is page-global, "processed" is per instance
      this.registry.loadedFaces.add(fontFace);

      if (!this.processedFaces.has(fontFace)) {
        this.processedFaces.add(fontFace);
        newFaces.add(fontFace);
      }
    }

    // TRADE-OFF: convergence happens once per family per instance, at load
    // time - elements arriving after their family's load event (paste,
    // `updateScene`, host-swapped duplicates) keep their persisted geometry.
    // See `reconcileLineHeight`'s contract and the `onDuplicate` JSDoc
    if (!newFaces.size) {
      return;
    }

    // the *custom* families the newly loaded faces belong to - the only ones
    // whose elements may reflow below. Scoped per loaded family, or an
    // unscoped sweep would clobber divergent (i.e. host-set) line heights at
    // every unrelated load event; custom-only, as built-in text is never
    // re-measured on load (master behavior), which also keeps no-provider
    // editors out of the face walk (Xiaolai alone carries ~200 faces)
    const loadedFamilies = new Set<FontFamily>();
    for (const [family, registeredFont] of this.registry.registered) {
      if (!isCustomFontFamily(family)) {
        continue;
      }
      if (
        registeredFont.fontFaces.some(({ fontFace }) => newFaces.has(fontFace))
      ) {
        loadedFamilies.add(family);
      }
    }

    let didUpdate = false;

    const elementsMap = this.scene.getNonDeletedElementsMap();
    const elementsToReflow: ExcalidrawTextElement[] = [];

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

        // measured with the fallback font while the faces were pending -
        // reflow it now, converging the line height first when the stored
        // value is still the baked-in fallback metric (`reconcileLineHeight`).
        // Not conditional on that: a family can share the fallback's
        // line-height ratio while having different glyph widths
        if (loadedFamilies.has(element.fontFamily)) {
          elementsToReflow.push(element);
        }
      }
    }

    if (elementsToReflow.length) {
      this.runSceneRepair(() => {
        const latestElementsMap = this.scene.getNonDeletedElementsMap();
        for (const element of elementsToReflow) {
          // re-fetch - a deferred repair runs after further edits
          const latest = this.scene.getElement(element.id);
          if (!latest || !isTextElement(latest)) {
            continue;
          }

          const lineHeight = reconcileLineHeight(latest);
          if (lineHeight !== null) {
            this.scene.mutateElement(latest, { lineHeight });
          }
          redrawTextBoundingBox(
            latest,
            getContainerElement(latest, latestElementsMap),
            this.scene,
          );
        }
      });
    }

    if (didUpdate) {
      this.scene.triggerUpdate();
    }
  };

  private resolveAndRegisterCustomFamily = async (
    family: CustomFontFamily,
    { recordFailure = true }: RegistrationOptions = {},
  ): Promise<FontRegistrationResult<CustomFontFamily>> => {
    // WARN: a past failure clears on *success only* - clearing it any earlier
    // (or on `unsupported`) would let a speculative attempt which doesn't
    // record failures wipe a verdict without re-recording it, silently
    // re-enabling automatic retries

    const registeredFont = this.registry.registered.get(family);
    if (registeredFont) {
      this.registry.installFontFaces(
        registeredFont.fontFaces,
        this.ownerDocument,
      );
      this.registry.cache.clearFailed(family);
      return { family, status: "success" };
    }

    const parsed = parseProviderFontFamily(family);
    if (!parsed) {
      return { family, status: "unsupported" };
    }

    const resolve = this.getResolver(parsed.providerId);
    if (!resolve) {
      return { family, status: "unsupported" };
    }

    try {
      const definition = await this.registry.cache.resolve(
        family,
        parsed.familyName,
        resolve,
      );

      // garbage is as much a failure as a rejection - validating inside the
      // try keeps it from being reported as a success (a nullish definition
      // throws into the same catch)
      Fonts.validateFontMetadata(definition.metadata);
      Fonts.validateFontFaceDescriptors(definition.fontFaces);

      // a concurrent resolution may have won the race while we awaited
      const registeredFont = this.registry.registered.get(family);
      if (registeredFont) {
        this.registry.installFontFaces(
          registeredFont.fontFaces,
          this.ownerDocument,
        );
        this.registry.cache.clearFailed(family);
        return { family, status: "success" };
      }

      const nextRegisteredFont: RegisteredFont = {
        metadata: definition.metadata,
        fontFaces: definition.fontFaces.map(
          ({ uri, descriptors }) =>
            new ExcalidrawFontFace(family, uri, descriptors),
        ),
      };
      this.registry.installFontFaces(
        nextRegisteredFont.fontFaces,
        this.ownerDocument,
      );
      // also publish the metrics so getLineHeight / getVerticalOffset work
      setCustomFontMetadata(family, definition.metadata);
      this.registry.registered.set(family, nextRegisteredFont);
      this.registry.scheduleEmit();
      this.registry.cache.clearFailed(family);
      return { family, status: "success" };
    } catch (error) {
      if (recordFailure) {
        // probes & exports opt out, so this logs once per user-visible failure
        console.error(
          `Failed to resolve custom font "${family}" via font provider`,
          error,
        );
        this.registry.cache.setFailed(family, error);
      }
      return { family, status: "failed" };
    }
  };

  /**
   * Resolve a provider-qualified custom family (i.e. "google:Roboto") via this
   * editor's resolvers and register it, so that it can be loaded and rendered.
   *
   * Never rejects - the outcome is in the result's `status`.
   */
  public registerCustomFamily = (
    family: CustomFontFamily,
    options?: Pick<RegistrationOptions, "recordFailure">,
  ): Promise<FontRegistrationResult<CustomFontFamily>> =>
    this.resolveAndRegisterCustomFamily(family, options);

  /**
   * Resolve & register the custom families among the given ones. Registry
   * announcements coalesce per microtask (`FontRegistry.scheduleEmit`), so a
   * burst produces a single change event without any family waiting on its
   * batch-mates.
   */
  public registerCustomFamilies = (
    families: FontFamily[],
    options?: Pick<RegistrationOptions, "recordFailure">,
  ): Promise<FontRegistrationResult<CustomFontFamily>[]> =>
    Promise.all(
      families
        .filter(isCustomFontFamily)
        .map((family) => this.resolveAndRegisterCustomFamily(family, options)),
    );

  private getLoadableFamilies = (
    families: FontFamily[],
    options?: ResolvabilityOptions,
  ) =>
    families.filter(
      // built-ins are always loadable; a registered custom family wins over a
      // past failure, as its definition is already there
      (family) =>
        !isCustomFontFamily(family) ||
        this.shouldLoadCustomFamily(family, options),
    );

  /**
   * Resolve & load the given families, without letting the resolvers hold back
   * what is loadable right away - they are arbitrary (network) code, and a
   * slow one would otherwise leave everything in the fallback font. The
   * already-loadable batch also announces itself early via `onLoaded`, so a
   * live scene rerenders without waiting for them.
   */
  private splitLoadFontFaces = async (
    families: FontFamily[],
    charsPerFamily: Record<FontFamily, Set<string>>,
    options?: Pick<RegistrationOptions, "recordFailure">,
  ): Promise<FontFace[]> => {
    const unresolvedFamilies: FontFamily[] = [];
    const resolvedFamilies: FontFamily[] = [];

    for (const family of families) {
      if (isCustomFontFamily(family) && !this.registry.registered.has(family)) {
        unresolvedFamilies.push(family);
      } else {
        resolvedFamilies.push(family);
      }
    }

    if (!unresolvedFamilies.length) {
      return this.loadFontFaces(resolvedFamilies, charsPerFamily);
    }

    const resolvedFontFaces = this.loadFontFaces(
      resolvedFamilies,
      charsPerFamily,
    ).then((fontFaces) => {
      // render what's already available instead of waiting for the resolvers
      this.onLoaded(fontFaces);
      return fontFaces;
    });

    const unresolvedFontFaces = this.registerCustomFamilies(
      unresolvedFamilies,
      options,
    ).then(() =>
      this.loadFontFaces(
        // a family which (still) failed to register has no font faces -
        // don't hand it to `document.fonts` just to fail there again
        unresolvedFamilies.filter((family) =>
          this.registry.registered.has(family),
        ),
        charsPerFamily,
      ),
    );

    return (await Promise.all([resolvedFontFaces, unresolvedFontFaces])).flat();
  };

  /**
   * Load font faces for a given scene and trigger scene update.
   */
  public loadSceneFonts = async (
    additionalFamilies: FontFamily[] = [],
  ): Promise<FontFace[]> => {
    const sceneFamilies = this.getLoadableFamilies(
      Array.from(new Set([...this.getSceneFamilies(), ...additionalFamilies])),
    );
    const charsPerFamily = Fonts.getCharsPerFamily(
      this.scene.getNonDeletedElements(),
    );

    return this.splitLoadFontFaces(sceneFamilies, charsPerFamily);
  };

  /**
   * Load font faces for passed elements - use when the scene is unavailable (i.e. export).
   */
  public static loadElementsFonts = async (
    elements: readonly ExcalidrawElement[],
    fonts: Fonts = new Fonts(new Scene()),
    options?: Pick<RegistrationOptions, "recordFailure">,
  ): Promise<FontFace[]> => {
    // an attempt which doesn't record failures doesn't consult them either -
    // an export retries a page-failed family, in-editor callers don't
    const ignoreFailures = options?.recordFailure === false;
    const families = fonts.getLoadableFamilies(
      Fonts.getUniqueFamilies(elements),
      { ignoreFailures },
    );
    const charsPerFamily = Fonts.getCharsPerFamily(elements);

    return fonts.splitLoadFontFaces(families, charsPerFamily, options);
  };

  /**
   * Resolve & register the custom families used by the given elements.
   */
  public static registerElementsFonts = (
    elements: readonly ExcalidrawElement[],
    fonts: Fonts,
    options?: Pick<RegistrationOptions, "recordFailure">,
  ) => fonts.registerCustomFamilies(Fonts.getUniqueFamilies(elements), options);

  /**
   * Generate CSS @font-face declarations for the given elements.
   *
   * Pass a `Fonts` instance constructed with resolvers to be able to resolve
   * custom families headlessly, without a mounted editor; already registered
   * families get inlined regardless.
   */
  public static async generateFontFaceDeclarations(
    elements: readonly ExcalidrawElement[],
    fonts: Fonts = new Fonts(new Scene()),
    options?: Pick<RegistrationOptions, "recordFailure">,
  ) {
    // resolve first - already registered families return from the registry
    await Fonts.registerElementsFonts(elements, fonts, options);

    const families = Fonts.getUniqueFamilies(elements);
    const charsPerFamily = Fonts.getCharsPerFamily(elements);

    // for simplicity, assuming we have just one family with the CJK handdrawn fallback
    const familyWithCJK = families.find((x) =>
      getFontFamilyFallbacks(x).includes(CJK_HAND_DRAWN_FALLBACK_FONT),
    );

    if (familyWithCJK) {
      const characters = Fonts.getCharacters(charsPerFamily, familyWithCJK);

      if (containsCJK(characters)) {
        const family = FONT_FAMILY_FALLBACKS[CJK_HAND_DRAWN_FALLBACK_FONT];

        // adding the same characters to the CJK handrawn family
        charsPerFamily[family] = new Set(characters);

        // the order between the families and fallbacks is important, as fallbacks need to be defined first and in the reversed order
        // so that they get overriden with the later defined font faces, i.e. in case they share some codepoints
        families.unshift(FONT_FAMILY_FALLBACKS[CJK_HAND_DRAWN_FALLBACK_FONT]);
      }
    }

    // don't trigger hundreds of concurrent requests (each performing fetch, creating a worker, etc.),
    // instead go three requests at a time, in a controlled manner, without completely blocking the main thread
    // and avoiding potential issues such as rate limits
    const iterator = fonts.fontFacesStylesGenerator(families, charsPerFamily);
    const concurrency = 3;
    const fontFaces = await new PromisePool(iterator, concurrency).all();

    // dedup just in case (i.e. could be the same font faces with 0 glyphs)
    return Array.from(new Set(fontFaces));
  }

  private async loadFontFaces(
    fontFamilies: FontFamily[],
    charsPerFamily: Record<FontFamily, Set<string>>,
  ) {
    // add the registered font faces into `document.fonts` (if not added
    // already) - built-ins wholesale, custom families only when asked for,
    // so that loading a scene doesn't install every custom font on the page
    for (const [family, { fontFaces, metadata }] of this.registry.registered) {
      if (isCustomFontFamily(family) && !fontFamilies.includes(family)) {
        continue;
      }
      // skip registering font faces for local fonts (i.e. Helvetica)
      if (metadata.local) {
        continue;
      }

      this.registry.installFontFaces(fontFaces, this.ownerDocument);
    }

    // loading 10 font faces at a time, in a controlled manner
    const iterator = this.fontFacesLoader(fontFamilies, charsPerFamily);
    const concurrency = 10;
    const fontFaces = await new PromisePool(iterator, concurrency).all();

    // also report custom faces loaded earlier (i.e. by another editor on the
    // page) - an instance mounted after their `loadingdone` still needs its
    // own `onLoaded` pass, or its fallback-measured text would never reflow.
    // Custom-only, as built-in text never reflows (see `onLoaded`)
    const requestedCustomFamilies = fontFamilies.filter(isCustomFontFamily);
    if (!requestedCustomFamilies.length) {
      return fontFaces.flat().filter(Boolean);
    }

    const alreadyLoadedFontFaces = requestedCustomFamilies.flatMap(
      (family) =>
        this.registry.registered
          .get(family)
          ?.fontFaces.map(({ fontFace }) => fontFace)
          .filter((fontFace) => fontFace.status === "loaded") ?? [],
    );

    return Array.from(
      new Set([...fontFaces.flat().filter(Boolean), ...alreadyLoadedFontFaces]),
    );
  }

  private *fontFacesLoader(
    fontFamilies: FontFamily[],
    charsPerFamily: Record<FontFamily, Set<string>>,
  ): Generator<Promise<void | readonly [number, FontFace[]]>> {
    for (const [index, fontFamily] of fontFamilies.entries()) {
      const font = getFontString({
        fontFamily,
        fontSize: FONT_SIZES.sm,
      });

      // WARN: without "text" param it does not have to mean that all font faces are loaded as it could be just one irrelevant font face!
      // instead, we are always checking chars used in the family, so that no required font faces remain unloaded.
      // a family with no scene characters yet still needs a probe glyph - an
      // empty string makes `check` pass vacuously, skipping the load
      const text = Fonts.getCharacters(charsPerFamily, fontFamily) || " ";

      if (!this.ownerDocument.fonts.check(font, text)) {
        yield promiseTry(async () => {
          try {
            // WARN: browser prioritizes loading only font faces with unicode ranges for characters which are present in the document (html & canvas), other font faces could stay unloaded
            // we might want to retry here, i.e.  in case CDN is down, but so far I didn't experience any issues - maybe it handles retry-like logic under the hood
            const fontFaces = await this.ownerDocument.fonts.load(font, text);

            return [index, fontFaces];
          } catch (e) {
            // don't let it all fail if just one font fails to load
            console.error(
              `Failed to load font "${font}" from urls "${this.registry.registered
                .get(fontFamily)
                ?.fontFaces.map((x) => x.urls)}"`,
              e,
            );
          }
        });
      }
    }
  }

  private *fontFacesStylesGenerator(
    families: Array<FontFamily>,
    charsPerFamily: Record<FontFamily, Set<string>>,
  ): Generator<Promise<void | readonly [number, string]>> {
    for (const [familyIndex, family] of families.entries()) {
      const { fontFaces, metadata } =
        this.registry.registered.get(family) ?? {};

      if (!Array.isArray(fontFaces)) {
        console.error(
          `Couldn't find registered fonts for font-family "${family}"`,
          this.registry.registered,
        );
        continue;
      }

      if (metadata?.local) {
        // don't inline local fonts
        continue;
      }

      for (const [fontFaceIndex, fontFace] of fontFaces.entries()) {
        yield promiseTry(async () => {
          try {
            const characters = Fonts.getCharacters(charsPerFamily, family);
            const fontFaceCSS = await fontFace.toCSS(characters);

            if (!fontFaceCSS) {
              return;
            }

            // giving a buffer of 10K font faces per family
            const fontFaceOrder = familyIndex * 10_000 + fontFaceIndex;
            const fontFaceTuple = [fontFaceOrder, fontFaceCSS] as const;

            return fontFaceTuple;
          } catch (error) {
            console.error(
              `Couldn't transform font-face to css for family "${fontFace.family}"`,
              error,
            );
          }
        });
      }
    }
  }

  /**
   * Register a font definition the host already holds, without a resolver -
   * page-globally, as with any resolved family. Installs the font faces and
   * announces the change immediately, so a family registered before mount is
   * ready by the time the editor loads its scene.
   *
   * Throws on a malformed family, provider key, metadata or font faces.
   * Re-registering an existing family is a no-op, the first definition wins.
   */
  public static registerCustomFont(
    family: CustomFontFamily,
    metadata: FontMetadata,
    fontFaceDescriptor: ExcalidrawFontFaceDescriptor,
    ...additionalFontFaceDescriptors: ExcalidrawFontFaceDescriptor[]
  ) {
    const fontFaceDescriptors = [
      fontFaceDescriptor,
      ...additionalFontFaceDescriptors,
    ];
    const parsed = parseProviderFontFamily(family);
    if (!parsed) {
      throw new Error(
        `Failed to register custom font "${family}": the family has to be provider-qualified, i.e. "google:Roboto"`,
      );
    }

    Fonts.validateProviderKey(parsed.providerId);
    Fonts.validateFontMetadata(metadata);
    Fonts.validateFontFaceDescriptors(fontFaceDescriptors);

    if (!defaultFontRegistry.registered.has(family)) {
      defaultFontRegistry.add(family, family, metadata, fontFaceDescriptors);
      setCustomFontMetadata(family, metadata);
      defaultFontRegistry.cache.clearFailed(family);
      defaultFontRegistry.installFontFaces(
        defaultFontRegistry.registered.get(family)!.fontFaces,
      );

      defaultFontRegistry.emitNow();
    }

    return defaultFontRegistry.registered;
  }

  /**
   * Get all the unique font families for the given elements.
   */
  private static getUniqueFamilies(
    elements: ReadonlyArray<ExcalidrawElement>,
  ): Array<ExcalidrawTextElement["fontFamily"]> {
    return Array.from(
      elements.reduce((families, element) => {
        if (isTextElement(element)) {
          families.add(element.fontFamily);
        }
        return families;
      }, new Set<FontFamily>()),
    );
  }

  /**
   * Get all the unique characters per font family for the given scene.
   */
  private static getCharsPerFamily(
    elements: ReadonlyArray<ExcalidrawElement>,
  ): Record<FontFamily, Set<string>> {
    const charsPerFamily: Record<FontFamily, Set<string>> = {};

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

  /**
   * Get characters for a given family.
   */
  private static getCharacters(
    charsPerFamily: Record<FontFamily, Set<string>>,
    family: FontFamily,
  ) {
    return charsPerFamily[family]
      ? Array.from(charsPerFamily[family]).join("")
      : "";
  }

  public static parseProviderFontFamily = parseProviderFontFamily;

  public static createProviderFontFamily = createProviderFontFamily;
}

export interface ExcalidrawFontFaceDescriptor {
  uri: string;
  descriptors?: FontFaceDescriptors;
}
