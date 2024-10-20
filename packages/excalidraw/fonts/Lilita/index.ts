import LilitaLatin from "./Lilita-Regular-i7dPIFZ9Zz-WBtRtedDbYEF8RXi4EwQ.woff2";
import LilitaLatinExt from "./Lilita-Regular-i7dPIFZ9Zz-WBtRtedDbYE98RXi4EwSsbg.woff2";

import { GOOGLE_FONTS_RANGES } from "../FontMetadata";

import { type ExcalidrawFontFaceDescriptor } from "../Fonts";

export const LilitaFontFaces: ExcalidrawFontFaceDescriptor[] = [
  {
    uri: LilitaLatinExt,
    descriptors: { unicodeRange: GOOGLE_FONTS_RANGES.LATIN_EXT },
  },
  {
    uri: LilitaLatin,
    descriptors: { unicodeRange: GOOGLE_FONTS_RANGES.LATIN },
  },
];
