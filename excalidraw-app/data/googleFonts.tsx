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
  GOOGLE_FONT_PROVIDER_KEY,
  registerFontResolvers,
} from "@excalidraw/excalidraw/fonts/google";

import type { FontProviders } from "@excalidraw/excalidraw";

export const resolveGoogleFont = createGoogleFontResolver();

// for the image exports made outside of the editor, which doesn't share its
// `fontProviders` with them
registerFontResolvers({ [GOOGLE_FONT_PROVIDER_KEY]: resolveGoogleFont });

/** https://tabler.io/icons/icon/brand-google (filled) */
export const GoogleIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2a9.96 9.96 0 0 1 6.29 2.226a1 1 0 0 1 .04 1.52l-1.51 1.362a1 1 0 0 1 -1.265 .06a6 6 0 1 0 2.103 6.836l.001 -.004h-3.66a1 1 0 0 1 -.992 -.883l-.007 -.117v-2a1 1 0 0 1 1 -1h6.945a1 1 0 0 1 .994 .89c.04 .367 .061 .737 .061 1.11c0 5.523 -4.477 10 -10 10s-10 -4.477 -10 -10s4.477 -10 10 -10z" />
  </svg>
);

/** `fontProviders` for `<Excalidraw>` */
export const fontProviders: FontProviders = {
  [GOOGLE_FONT_PROVIDER_KEY]: {
    icon: GoogleIcon,
    availableFonts: [],
    resolve: resolveGoogleFont,
  },
};
