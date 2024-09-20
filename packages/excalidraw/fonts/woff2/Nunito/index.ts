import Latin from "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTQ3j6zbXWjgeg.woff2";
import LatinExt from "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTo3j6zbXWjgevT5.woff2";
import Cyrilic from "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTA3j6zbXWjgevT5.woff2";
import CyrilicExt from "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTk3j6zbXWjgevT5.woff2";
import Vietnamese from "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTs3j6zbXWjgevT5.woff2";

import { GOOGLE_FONTS_RANGES } from "../../metadata";
import { type ExcalidrawFontFaceDescriptor } from "../..";

export const NunitoFontFaces: ExcalidrawFontFaceDescriptor[] = [
  {
    uri: CyrilicExt,
    descriptors: {
      unicodeRange: GOOGLE_FONTS_RANGES.CYRILIC_EXT,
      weight: "500",
    },
  },
  {
    uri: Cyrilic,
    descriptors: { unicodeRange: GOOGLE_FONTS_RANGES.CYRILIC, weight: "500" },
  },
  {
    uri: Vietnamese,
    descriptors: {
      unicodeRange: GOOGLE_FONTS_RANGES.VIETNAMESE,
      weight: "500",
    },
  },
  {
    uri: LatinExt,
    descriptors: { unicodeRange: GOOGLE_FONTS_RANGES.LATIN_EXT, weight: "500" },
  },
  {
    uri: Latin,
    descriptors: { unicodeRange: GOOGLE_FONTS_RANGES.LATIN, weight: "500" },
  },
];
