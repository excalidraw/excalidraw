import { GOOGLE_FONTS_RANGES } from "@excalidraw/common";

import { type ExcalidrawFontFaceDescriptor } from "../Fonts";

export const LemonadaFontFaces: ExcalidrawFontFaceDescriptor[] = [
  {
    uri: "https://fonts.gstatic.com/s/lemonada/v31/0QI-MXFD9oygTWy_R-FFlwV-bgfR7QJGSOtGm_-d7Z0.woff2",
    descriptors: {
      unicodeRange: GOOGLE_FONTS_RANGES.ARABIC,
      weight: "500",
    },
  },
  {
    uri: "https://fonts.gstatic.com/s/lemonada/v31/0QI-MXFD9oygTWy_R-FFlwV-bgfR7QJGSOtGnv-d.woff2",
    descriptors: {
      unicodeRange: GOOGLE_FONTS_RANGES.LATIN,
      weight: "500",
    },
  },
  {
    uri: "https://fonts.gstatic.com/s/lemonada/v31/0QI-MXFD9oygTWy_R-FFlwV-bgfR7QJGSOtGkP-d7Z0.woff2",
    descriptors: {
      unicodeRange: GOOGLE_FONTS_RANGES.LATIN_EXT,
      weight: "500",
    },
  },
];
