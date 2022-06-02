import {
  TextActionNameMath,
  TextOptsMath,
  TextShortcutNameMath,
  TEXT_SUBTYPE_MATH,
} from "./math/types";

import {
  TextActionNameText,
  TextOptsText,
  TextShortcutNameText,
  TEXT_SUBTYPE_TEXT,
} from "./text/types";

// Types to export, union over all ExcalidrawTextElement subtypes
export type TextOpts = TextOptsText | TextOptsMath;
export type TextActionName = TextActionNameText | TextActionNameMath;
export type TextShortcutName = TextShortcutNameText | TextShortcutNameMath;

const textSubtype = [TEXT_SUBTYPE_TEXT, TEXT_SUBTYPE_MATH] as const;
export type TextSubtype = typeof textSubtype[number];
export const TEXT_SUBTYPE_DEFAULT = TEXT_SUBTYPE_TEXT;

export const getTextElementSubtypes = (): readonly TextSubtype[] => {
  return textSubtype;
};
