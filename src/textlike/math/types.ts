export const SUBTYPE_MATH = "math";

export type MathProps = { useTex: boolean; mathOnly: boolean };

export const mathActionName = [
  "changeUseTex",
  "changeMathOnly",
  SUBTYPE_MATH,
] as const;
export type MathActionName = typeof mathActionName[number];

const mathShortcutNames = ["changeUseTex", "changeMathOnly"] as const;
export type MathShortcutName = typeof mathShortcutNames[number];

export const isMathShortcutName = (s: any): s is MathShortcutName =>
  mathShortcutNames.includes(s);
