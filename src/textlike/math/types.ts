export const TEXT_SUBTYPE_MATH = "math";

export type TextOptsMath = { useTex?: boolean };

export type TextActionNameMath = "changeUseTex";

const textShortcutNamesMath = ["changeUseTex"] as const;
export type TextShortcutNameMath = typeof textShortcutNamesMath[number];

export const isTextShortcutNameMath = (s: any): s is TextShortcutNameMath =>
  textShortcutNamesMath.includes(s);
