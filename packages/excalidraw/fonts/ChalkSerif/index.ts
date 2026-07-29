import { type ExcalidrawFontFaceDescriptor } from "../Fonts";

import ChalkSerif from "./ChalkSerif.woff2";

/*
Chalk Serif — a hand-drawn chalk-textured serif typeface by Alexey Gorka (2021).
Reserved Font Name "Chalk Serif". Free for personal and commercial use.

NOTE: this font is NOT under the SIL Open Font License like Excalidraw's other
fonts. Its license permits webfont use but forbids modification/redistribution
without the foundry's permission (see ./LICENSE.txt). Bundling it in a public
repo is redistribution — obtain written permission from inkgorka@gmail.com
before publishing, or swap in an OFL chalk face.

The `unicodeRange` below is restricted to the glyphs the font actually contains,
so that codepoints it lacks (e.g. `/ : { } + = < > [ ]`) fall back to the next
family in the stack instead of rendering as ".notdef" tofu boxes.
*/
export const ChalkSerifFontFaces: ExcalidrawFontFaceDescriptor[] = [
  {
    uri: ChalkSerif,
    descriptors: {
      unicodeRange:
        "U+20-21,U+24-29,U+2c-2e,U+30-39,U+3f,U+41-5a,U+61-7a,U+a0,U+ad,U+c0-c5,U+c7-cf,U+d1-d6,U+d8-dd,U+e0-e5,U+e7-ef,U+f1-f6,U+f8-fd,U+ff,U+178,U+2013,U+2018-2019,U+20ac",
    },
  },
];
