import { GOOGLE_FONTS_RANGES } from "@excalidraw/common";

import { type ExcalidrawFontFaceDescriptor } from "../Fonts";

import Cyrilic from "./Nunito-Regular-XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTA3j6zbXWjgevT5.woff2";
import Latin from "./Nunito-Regular-XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTQ3j6zbXWjgeg.woff2";
import CyrilicExt from "./Nunito-Regular-XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTk3j6zbXWjgevT5.woff2";
import LatinExt from "./Nunito-Regular-XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTo3j6zbXWjgevT5.woff2";
import Vietnamese from "./Nunito-Regular-XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTs3j6zbXWjgevT5.woff2";
import SourceHanSansSCBold from "./SourceHanSansSC-Bold.woff2";
import SourceCodeProBlack from "./SourceCodePro-Black.ttf.woff2";
import MapleMonoNormalNLBold from "./MapleMonoNormalNL-Bold.ttf.woff2";
import SarasaFixedCLBoldNerdFont from "./sarasa-fixed-cl-bold-nerd-font.woff2";

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

export const SourceHanSansSCFontFaces: ExcalidrawFontFaceDescriptor[] = [
  {
    uri: SourceHanSansSCBold,
    descriptors: {
      weight: "400",
    },
  },
];

export const SourceCodeProFontFaces: ExcalidrawFontFaceDescriptor[] = [
  {
    uri: SourceCodeProBlack,
    descriptors: {
      weight: "900",
    },
  },
];

export const MapleMonoNormalNLFontFaces: ExcalidrawFontFaceDescriptor[] = [
  {
    uri: MapleMonoNormalNLBold,
    descriptors: {
      weight: "700",
    },
  },
];

export const SarasaFixedCLBoldNerdFontFaces: ExcalidrawFontFaceDescriptor[] = [
  {
    uri: SarasaFixedCLBoldNerdFont,
    descriptors: {
      weight: "700",
    },
  },
];
