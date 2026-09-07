import {
  FONT_FAMILY,
  FONT_FAMILY_FALLBACKS,
  CJK_HAND_DRAWN_FALLBACK_FONT,
  WINDOWS_EMOJI_FALLBACK_FONT,
  getFontMetadata,
  Emitter,
} from "@excalidraw/common";

import type { FontFamily, FontMetadata } from "@excalidraw/common";

import { CascadiaFontFaces } from "./Cascadia";
import { ComicShannsFontFaces } from "./ComicShanns";
import { EmojiFontFaces } from "./Emoji";
import { ExcalidrawFontFace } from "./ExcalidrawFontFace";
import { ExcalifontFontFaces } from "./Excalifont";
import { FontsCache } from "./FontsCache";
import { HelveticaFontFaces } from "./Helvetica";
import { LiberationFontFaces } from "./Liberation";
import { LilitaFontFaces } from "./Lilita";
import { NunitoFontFaces } from "./Nunito";
import { VirgilFontFaces } from "./Virgil";
import { XiaolaiFontFaces } from "./Xiaolai";

import type { ExcalidrawFontFaceDescriptor } from "./Fonts";

/** a registered font, as held by {@link Fonts.registered} */
export type RegisteredFont = {
  metadata: FontMetadata;
  fontFaces: ExcalidrawFontFace[];
};

/**
 * Owns the page-global font state: resolved definitions, the resolution cache
 * (in-flight attempts + verdicts), loaded-face tracking and change events.
 *
 * One instance ({@link defaultFontRegistry}) is shared by every editor on the
 * page - a resolved font face is a document-level browser resource, and the
 * `FontProviders` contract makes definitions editor-independent. Constructing
 * `Fonts` with an own registry opts out (i.e. tests); custom font *metrics*
 * stay page-global even then, being contract-stable per family.
 */
export class FontRegistry {
  /** resolution state: in-flight attempts + verdicts - see {@link FontsCache} */
  public readonly cache = new FontsCache(this);

  // tracked by instance rather than by name, as `fontFace.family` is the
  // browser's serialization, quoted or bare per engine. A WeakSet, as
  // `loadingdone` also delivers the host page's own font faces - pinning
  // those would keep them alive past their stylesheet
  public readonly loadedFaces = new WeakSet<FontFace>();

  public readonly onChangeEmitter = new Emitter<
    [ReadonlyMap<FontFamily, RegisteredFont>]
  >();

  private _registered: Map<FontFamily, RegisteredFont> | undefined;
  private initializedBuiltIns = false;

  public get registered() {
    // lazy load the built-in font registration
    if (!this._registered) {
      this._registered = this.initBuiltIns();
    } else if (!this.initializedBuiltIns) {
      // case when a host registered custom fonts before the built-ins were
      // lazily initialized - don't override what has been registered already
      this._registered = new Map([
        ...this.initBuiltIns().entries(),
        ...this._registered.entries(),
      ]);
    }

    return this._registered;
  }

  /**
   * Whether any custom family has ever been registered - the gate letting
   * no-provider editors skip custom-font work wholesale, so it stays cheap:
   * monotonic (never unregistered), so `true` is cached, and `false` scans
   * only the ~10 built-in keys. Reads the backing map directly, to avoid
   * forcing the lazy built-in init.
   */
  private _hasCustomFamilies = false;
  public get hasCustomFamilies(): boolean {
    if (!this._hasCustomFamilies && this._registered) {
      for (const key of this._registered.keys()) {
        if (typeof key === "string") {
          this._hasCustomFamilies = true;
          break;
        }
      }
    }
    return this._hasCustomFamilies;
  }

  /**
   * Announce registry changes at most once per microtask - registrations
   * arrive in bursts, and each emit hands React a fresh map identity.
   *
   * Per registration rather than per batch: gating emits on batch completion
   * would let one slow resolver mute its already-registered batch-mates.
   */
  private emitScheduled = false;
  public scheduleEmit() {
    if (this.emitScheduled) {
      return;
    }
    this.emitScheduled = true;
    queueMicrotask(() => {
      this.emitScheduled = false;
      this._registered = new Map(this.registered);
      this.onChangeEmitter.trigger(this._registered);
    });
  }

  /** announce immediately - for synchronous registration APIs */
  public emitNow() {
    this._registered = new Map(this.registered);
    this.onChangeEmitter.trigger(this._registered);
  }

  /**
   * Register a font under `key`, unless something is registered there already.
   *
   * `key` and `family` come apart for the built-ins, which are keyed by their
   * numeric id but whose font faces (and so CSS) go by name.
   */
  public add(
    key: FontFamily,
    family: string,
    metadata: FontMetadata,
    fontFaceDescriptors: ExcalidrawFontFaceDescriptor[],
  ) {
    FontRegistry.addTo(
      this.registered,
      key,
      family,
      metadata,
      fontFaceDescriptors,
    );
  }

  /**
   * add the given font faces into the document's `fonts` (if not added
   * already) - the global `document` unless the editor renders into another
   * one (see `ExcalidrawProps.ownerDocument`)
   */
  public installFontFaces(
    fontFaces: readonly ExcalidrawFontFace[],
    ownerDocument: Document = document,
  ) {
    for (const { fontFace } of fontFaces) {
      if (!ownerDocument.fonts.has(fontFace)) {
        ownerDocument.fonts.add(fontFace);
      }
    }
  }

  /**
   * Whether at least one font face of the family has already loaded - by our
   * own instances, not the browser-serialized `fontFace.family`. A face the
   * host loaded itself stays invisible here, which errs safely: callers fall
   * back to the (slow, but correct) `document.fonts.check`.
   */
  public isFamilyLoaded = (family: FontFamily): boolean =>
    this.registered
      .get(family)
      ?.fontFaces.some(({ fontFace }) => this.loadedFaces.has(fontFace)) ??
    false;

  private static addTo(
    registered: Map<FontFamily, RegisteredFont>,
    key: FontFamily,
    family: string,
    metadata: FontMetadata,
    fontFaceDescriptors: ExcalidrawFontFaceDescriptor[],
  ) {
    if (!registered.has(key)) {
      registered.set(key, {
        metadata,
        fontFaces: fontFaceDescriptors.map(
          ({ uri, descriptors }) =>
            new ExcalidrawFontFace(family, uri, descriptors),
        ),
      });
    }
  }

  private initBuiltIns() {
    const registered = new Map<FontFamily, RegisteredFont>();

    const init = (
      family: keyof typeof FONT_FAMILY | keyof typeof FONT_FAMILY_FALLBACKS,
      ...fontFacesDescriptors: ExcalidrawFontFaceDescriptor[]
    ) => {
      const fontFamily =
        FONT_FAMILY[family as keyof typeof FONT_FAMILY] ??
        FONT_FAMILY_FALLBACKS[family as keyof typeof FONT_FAMILY_FALLBACKS];

      FontRegistry.addTo(
        registered,
        fontFamily,
        family,
        getFontMetadata(fontFamily),
        fontFacesDescriptors,
      );
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

    this.initializedBuiltIns = true;

    return registered;
  }
}

/** the page-wide default registry - see {@link FontRegistry} */
export const defaultFontRegistry = new FontRegistry();
