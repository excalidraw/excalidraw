import { type ExcalidrawFontFaceDescriptor } from "../Fonts";

import Neucha from "./Neucha.woff2";

/*
Neucha — a friendly hand-printed sans by Jovanny Lemonad, licensed under the
SIL Open Font License 1.1 (see ./OFL.txt), so it is free to bundle, embed and
redistribute — including in this repo.

Its clean letterforms carry no baked texture; the chalk look comes from the
element chalk-grain shader (see packages/element/src/chalk.ts), which is applied
to text as well when an element's `chalk` flag is on. Covers Latin + Cyrillic
with full punctuation/symbol coverage.
*/
export const NeuchaFontFaces: ExcalidrawFontFaceDescriptor[] = [
  {
    uri: Neucha,
    descriptors: {
      unicodeRange:
        "U+20-7e,U+a0-a1,U+a3-a4,U+a6-a9,U+ab-ae,U+b0-b1,U+b4-b7,U+bb,U+bf-c2,U+c4-cb,U+cd-cf,U+d1,U+d3-d4,U+d6,U+d9-dc,U+df-e2,U+e4-eb,U+ed-ef,U+f1,U+f3-f4,U+f6,U+f9-fc,U+ff,U+131,U+152-153,U+178,U+2c6,U+2da,U+2dc,U+3bc,U+401-40c,U+40e-44f,U+451-45c,U+45e-45f,U+490-491,U+2013-2014,U+2018-201a,U+201c-201e,U+2020-2022,U+2026,U+2030,U+2039-203a,U+20a3,U+20a7,U+20ac,U+2116,U+2122",
    },
  },
];
