import { GOOGLE_FONTS_RANGES } from "@excalidraw/common";

import { type ExcalidrawFontFaceDescriptor } from "../Fonts";

import Arabic from "./playpen-sans-arabic-arabic-400-normal.woff2";
import Latin from "./playpen-sans-arabic-latin-400-normal.woff2";

export const PlaypenArabicFontFaces: ExcalidrawFontFaceDescriptor[] = [
  {
    uri: Arabic,
    descriptors: {
      unicodeRange:
        "U+0600-06FF,U+0750-077F,U+08A0-08FF,U+FB50-FDFF,U+FE70-FEFF,U+1EE00-1EEFF",
    },
  },
  {
    uri: Latin,
    descriptors: {
      unicodeRange: GOOGLE_FONTS_RANGES.LATIN,
    },
  },
];
