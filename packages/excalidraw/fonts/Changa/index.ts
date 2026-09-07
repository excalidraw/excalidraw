import { GOOGLE_FONTS_RANGES } from "@excalidraw/common";

import { type ExcalidrawFontFaceDescriptor } from "../Fonts";

export const ChangaFontFaces: ExcalidrawFontFaceDescriptor[] = [
  {
    uri: "https://fonts.gstatic.com/s/changa/v29/2-c79JNi2YuVOUcOarRPgnNGooxCZ5-xcjLj9ytf.woff2",
    descriptors: {
      unicodeRange: GOOGLE_FONTS_RANGES.ARABIC,
      weight: "500",
    },
  },
  {
    uri: "https://fonts.gstatic.com/s/changa/v29/2-c79JNi2YuVOUcOarRPgnNGooxCZ5-xcjfj9w.woff2",
    descriptors: {
      unicodeRange: GOOGLE_FONTS_RANGES.LATIN,
      weight: "500",
    },
  },
  {
    uri: "https://fonts.gstatic.com/s/changa/v29/2-c79JNi2YuVOUcOarRPgnNGooxCZ5-xcjnj9ytf.woff2",
    descriptors: {
      unicodeRange: GOOGLE_FONTS_RANGES.LATIN_EXT,
      weight: "500",
    },
  },
];
