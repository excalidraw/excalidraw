import LilitaLatin from "https://fonts.gstatic.com/s/lilitaone/v15/i7dPIFZ9Zz-WBtRtedDbYEF8RXi4EwQ.woff2";
import LilitaLatinExt from "https://fonts.gstatic.com/s/lilitaone/v15/i7dPIFZ9Zz-WBtRtedDbYE98RXi4EwSsbg.woff2";

import { GOOGLE_FONTS_RANGES } from "../../metadata";
import { type ExcalidrawFontFaceDescriptor } from "../..";

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
