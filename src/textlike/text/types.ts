export const TEXT_SUBTYPE_TEXT = "text";

export type TextOptsText = {};

export type TextActionNameText = "";

const textShortcutNamesText = [""] as const;
export type TextShortcutNameText = typeof textShortcutNamesText[number];

export const isTextShortcutNameText = (s: any): s is TextShortcutNameText =>
  textShortcutNamesText.includes(s);
