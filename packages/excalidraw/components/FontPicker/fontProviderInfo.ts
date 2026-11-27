import {
  isCustomFontFamily,
  parseProviderFontFamily,
} from "@excalidraw/common";

import type { CustomFontFamily, FontFamily } from "@excalidraw/common";

import type { FontKind, FontProvider, FontProviders } from "../../types";

const DEFAULT_PREVIEW_TEXT = "Aa";

const FONT_KINDS: ReadonlySet<unknown> = new Set<FontKind>([
  "hand-drawn",
  "normal",
  "code",
  "heading",
]);

/**
 * What a provider says about a family, asked once per family and kept for the
 * session - per qualified family, as a provider key always denotes the same
 * font source.
 */
const createProviderAnswers = <T>({
  name,
  getMethod,
  normalize,
}: {
  /** the provider's method, for the error message */
  name: string;
  getMethod: (
    provider: FontProvider,
  ) => ((familyName: string) => unknown) | undefined;
  /** the answer to keep - `null` for none, and for one that can't be used */
  normalize: (answer: unknown) => T | null;
}) => {
  const answers = new Map<CustomFontFamily, T | null>();
  const pendingAnswers = new Map<CustomFontFamily, Promise<void>>();

  /** `null` where the provider gave none, or hasn't answered yet */
  const get = (fontFamily: FontFamily): T | null =>
    (isCustomFontFamily(fontFamily) && answers.get(fontFamily)) || null;

  /**
   * Ask the family's provider. A synchronous answer is cached before this
   * returns; a failed one caches none, so a broken provider isn't asked (and
   * doesn't log) on every render.
   *
   * @returns `null` when there's nothing to wait for
   */
  const load = (
    fontFamily: FontFamily,
    fontProviders: FontProviders | undefined,
  ): Promise<void> | null => {
    if (!isCustomFontFamily(fontFamily) || answers.has(fontFamily)) {
      return null;
    }
    const pending = pendingAnswers.get(fontFamily);
    if (pending) {
      return pending;
    }

    const parsed = parseProviderFontFamily(fontFamily);
    // own-property check: "toString:Foo" must not match an inherited member
    const provider =
      parsed && fontProviders && Object.hasOwn(fontProviders, parsed.providerId)
        ? fontProviders[parsed.providerId]
        : undefined;
    const method = provider && getMethod(provider);
    if (!parsed || !provider || !method) {
      // not cached - the provider may be configured later
      return null;
    }

    const onError = (error: unknown) => {
      console.error(`${name} failed for "${fontFamily}"`, error);
      answers.set(fontFamily, null);
    };

    let result: unknown;
    try {
      result = method.call(provider, parsed.familyName);
    } catch (error) {
      onError(error);
      return null;
    }
    if (typeof (result as PromiseLike<unknown> | null)?.then !== "function") {
      answers.set(fontFamily, normalize(result));
      return null;
    }

    const promise = Promise.resolve(result)
      .then((answer) => {
        answers.set(fontFamily, normalize(answer));
      }, onError)
      .finally(() => pendingAnswers.delete(fontFamily));
    pendingAnswers.set(fontFamily, promise);
    return promise;
  };

  return { get, load };
};

const previewTexts = createProviderAnswers<string>({
  name: "getPreviewText",
  getMethod: (provider) => provider.getPreviewText,
  normalize: (text) =>
    typeof text === "string" && text && text !== DEFAULT_PREVIEW_TEXT
      ? text
      : null,
});

const kinds = createProviderAnswers<FontKind>({
  name: "getKind",
  getMethod: (provider) => provider.getKind,
  normalize: (kind) => (FONT_KINDS.has(kind) ? (kind as FontKind) : null),
});

/**
 * The preview text a family's provider gave it - `null` where it gave none
 * (or hasn't answered yet). Stands in for an icon in the font list: a family
 * named in Latin letters shows that it writes another script.
 */
export const getProvidedFontPreviewText = previewTexts.get;

/** see `FontProvider.getPreviewText` */
export const loadFontPreviewText = previewTexts.load;

/** the glyph sample a font is previewed with in the top-picks strip - "Aa"
 * until {@link loadFontPreviewText} settles */
export const getFontPreviewText = (fontFamily: FontFamily) =>
  previewTexts.get(fontFamily) ?? DEFAULT_PREVIEW_TEXT;

/**
 * The kind a family's provider gave it - `null` where it gave none (or hasn't
 * answered yet)
 */
export const getProvidedFontKind = kinds.get;

/** see `FontProvider.getKind` */
export const loadFontKind = kinds.load;
