import { GOOGLE_FONTS_RANGES } from "@excalidraw/common";

import { type ExcalidrawFontFaceDescriptor } from "../Fonts";

export const CairoPlayFontFaces: ExcalidrawFontFaceDescriptor[] = [
  {
    uri: "https://fonts.gstatic.com/s/cairoplay/v13/wXKEE3QSpo4vpRz_mz6FP-8iaauCLt_Hjopv3miu5IvcJo49mOo1oHYa9S_bwGs.woff2",
    descriptors: {
      unicodeRange: GOOGLE_FONTS_RANGES.ARABIC,
      weight: "500",
    },
  },
  {
    uri: "https://fonts.gstatic.com/s/cairoplay/v13/wXKEE3QSpo4vpRz_mz6FP-8iaauCLt_Hjopv3miu5IvcJo49mOo1oHYa8C_b.woff2",
    descriptors: {
      unicodeRange: GOOGLE_FONTS_RANGES.LATIN,
      weight: "500",
    },
  },
  {
    uri: "https://fonts.gstatic.com/s/cairoplay/v13/wXKEE3QSpo4vpRz_mz6FP-8iaauCLt_Hjopv3miu5IvcJo49mOo1oHYa_i_bwGs.woff2",
    descriptors: {
      unicodeRange: GOOGLE_FONTS_RANGES.LATIN_EXT,
      weight: "500",
    },
  },
];
