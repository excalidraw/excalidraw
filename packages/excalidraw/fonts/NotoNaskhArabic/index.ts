import { GOOGLE_FONTS_RANGES } from "@excalidraw/common";

import { type ExcalidrawFontFaceDescriptor } from "../Fonts";

export const NotoNaskhArabicFontFaces: ExcalidrawFontFaceDescriptor[] = [
  {
    uri: "https://fonts.gstatic.com/s/notonaskharabic/v44/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2DHV20Lg.woff2",
    descriptors: {
      unicodeRange: GOOGLE_FONTS_RANGES.ARABIC,
      weight: "400",
    },
  },
  {
    uri: "https://fonts.gstatic.com/s/notonaskharabic/v44/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2GHV0.woff2",
    descriptors: {
      unicodeRange: GOOGLE_FONTS_RANGES.LATIN,
      weight: "400",
    },
  },
  {
    uri: "https://fonts.gstatic.com/s/notonaskharabic/v44/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2IHV20Lg.woff2",
    descriptors: {
      unicodeRange: GOOGLE_FONTS_RANGES.LATIN_EXT,
      weight: "400",
    },
  },
];
