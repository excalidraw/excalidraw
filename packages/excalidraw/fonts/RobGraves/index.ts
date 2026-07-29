import { type ExcalidrawFontFaceDescriptor } from "../Fonts";

import RobGraves from "./RobGraves.woff2";

/*
Rob Graves — a hand-drawn chalk-textured sans typeface by Kevin Richey (2008).
Freeware: "may be used for any commercial and non-commercial use. Feel free to
pass it along, but please include this document." (see ./LICENSE.rtf) — i.e.
redistribution is permitted as long as the readme travels with it, so unlike
Chalk Serif this font is safe to bundle.

Covers printable ASCII (U+20-7e) with full symbol coverage (`/ : { } + = < >`),
so no fallback is needed for typical diagram text.
*/
export const RobGravesFontFaces: ExcalidrawFontFaceDescriptor[] = [
  {
    uri: RobGraves,
    descriptors: {
      unicodeRange: "U+20-7e",
    },
  },
];
