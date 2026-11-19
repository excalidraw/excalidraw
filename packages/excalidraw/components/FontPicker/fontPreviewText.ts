import {
  isCustomFontFamily,
  parseProviderFontFamily,
} from "@excalidraw/common";

import type { CustomFontFamily, FontFamily } from "@excalidraw/common";

import type { FontProviders } from "../../types";

const DEFAULT_PREVIEW_TEXT = "Aa";

// per qualified family - a provider key always denotes the same font source
const previewTexts = new Map<CustomFontFamily, string>();
const pendingPreviewTexts = new Map<CustomFontFamily, Promise<void>>();

/** the glyph sample a font is previewed with in the top-picks strip - "Aa"
 * until {@link loadFontPreviewText} settles */
export const getFontPreviewText = (fontFamily: FontFamily) =>
  (isCustomFontFamily(fontFamily) && previewTexts.get(fontFamily)) ||
  DEFAULT_PREVIEW_TEXT;

/**
 * Ask the family's provider for its preview text. A synchronous answer is
 * cached before this returns; a failed one caches the default, so a broken
 * provider isn't asked (and doesn't log) on every render.
 *
 * @returns `null` when there's nothing to wait for
 */
export const loadFontPreviewText = (
  fontFamily: FontFamily,
  fontProviders: FontProviders | undefined,
): Promise<void> | null => {
  if (!isCustomFontFamily(fontFamily) || previewTexts.has(fontFamily)) {
    return null;
  }
  const pending = pendingPreviewTexts.get(fontFamily);
  if (pending) {
    return pending;
  }

  const parsed = parseProviderFontFamily(fontFamily);
  // own-property check: "toString:Foo" must not match an inherited member
  const provider =
    parsed && fontProviders && Object.hasOwn(fontProviders, parsed.providerId)
      ? fontProviders[parsed.providerId]
      : undefined;
  if (!parsed || !provider?.getPreviewText) {
    // not cached - the provider may be configured later
    return null;
  }

  const onError = (error: unknown) => {
    console.error(`getPreviewText failed for "${fontFamily}"`, error);
    previewTexts.set(fontFamily, DEFAULT_PREVIEW_TEXT);
  };

  let result: string | Promise<string>;
  try {
    result = provider.getPreviewText(parsed.familyName);
  } catch (error) {
    onError(error);
    return null;
  }
  if (typeof result === "string") {
    previewTexts.set(fontFamily, result || DEFAULT_PREVIEW_TEXT);
    return null;
  }

  const promise = Promise.resolve(result)
    .then((text) => {
      previewTexts.set(fontFamily, text || DEFAULT_PREVIEW_TEXT);
    }, onError)
    .finally(() => pendingPreviewTexts.delete(fontFamily));
  pendingPreviewTexts.set(fontFamily, promise);
  return promise;
};
