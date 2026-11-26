/**
 * Google Fonts on excalidraw.com: the resolver alone.
 *
 * The font picker offers no Google fonts. But a text using one - from an
 * `.excalidraw` file, a shared link, or a paste from another app such as
 * Excalidraw+ - renders in that font, and the picker lists it for as long as
 * the scene uses it.
 */
import {
  createGoogleFontResolver,
  getGoogleFontKind,
  getGoogleFontPreviewText,
  GOOGLE_FONT_PROVIDER_KEY,
  registerFontResolvers,
} from "@excalidraw/excalidraw/fonts/google";

import type { FontProviders } from "@excalidraw/excalidraw";

export const resolveGoogleFont = createGoogleFontResolver();

// for the image exports made outside of the editor, which doesn't share its
// `fontProviders` with them
registerFontResolvers({ [GOOGLE_FONT_PROVIDER_KEY]: resolveGoogleFont });

/** `fontProviders` for `<Excalidraw>` */
export const fontProviders: FontProviders = {
  [GOOGLE_FONT_PROVIDER_KEY]: {
    availableFonts: [],
    resolve: resolveGoogleFont,
    // the icon of a font the scene uses, in the picker's list
    getKind: getGoogleFontKind,
    getPreviewText: getGoogleFontPreviewText,
  },
};
